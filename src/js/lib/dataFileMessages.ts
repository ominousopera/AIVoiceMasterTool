import { useEffect, useState } from "react";
import { DataFileProblem, getDataFileProblems, subscribeDataFileProblems } from "./dataFile";
import { tr } from "./i18n";

// The panel's message for each problem dataFile.ts records with settings.json
// or presets.json. Kept apart from dataFile.ts because i18n reads settings.ts,
// which reads dataFile.ts.

/** The problems recorded so far, updated as new ones are recorded. */
export const useDataFileProblems = (): DataFileProblem[] => {
  const [problems, setProblems] = useState<DataFileProblem[]>(getDataFileProblems);
  useEffect(() => {
    // A problem can be recorded while any component renders; the update waits
    // for the current render to finish.
    const update = () => {
      window.setTimeout(() => setProblems(getDataFileProblems()), 0);
    };
    update();
    return subscribeDataFileProblems(update);
  }, []);
  return problems;
};

export const describeDataFileProblem = (problem: DataFileProblem): string => {
  const vars = {
    file: problem.file,
    what: problem.file === "settings.json" ? tr("saved API keys and settings") : tr("saved Silence Cut presets"),
    code: problem.code,
    copy: problem.copyPath,
  };
  switch (problem.kind) {
    case "unreadable":
      return tr(
        "Couldn't read {file} ({what}): {code}. Another program, such as an antivirus or backup tool, may be using it. What it holds isn't shown here, and nothing was written over it. Close and reopen the plugin to try again.",
        vars,
      );
    case "save-skipped":
      return tr(
        "A change wasn't saved: couldn't read {file} ({what}): {code}. Saving now would have replaced what it holds. Another program, such as an antivirus or backup tool, may be using it. Try again in a moment.",
        vars,
      );
    case "corrupt":
      return tr(
        "The file {file} ({what}) is damaged and can't be read, so what it holds isn't shown here. A copy was kept as {copy}. Nothing is saved over the damaged file until you close and reopen the plugin; after that, your next change replaces it.",
        vars,
      );
    case "corrupt-copied-before":
      return tr(
        "The file {file} ({what}) is damaged and can't be read, so what it holds isn't shown here. A copy of it was kept earlier as {copy}. Your next change replaces the damaged file.",
        vars,
      );
    default:
      return tr(
        "The file {file} ({what}) is damaged and can't be read, so what it holds isn't shown here. A copy of it couldn't be made, so nothing is saved over it.",
        vars,
      );
  }
};
