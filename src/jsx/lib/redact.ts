/** Shared by ppro.ts's runDiagnostics and aeft.ts's runAEDiagnostics. */

// Replaces the user's home folder with "~" everywhere in a report, so a
// shared Diagnostics file carries no account name or personal folder path.
// The structure below it is kept (e.g. "~/OneDrive/Documents/...") because
// path problems are diagnosed from that part. Covers both the raw path and
// its JSON-escaped form, since the JS panel's section is JSON.
export const redactHomeFolder = (text: string): string => {
  let home = "";
  try {
    home = new Folder("~").fsName;
  } catch (e) {
    return text;
  }
  if (!home || home.length < 4) return text;
  let out = text.split(home).join("~");
  const escaped = home.replace(/\\/g, "\\\\");
  if (escaped !== home) out = out.split(escaped).join("~");
  // Windows: the panel side writes the same folder with forward slashes and
  // may differ in letter case (a lowercase drive letter), so those forms are
  // replaced too, ignoring case.
  const variants = [home, home.replace(/\\/g, "/"), escaped];
  for (let i = 0; i < variants.length; i++) {
    const pattern = variants[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(pattern, "gi"), "~");
  }
  return out;
};
