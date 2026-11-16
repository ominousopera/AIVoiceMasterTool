import { useEffect, useRef, useState } from "react";
import { evalTS, getJsxLoadDiagnostics } from "../lib/utils/bolt";
import { useJsxLoadError } from "../lib/utils/useJsxLoadError";
import { translateHostMessage } from "../lib/i18n/hostMessages";
import type { PendingManifestInfo, PlaceResult } from "../lib/types";
import { getLanguage, tr, useLanguage } from "../lib/i18n";
import { loadSkipExternalLinkConfirm, saveSkipExternalLinkConfirm } from "../lib/settings";
import { describeDataFileProblem, useDataFileProblems } from "../lib/dataFileMessages";
import { LICENSE_COPYRIGHT, LICENSE_SECTIONS, LICENSE_TITLE } from "../lib/licenseText";
import THIRD_PARTY_NOTICES from "../../assets/licenses/NOTICE.md?raw";
import { fs, os, path } from "../lib/cep/node";
import { getDocumentsDir, primeDocumentsPathCache } from "../lib/genAudioDir";
import "./bridge.scss";

// Small companion panel for After Effects: picks up what "Send to After
// Effects" (in the main Premiere panel) last wrote to disk and places it on
// the active composition's timeline; see src/jsx/aeft/aeft.ts for the
// placement and src/jsx/ppro/ppro.ts's sendToAfterEffects() for what writes
// the manifest. Its gear-icon popover mirrors the main panel's (License,
// Licenses, Give Feedback, Run Diagnostics).
//
// No language picker on purpose: `useLanguage()`/`tr()` pick up the language
// chosen in the main Premiere panel (the same `settings.json`, read on this
// panel's mount, since it is a separate CEP extension,
// `com.aivoicemastertool.pro.bridge`, not `.main`).

const FEEDBACK_URL = "https://linktr.ee/nkolesov";

/** Platform, kernel release and CPU architecture for the Diagnostics report
 *  (os.release() is the kernel version: Darwin 22 = macOS 13 … 25 = macOS 26;
 *  on Windows the build number). */
const systemSummary = (): string => {
  try {
    return `${os.platform()} ${os.release()} ${os.arch()}`;
  } catch (e) {
    return "unknown";
  }
};

/**
 * Same glyph as main.tsx's GearIcon, duplicated rather than shared: a tiny
 * presentational component with no translated content to keep in sync
 * (licenseText.ts and i18n live in lib/ because their text must match in
 * both panels).
 */
const GearIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="2.4" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" strokeDasharray="1.5 2.15" />
  </svg>
);

const describeError = (e: any): string => {
  if (!e) return tr("Unknown error.");
  // aeft.ts errors arrive in English; see lib/i18n/hostMessages.ts.
  return translateHostMessage(e.message || String(e));
};

/** The send time from Premiere (ExtendScript's English `Date.toString()`), shown
 *  in the panel's language; the raw text if it can't be parsed. */
const formatSentTime = (raw: string | undefined): string => {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  try {
    return d.toLocaleString(getLanguage());
  } catch (e) {
    return d.toLocaleString();
  }
};

// Persistent, edge-triggered log of checkPendingManifest() poll results, for
// checking a stale summary in this panel. The other diagnostics
// (lastCheckedAt, manifestPath/manifestModifiedAt/manifestSizeBytes) are React
// state and gone when the panel remounts. This writes only on a real
// transition (the poll result differs from the last logged one), not every
// 2 s tick, so it stays small and reads as a timeline of what changed and
// when: a stale read shows as a transition lagging behind the moment "Send to
// After Effects" was clicked in Premiere; a display bug shows as a
// transition logged on time while the panel still showed the old value. Same
// "own small file, drained into the one Diagnostics report" pattern as
// kokoro.ts's drainKokoroDiagnosticLog.
// "Bridge Diagnostics" (not "Diagnostics") matches aeft.ts's
// getAEDiagnosticsFolder, where the AE-side reports go; "Diagnostics" is the
// main Premiere panel's folder (ppro.ts's getSubFolder("Diagnostics"),
// kokoro.ts's diagnosticLogPath).
const manifestPollLogPath = (): string | null => {
  // Only inside an existing "AI Voice Master Tool" folder: the poll must not
  // bring the folder back seconds after "Clear all data" removed it.
  const base = path.join(getDocumentsDir(), "AI Voice Master Tool");
  if (!fs.existsSync(base)) return null;
  const dir = path.join(base, "Bridge Diagnostics");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "ae-bridge-manifest-poll.log");
};

const describePendingForLog = (info: PendingManifestInfo): string =>
  `exists=${info.exists} manifestPath=${info.manifestPath} manifestModifiedAt=${info.manifestModifiedAt ?? "n/a"} manifestSizeBytes=${
    info.manifestSizeBytes ?? "n/a"
  } sequenceName=${info.sequenceName ?? "n/a"} mediaFileName=${info.mediaFileName ?? "n/a"} itemCount=${info.itemCount ?? "n/a"}`;

/** Reads whatever has accumulated since the last "Run Diagnostics" click and
 *  removes the file — same drain-and-clear semantics as
 *  drainKokoroDiagnosticLog, so there's never more than one file the user
 *  has to separately notice/attach. */
const drainManifestPollLog = (): string => {
  try {
    const p = manifestPollLogPath();
    if (!p || !fs.existsSync(p)) return "(no manifest-poll transitions since last Diagnostics run)";
    const content = fs.readFileSync(p, "utf-8");
    fs.unlinkSync(p);
    return content.trim() || "(no manifest-poll transitions since last Diagnostics run)";
  } catch (e) {
    return "(failed to read manifest-poll log)";
  }
};

export const Bridge = () => {
  useLanguage();
  // This panel is a separate CEP process from the main Premiere panel, so
  // genAudioDir.ts's documentsPathCache starts unprimed here; it is primed
  // through aeft.ts's getDocumentsFolderPath (as main.tsx's identical effect
  // does through ppro.ts), so manifestPollLogPath() doesn't fall back to the
  // naive os.homedir()+"Documents" join.
  // Resolves once the real Documents folder is known (it can be redirected,
  // e.g. to OneDrive). The poll's check() waits for it before it logs, so its
  // log lines don't land in the wrong Documents folder; refresh() (the Refresh
  // button, and after Place) doesn't wait, since it runs on a click, normally
  // long after this has resolved.
  const documentsReady = useRef<Promise<void> | null>(null);
  useEffect(() => {
    documentsReady.current = primeDocumentsPathCache();
  }, []);
  const [pending, setPending] = useState<PendingManifestInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PlaceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A failed background check, shown separately so the next successful check
  // can clear it without hiding a placement error.
  const [pollError, setPollError] = useState<string | null>(null);
  // A client-side (JS, not ExtendScript) wall-clock timestamp for the last
  // successful check, shown with manifestPath/manifestModifiedAt below (under
  // Details). It tells "the panel never re-checked" apart from "it re-checked
  // but got stale data back": checkPendingManifest() has no in-memory caching
  // on the ExtendScript side. See PendingManifestInfo's doc comments in
  // types.ts. If a stale summary ever shows up, this line is the first thing
  // to compare with ppro.ts's reported manifestPath and write time.
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  // Last snapshot written to manifestPollLogPath(), so refresh() and the poll's
  // check() below log each transition exactly once (a ref, not state: it must
  // not trigger a re-render and must be readable synchronously in the tick a
  // new poll result arrives).
  const lastLoggedSnapshotRef = useRef<string | null>(null);
  const logManifestIfChanged = (info: PendingManifestInfo) => {
    const snapshot = describePendingForLog(info);
    if (snapshot === lastLoggedSnapshotRef.current) return;
    lastLoggedSnapshotRef.current = snapshot;
    try {
      const logPath = manifestPollLogPath();
      if (logPath) fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${snapshot}\n`);
    } catch (e) {
      // best effort — never let logging itself be a new failure point
    }
  };

  const refresh = async () => {
    try {
      const info = await evalTS("checkPendingManifest");
      setPending(info);
      setLastCheckedAt(new Date().toLocaleTimeString());
      logManifestIfChanged(info);
    } catch (e: any) {
      setError(describeError(e));
    }
  };

  // Polls instead of checking only once on mount, so a newly sent cut shows up
  // without reopening the panel, also across several "Send to After Effects"
  // clicks in a row. Same interval-poll pattern as the main Premiere panel's
  // clip-selection checks. Skips the tick while a placement is in flight
  // (`busy`) so it can't overwrite `pending` under `handlePlace`'s own
  // `await refresh()` right after, which already covers the post-placement
  // refresh.
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (busy) return;
      try {
        const info = await evalTS("checkPendingManifest");
        if (documentsReady.current) await documentsReady.current;
        if (!cancelled) {
          setPending(info);
          setLastCheckedAt(new Date().toLocaleTimeString());
          setPollError(null);
          logManifestIfChanged(info);
        }
      } catch (e: any) {
        if (!cancelled) setPollError(describeError(e));
      }
    };
    check();
    const pollId = window.setInterval(check, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(pollId);
    };
  }, [busy]);

  // The second `evalTS` call below must be a separate script invocation from
  // `placeFromManifest`: within one ExtendScript call, Speed-adjusted audio
  // doesn't retime in After Effects (see aeft.ts's placeSegmentsReconstruction
  // doc comment). Skipped when `stretchedLayerIndices` is empty (a "rendered"
  // placement with no linked video has nothing to reposition).
  const handlePlace = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await evalTS("placeFromManifest");
      if (res.stretchedLayerIndices && res.stretchedLayerIndices.length > 0) {
        await evalTS("repositionStretchedLayers", res.stretchedLayerIndices);
      }
      setResult(res);
      await refresh();
    } catch (e: any) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  // ------------------------------------------------------------------
  // Settings popover (gear icon), following the main Premiere panel's pattern
  // (main.tsx: settings-menu/settings-popover, the same three modals). Only
  // what is relevant here: no language picker (see the top comment), no "Save
  // Renders" location or "Clear all data": this panel renders nothing and
  // writes only its diagnostics files (the manifest-poll log and Run
  // Diagnostics reports) under Documents/AI Voice Master Tool/Bridge
  // Diagnostics, which the main panel's Clear all data removes; it reads the
  // manifest ppro.ts writes and places into the open composition.
  // ------------------------------------------------------------------
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [diagBusy, setDiagBusy] = useState(false);
  const [diagPath, setDiagPath] = useState<string | null>(null);
  const [diagError, setDiagError] = useState<string | null>(null);
  const [licenseOpen, setLicenseOpen] = useState(false);
  const [licensesOpen, setLicensesOpen] = useState(false);
  const [confirmLinkOpen, setConfirmLinkOpen] = useState(false);
  const [rememberLinkChoice, setRememberLinkChoice] = useState(false);
  // The ExtendScript-load banner, as in the main panel. This panel is where a
  // "Failed to run script" dialog would come from, so it most needs to say when
  // its ExtendScript side failed to load instead of looking fine and doing
  // nothing. useJsxLoadError subscribes rather than reading once: initBolt's
  // evalFile is fire-and-forget and settles after mount.
  const jsxLoadError = useJsxLoadError();
  // settings.json couldn't be read or saved (see dataFile.ts).
  const dataFileProblems = useDataFileProblems();

  useEffect(() => {
    if (!settingsOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSettingsOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [settingsOpen]);

  /**
   * Specialized for this AE-side panel, not a copy of ppro.ts's runDiagnostics:
   * see aeft.ts's runAEDiagnostics for what it reports (AE version, the active
   * comp and every layer's stretch/inPoint/outPoint/startTime, the
   * pending-manifest info the card above shows).
   */
  const handleDiagnostics = async () => {
    if (diagBusy) return;
    setDiagBusy(true);
    setDiagPath(null);
    setDiagError(null);
    try {
      // The extension's own version and its jsx load status lead the AE-side
      // report, so a report says which build produced it; an ExtendScript load
      // failure in this panel has exactly the shape of a "Failed to run script"
      // dialog.
      const jsInfo =
        `AI Voice Master Tool v${__APP_VERSION__} (${__SECURE_BUILD__ ? "secure" : __RELEASE_BUILD__ ? "release" : "dev"} build) — AE Bridge plugin\n` +
        `platform: ${navigator.platform ?? "?"} cores=${
          (navigator as Navigator & { hardwareConcurrency?: number }).hardwareConcurrency ?? "?"
        }\n` +
        `system: ${systemSummary()}\n` +
        `jsx load: ${JSON.stringify(getJsxLoadDiagnostics())}\n` +
        `Bridge plugin: lastCheckedAt=${lastCheckedAt || "never"} pending.exists=${
          pending?.exists ?? "unknown"
        } lastResult=${result ? JSON.stringify(result) : "none"}\n` +
        `--- manifest-poll transition log (since last Diagnostics run) ---\n${drainManifestPollLog()}`;
      const res = await evalTS("runAEDiagnostics", jsInfo);
      setDiagPath(res.path);
    } catch (e: any) {
      setDiagError(describeError(e));
    } finally {
      setDiagBusy(false);
    }
  };

  const openFeedbackLink = () => {
    try {
      window.cep.util.openURLInDefaultBrowser(FEEDBACK_URL);
    } catch (e) {
      // best effort — nothing else to fall back to here
    }
  };

  const handleGiveFeedback = () => {
    if (loadSkipExternalLinkConfirm()) {
      openFeedbackLink();
      return;
    }
    setRememberLinkChoice(false);
    setConfirmLinkOpen(true);
  };

  const handleConfirmOpenLink = () => {
    if (rememberLinkChoice) saveSkipExternalLinkConfirm(true);
    setConfirmLinkOpen(false);
    openFeedbackLink();
  };

  // Full-panel dim + progress bar while an action runs (Place, Diagnostics),
  // the same pattern as the main Premiere panel.
  const anyBusy = busy || diagBusy;
  let busyLabel = tr("Placing…");
  if (diagBusy) busyLabel = tr("Running…");

  return (
    <div className="bridge">
      <header className="bridge-header">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
          <h1>AI Voice Master Tool Bridge</h1>
        </div>
        <div className="settings-menu" ref={settingsRef}>
          <button className="icon-btn" aria-label={tr("Diagnostics & feedback")} onClick={() => setSettingsOpen((o) => !o)}>
            <GearIcon />
          </button>
          {settingsOpen && (
            <div className="settings-popover" role="menu">
              <button onClick={handleDiagnostics} disabled={diagBusy}>
                {diagBusy ? tr("Running…") : tr("Run Diagnostics")}
              </button>
              <p className="hint">{tr("Saves an After Effects-specific troubleshooting report to your Documents folder.")}</p>
              {diagPath && (
                <div className="banner success">
                  {tr("Saved to")} <code>{diagPath}</code>.
                </div>
              )}
              {diagError && <div className="banner error">{diagError}</div>}

              <div className="divider" />

              <button onClick={handleGiveFeedback}>{tr("Give Feedback")}</button>

              <div className="divider" />

              <button onClick={() => setLicenseOpen(true)}>{tr("License")}</button>

              <div className="divider" />

              <button onClick={() => setLicensesOpen(true)}>{tr("Licenses / Third-party notices")}</button>

              <p className="hint" style={{ textAlign: "center", opacity: 0.6 }}>
                v{__APP_VERSION__} · {__SECURE_BUILD__ ? tr("secure build") : __RELEASE_BUILD__ ? tr("release build") : tr("dev build")}
              </p>
            </div>
          )}
        </div>
      </header>

      {!pending && !error && <p className="hint">{tr("Checking for a cut sent from Premiere…")}</p>}

      {pending && !pending.exists && (
        <p className="hint">
          {tr(
            'Nothing sent yet. In Premiere, use "Send to After Effects" (in the AI Voice Master Tool plugin\'s Send to AE tab) after cutting.',
          )}
        </p>
      )}

      {pending && pending.exists && (
        <div className="card">
          <p>
            <strong>{pending.itemCount}</strong> {pending.audioMode === "rendered" ? tr("rendered piece(s)") : tr("segment(s)")}
            {!!pending.videoItemCount && tr(" + {count} video piece(s)", { count: pending.videoItemCount })}{" "}
            {tr('from "{name}"{fileName}', {
              name: pending.sequenceName || "",
              fileName: pending.mediaFileName ? ` (${pending.mediaFileName})` : "",
            })}
          </p>
          <p className="hint">{tr("Sent {when}", { when: formatSentTime(pending.createdAt) })}</p>
          <div className="row">
            <button className="primary" onClick={handlePlace} disabled={busy}>
              {busy ? tr("Placing…") : tr("Place in current composition")}
            </button>
            {/* Forces an immediate re-read instead of waiting for the next 2-second poll
                tick (refresh() is also used by handlePlace's post-place re-check). */}
            <button onClick={refresh} disabled={busy}>
              {tr("Refresh")}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="banner success">
          {tr("Placed {count} {kind}", {
            count: result.placed,
            kind: result.audioMode === "rendered" ? tr("rendered piece(s)") : tr("segment(s)"),
          })}
          {!!result.videoPlaced && tr(" + {count} video piece(s)", { count: result.videoPlaced })}.
          {result.warnings.length > 0 && (
            <ul>
              {result.warnings.map((w, i) => (
                <li key={i}>{translateHostMessage(w)}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {jsxLoadError && (
        <div className="banner error">
          {tr(
            "The Bridge's scripting part didn't load, so it can't place anything. Quit and reopen After Effects; if that doesn't help, reinstall the plugin.",
          )}{" "}
          {jsxLoadError}
        </div>
      )}

      {dataFileProblems.map((problem) => (
        <div key={problem.file} className="banner warning">
          {describeDataFileProblem(problem)}
        </div>
      ))}

      {error && <div className="banner error">{error}</div>}
      {pollError && !error && <div className="banner error">{pollError}</div>}

      {/* Shown whenever the manifest info has been read, even with nothing pending
          (`exists` false), since it is for comparing with ppro.ts's reported
          manifestPath and write time; folded under Details. See
          PendingManifestInfo's doc comments. */}
      {pending && (
        <details className="hint diag">
          <summary>{tr("Details")}</summary>
          {tr("Reading: {path}", { path: pending.manifestPath })}
          {pending.manifestModifiedAt && tr(" · modified {when}", { when: pending.manifestModifiedAt })}
          {typeof pending.manifestSizeBytes === "number" && tr(" · {count} bytes", { count: pending.manifestSizeBytes })}
          {lastCheckedAt && tr(" · the Bridge last checked {when}", { when: lastCheckedAt })}
        </details>
      )}

      {confirmLinkOpen && (
        <div className="modal-overlay" role="presentation" onClick={() => setConfirmLinkOpen(false)}>
          <div className="modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>{tr("Open link in your browser?")}</h2>
            <p>
              {tr("This opens")} <code>{FEEDBACK_URL}</code> {tr("in your default browser, outside of After Effects.")}
            </p>
            <label className="row">
              <input type="checkbox" checked={rememberLinkChoice} onChange={(e) => setRememberLinkChoice(e.target.checked)} />
              {tr("Remember my choice")}
            </label>
            <div className="modal-actions">
              <button onClick={() => setConfirmLinkOpen(false)}>{tr("Cancel")}</button>
              <button className="primary" onClick={handleConfirmOpenLink}>
                {tr("Open")}
              </button>
            </div>
          </div>
        </div>
      )}

      {licenseOpen && (
        <div className="modal-overlay" role="presentation" onClick={() => setLicenseOpen(false)}>
          <div className="modal-card doc-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>{LICENSE_TITLE}</h2>
            <div className="doc-body">
              <p className="doc-copyright">{LICENSE_COPYRIGHT}</p>
              {LICENSE_SECTIONS.map((section) => (
                <div key={section.heading} className="doc-section">
                  <h3>{section.heading}</h3>
                  {section.paragraphs.map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="primary" onClick={() => setLicenseOpen(false)}>
                {tr("Close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {licensesOpen && (
        <div className="modal-overlay" role="presentation" onClick={() => setLicensesOpen(false)}>
          <div className="modal-card doc-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>{tr("Licenses / Third-party notices")}</h2>
            <div className="doc-body">
              <pre className="notices-pre">{THIRD_PARTY_NOTICES}</pre>
            </div>
            <div className="modal-actions">
              <button className="primary" onClick={() => setLicensesOpen(false)}>
                {tr("Close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {anyBusy && (
        <div className="busy-overlay" role="presentation">
          <div className="busy-card" role="alert" aria-live="polite">
            <div className="busy-bar-track">
              <div className="busy-bar-thumb" />
            </div>
            <div className="busy-label">{busyLabel}</div>
          </div>
        </div>
      )}
    </div>
  );
};
