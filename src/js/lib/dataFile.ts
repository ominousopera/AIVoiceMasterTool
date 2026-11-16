import { fs, os, path } from "./cep/node";

// Reading and writing the JSON files in the app's own settings folder
// (settings.json: API keys and choices; presets.json: Silence Cut presets).
// Each save reads the file, changes one value and writes the whole file back,
// so a read that fails must never be treated as "no file": the save would
// replace everything the file holds with that one value. The rules:
//
// - ENOENT / ENOTDIR (the file or its folder is not there): no file yet, start
//   empty and save normally.
// - The text isn't JSON, or not the expected shape: the file is damaged. A
//   copy of it is kept next to it (copied, not moved: the After Effects panel
//   reads the same settings.json, and a moment with no file would look like a
//   fresh start to it). Nothing is saved over the damaged file until the panel
//   is opened again; then, with the copy in place, the next change replaces it.
//   If the copy can't be made, nothing is ever saved over the file.
// - Any other error (another program holds the file, no permission, a cloud
//   folder hasn't downloaded it yet): the file can't be read now. Defaults are
//   shown, and a save is skipped instead of writing over the file.
//
// Every problem is recorded here for the panel's message (see
// dataFileMessages.ts) and stays until the panel is closed.

/** The app's own settings folder, shared by settings.json and presets.json. */
export const getAppDataDir = (): string => {
  const isWin = os.platform() === "win32";
  return isWin
    ? path.join(os.homedir(), "AppData", "Roaming", "AI Voice Master Tool")
    : path.join(os.homedir(), "Library", "Application Support", "AI Voice Master Tool");
};

export type DataFileName = "settings.json" | "presets.json";

export interface DataFileProblem {
  file: DataFileName;
  /**
   * - "corrupt": damaged; a copy was made now, and nothing is saved over the
   *   file until the panel is opened again.
   * - "corrupt-copied-before": damaged; an identical copy already exists from
   *   an earlier session, so the next change replaces the file.
   * - "corrupt-no-copy": damaged, and copying it failed; nothing is saved over it.
   * - "unreadable": reading failed with `code`; what the file holds isn't shown.
   * - "save-skipped": a change wasn't saved because the file couldn't be read.
   */
  kind: "corrupt" | "corrupt-copied-before" | "corrupt-no-copy" | "unreadable" | "save-skipped";
  /** The copy's path with the home folder shown as "~"; "" when there is none. */
  copyPath: string;
  /** The read error's code (EACCES, EBUSY…); "" for a damaged file. */
  code: string;
}

const problems: Partial<Record<DataFileName, DataFileProblem>> = {};
const problemListeners = new Set<() => void>();

/** The problems recorded in this session, one per file at most. */
export const getDataFileProblems = (): DataFileProblem[] => {
  const out: DataFileProblem[] = [];
  const names: DataFileName[] = ["settings.json", "presets.json"];
  for (const name of names) {
    const problem = problems[name];
    if (problem) out.push(problem);
  }
  return out;
};

/** Calls `listener` whenever a problem is recorded; returns the unsubscribe. */
export const subscribeDataFileProblems = (listener: () => void): (() => void) => {
  problemListeners.add(listener);
  return () => {
    problemListeners.delete(listener);
  };
};

// A damaged file outranks a read error, and a skipped save outranks a read
// error at load, so the message about the bigger consequence stays shown.
const PROBLEM_RANK: Record<DataFileProblem["kind"], number> = {
  "unreadable": 1,
  "save-skipped": 2,
  "corrupt-copied-before": 3,
  "corrupt": 4,
  "corrupt-no-copy": 4,
};

const recordProblem = (problem: DataFileProblem): void => {
  const current = problems[problem.file];
  if (current && PROBLEM_RANK[current.kind] > PROBLEM_RANK[problem.kind]) return;
  if (current && current.kind === problem.kind && current.code === problem.code && current.copyPath === problem.copyPath) return;
  problems[problem.file] = problem;
  problemListeners.forEach((listener) => listener());
  console.warn("[" + problem.file + "] " + problem.kind + (problem.code ? " (" + problem.code + ")" : ""));
};

const errorCode = (e: unknown): string => {
  const code = e && typeof e === "object" ? (e as { code?: unknown }).code : undefined;
  return typeof code === "string" && code ? code : "UNKNOWN";
};

const withTilde = (fullPath: string): string => {
  const home = os.homedir();
  return home && fullPath.indexOf(home) === 0 ? "~" + fullPath.slice(home.length) : fullPath;
};

/** Read once at load: silero.ts hides the `process` global for the moment its
 *  model session is created, and a save during that moment (a favourite
 *  star, a checkbox) must not depend on it. */
const WRITER_ID: string = (() => {
  try {
    return String(process.pid);
  } catch (e) {
    return String(Date.now());
  }
})();

type ReadResult<T> = { state: "ok"; value: T } | { state: "missing" } | { state: "corrupt" } | { state: "unreadable"; code: string };

export interface DataFile<T> {
  /** For showing: the stored value, or the empty value when there is no file
   *  or it can't be used (`failed` true; the problem is recorded). */
  load: () => { value: T; failed: boolean };
  /** For a change: the current value (the empty value when there is no file),
   *  or null when writing back could lose what the file holds; the problem is
   *  recorded and the caller must not write. */
  readForSave: () => T | null;
  /** Writes through a temp file and a rename, so an interrupted write can't
   *  leave the file half-written. */
  write: (value: T) => void;
}

/**
 * @param name     the file's name in the app's settings folder
 * @param fromJson the stored value from the parsed JSON, or null when it isn't
 *                 the expected shape (counted as a damaged file)
 * @param empty    a fresh empty value
 */
export const createDataFile = <T>(name: DataFileName, fromJson: (parsed: unknown) => T | null, empty: () => T): DataFile<T> => {
  const filePath = (): string => path.join(getAppDataDir(), name);
  const copyPrefix = name + ".corrupted-";
  // Copies of a damaged file made in this session, and whether copying failed
  // in this session: either way nothing is saved over the file until the
  // panel is opened again.
  const copiesMadeThisSession = new Set<string>();
  let copyFailedThisSession = false;

  const read = (): ReadResult<T> => {
    const file = filePath();
    let text: string;
    try {
      text = fs.readFileSync(file, "utf-8");
    } catch (e) {
      const code = errorCode(e);
      if (code === "ENOENT" || code === "ENOTDIR") return { state: "missing" };
      return { state: "unreadable", code };
    }
    // A byte-order mark (added by some text editors) is not part of the JSON.
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return { state: "corrupt" };
    }
    const value = fromJson(parsed);
    return value === null ? { state: "corrupt" } : { state: "ok", value };
  };

  /** A copy in the folder with exactly the damaged file's bytes, or "". */
  const findIdenticalCopy = (file: string): string => {
    try {
      const bytes = fs.readFileSync(file);
      const dir = path.dirname(file);
      for (const entry of fs.readdirSync(dir)) {
        if (entry.indexOf(copyPrefix) !== 0) continue;
        const candidate = path.join(dir, entry);
        try {
          if (fs.statSync(candidate).size === bytes.length && fs.readFileSync(candidate).equals(bytes)) return candidate;
        } catch (e) {
          // unreadable copy: not a match
        }
      }
    } catch (e) {
      // the folder can't be listed: no match, a new copy is tried
    }
    return "";
  };

  /** Keeps a copy of the damaged file and returns whether saving over it is
   *  allowed now (only when an identical copy existed before this session). */
  const handleCorrupt = (): boolean => {
    const file = filePath();
    if (copyFailedThisSession) {
      recordProblem({ file: name, kind: "corrupt-no-copy", copyPath: "", code: "" });
      return false;
    }
    const existing = findIdenticalCopy(file);
    if (existing && copiesMadeThisSession.has(existing)) {
      recordProblem({ file: name, kind: "corrupt", copyPath: withTilde(existing), code: "" });
      return false;
    }
    if (existing) {
      recordProblem({ file: name, kind: "corrupt-copied-before", copyPath: withTilde(existing), code: "" });
      return true;
    }
    const copy = file + ".corrupted-" + Date.now();
    try {
      fs.copyFileSync(file, copy, fs.constants.COPYFILE_EXCL);
      copiesMadeThisSession.add(copy);
      recordProblem({ file: name, kind: "corrupt", copyPath: withTilde(copy), code: "" });
    } catch (e) {
      copyFailedThisSession = true;
      recordProblem({ file: name, kind: "corrupt-no-copy", copyPath: "", code: "" });
    }
    return false;
  };

  const load = (): { value: T; failed: boolean } => {
    const result = read();
    if (result.state === "ok") return { value: result.value, failed: false };
    if (result.state === "missing") return { value: empty(), failed: false };
    if (result.state === "corrupt") handleCorrupt();
    else recordProblem({ file: name, kind: "unreadable", copyPath: "", code: result.code });
    return { value: empty(), failed: true };
  };

  const readForSave = (): T | null => {
    const result = read();
    if (result.state === "ok") return result.value;
    if (result.state === "missing") return empty();
    if (result.state === "corrupt") return handleCorrupt() ? empty() : null;
    recordProblem({ file: name, kind: "save-skipped", copyPath: "", code: result.code });
    return null;
  };

  const write = (value: T): void => {
    const dir = getAppDataDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, name);
    const tmpFile = file + ".tmp-" + WRITER_ID;
    fs.writeFileSync(tmpFile, JSON.stringify(value, null, 2), "utf-8");
    fs.renameSync(tmpFile, file);
  };

  return { load, readForSave, write };
};
