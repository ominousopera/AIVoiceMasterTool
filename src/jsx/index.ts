// @include './lib/json2.js'

import { ns } from "../shared/shared";

import * as ppro from "./ppro/ppro";
import * as aeft from "./aeft/aeft";

//@ts-ignore
const host = typeof $ !== "undefined" ? $ : window;

// This extension declares two hosts (see cep.config.ts's `hosts` list and the
// manifest's <HostList>): PPRO for the main panel, AEFT for the small bridge
// panel. vite.es.config.ts builds one shared ExtendScript bundle for the whole
// extension (no per-panel jsx entry point), so this file is parsed by both
// Premiere's and After Effects' ExtendScript engines. bolt-cep's scaffold
// normally branches on BridgeTalk.appName / app.name / app.path here to
// register only the relevant module per host; that detection is unreliable
// on some Adobe app versions, and when it fails host[ns] is never set and
// every evalTS call fails silently. So both modules' functions are registered
// unconditionally in both engines. That is safe: registering a function only
// attaches a reference, and each panel only calls its own half (the main
// panel ppro.*, the bridge panel aeft.*).
host[ns] = ppro;
// Plain for-in merge, not object spread ({...ppro, ...aeft}): that compiles
// to a Babel _objectSpread helper needing Object.keys, which this ExtendScript
// engine doesn't have.
for (const key in aeft) {
  if (Object.prototype.hasOwnProperty.call(aeft, key)) {
    (host[ns] as any)[key] = (aeft as any)[key];
  }
}

const empty = {};
// prettier-ignore
export type Scripts = typeof empty
  & typeof ppro
  & typeof aeft
  ;
