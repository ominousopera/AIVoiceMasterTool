import React from "react";
import ReactDOM from "react-dom/client";
import { initBolt } from "../lib/utils/bolt";
import "../index.scss";
import { App } from "./main";
import { logDiagnosticStep } from "../lib/kokoro";
import { AI_PROVIDER_HOSTS, installNetworkGuard, UPDATE_CHECK_HOSTS } from "../lib/networkGuard";

// This entry's compiled output (`main-<hash>.cjs`) is loaded once by a classic
// `<script>` tag in main/index.html, which doesn't go through Node's
// `require()`/`require.cache`. A dynamically imported chunk (the one loaded
// when Kokoro is first picked on the AI Voice tab) can contain a plain
// `require("./main-<hash>.cjs")` (a Rollup code-splitting artifact from a
// dependency it shares with this entry chunk). Since this file was never
// `require()`'d, Node finds no cache entry and executes it again from disk the
// moment that line runs, in the same process and window. `initBolt()`
// registers `window.__adobe_cep__` event listeners (flyout/context menu), and
// `ReactDOM.createRoot(...).render(...)` would mount a second React tree into
// the same container without unmounting the first. Both must run at most once
// per window, so both are guarded here.
const w = window as unknown as { __appEntryRan?: boolean };
if (!w.__appEntryRan) {
  w.__appEntryRan = true;
  logDiagnosticStep("index-react.tsx: first execution in this window — running initBolt + createRoot().render()");

  try {
    // Only the AI Voice tab's cloud providers, with the user's own keys, and
    // GitHub (api.github.com, raw.githubusercontent.com) for the optional
    // update notice may be reached over the network — see networkGuard.ts.
    installNetworkGuard([...AI_PROVIDER_HOSTS, ...UPDATE_CHECK_HOSTS]);
    initBolt();

    ReactDOM.createRoot(document.getElementById("app") as HTMLElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  } catch (e) {
    // The flag above stops an unwanted second execution (the require() cache miss
    // described at the top). If initBolt() or createRoot().render() itself throws
    // (element missing, CSInterface call failing), the flag is reset, so a later
    // execution or a manual panel reload can try init again instead of leaving
    // the panel blank for the rest of the window's lifetime.
    w.__appEntryRan = false;
    logDiagnosticStep(`index-react.tsx: initBolt/render FAILED — ${e instanceof Error ? e.message : String(e)}`);
    console.error("[index-react] initBolt/render failed:", e);
  }
} else {
  // Logged when the guard skips a repeated execution of this entry chunk.
  logDiagnosticStep("index-react.tsx: skipped — app already rendered in this window, not re-running initBolt/createRoot()");
}
