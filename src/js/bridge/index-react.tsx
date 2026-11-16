import React from "react";
import ReactDOM from "react-dom/client";
import { initBolt } from "../lib/utils/bolt";
import "../index.scss";
import { Bridge } from "./main";
import { installNetworkGuard } from "../lib/networkGuard";

// Same double-execution guard as main/index-react.tsx (see its comment: a
// Rollup code-splitting artifact can cause this entry chunk to be
// re-`require()`'d in the same window/process without a page navigation).
// initBolt() registers window.__adobe_cep__ listeners and
// createRoot().render() would mount a second React tree into the same #app
// container, without unmounting the first, if this module's top-level body
// re-executed.
const w = window as unknown as { __appEntryRan?: boolean };
if (!w.__appEntryRan) {
  w.__appEntryRan = true;
  try {
    // This panel never needs the network — see networkGuard.ts.
    installNetworkGuard([]);
    initBolt();

    ReactDOM.createRoot(document.getElementById("app") as HTMLElement).render(
      <React.StrictMode>
        <Bridge />
      </React.StrictMode>,
    );
  } catch (e) {
    // See main/index-react.tsx's identical catch: reset the flag on failure
    // so a genuine retry can attempt init again instead of being silently
    // skipped forever.
    w.__appEntryRan = false;
    console.error("[bridge/index-react] initBolt/render failed:", e);
  }
}
