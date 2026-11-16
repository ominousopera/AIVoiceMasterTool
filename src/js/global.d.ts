import { cep_node, cep, __adobe_cep__ } from "./lib/cep-types";

declare module "*.png";
declare module "*.gif";
declare module "*.jpg";
declare module "*.svg";

declare global {
  interface Window {
    cep_node: cep_node;
    cep: cep;
    __adobe_cep__: __adobe_cep__;
  }
  // Injected via `vite.config.ts`'s `define` at build time from
  // package.json's own `version` field — same source cep.config.ts already
  // reads for the extension's manifest version, so the UI's version display
  // can never drift from what's actually installed.
  const __APP_VERSION__: string;
  // True only for a SECURE_BUILD=true build with jsxBin actually enabled
  // (see vite.config.ts); false for dev builds and the release
  // packages. Shown next to the version so a bug report says which build is
  // installed.
  const __SECURE_BUILD__: boolean;
  // True for the published release packages (RELEASE_BUILD=true, plain
  // ExtendScript, see vite.config.ts); shown as "release build".
  const __RELEASE_BUILD__: boolean;
}
