import { defineConfig, type Plugin } from "vite";

import react from "@vitejs/plugin-react";

import { cep, CepOptions, runAction } from "vite-cep-plugin";
import cepConfig from "./cep.config";
import path from "path";
import { extendscriptConfig } from "./vite.es.config";

const extensions = [".js", ".ts", ".tsx"];

const devDist = "dist";
const cepDist = "cep";

const src = path.resolve(__dirname, "src");
const root = path.resolve(src, "js");
const outDir = path.resolve(__dirname, "dist", cepDist);

const debugReact = process.env.DEBUG_REACT === "true";
// jsxBin is on only with SECURE_BUILD=true and ENABLE_JSXBIN=true together
// (`npm run zip:secure`); the panel's "secure build" label (__SECURE_BUILD__)
// follows it exactly, so it never claims "secure build" when jsxBin is off.
const enableJsxBin = process.env.SECURE_BUILD === "true" && process.env.ENABLE_JSXBIN === "true";
const secureBuild = enableJsxBin;
// The published packages: plain, readable ExtendScript (no jsxBin), labelled
// "release build" in the panel. A secure build wins if both are set.
const releaseBuild = process.env.RELEASE_BUILD === "true" && !secureBuild;
// Mutating the already-imported object here, not inside cep.config.ts: that
// file is reachable from the ExtendScript bundle (via shared/shared.ts), so
// process.env-conditional logic inside it risks Rollup leaving a dangling
// `process.env...` statement in ExtendScript output, where `process` doesn't
// exist (see cep.config.ts's top comment). vite.config.ts is never imported
// by anything ExtendScript-reachable.
if (enableJsxBin) {
  cepConfig.build.jsxBin = "replace";
  cepConfig.zxp.jsxBin = "replace";
}
// TARGET_PLATFORM=mac|win builds one package per platform, leaving the other
// platform's native binaries out of copyAssets. Unset = both (dev builds).
// Done here for the same ExtendScript-reachability reason as jsxBin above.
const targetPlatform = process.env.TARGET_PLATFORM;
if (targetPlatform === "mac" || targetPlatform === "win") {
  const otherBinDir = targetPlatform === "mac" ? "assets/bin/win/" : "assets/bin/mac/";
  cepConfig.copyAssets = (cepConfig.copyAssets || []).filter((asset) => !asset.startsWith(otherBinDir));
} else if (targetPlatform) {
  throw new Error(`TARGET_PLATFORM must be "mac" or "win", got "${targetPlatform}"`);
}
const isProduction = process.env.NODE_ENV === "production";
const isMetaPackage = process.env.ZIP_PACKAGE === "true";
const isPackage = process.env.ZXP_PACKAGE === "true" || isMetaPackage;
const isServe = process.env.SERVE_PANEL === "true";
const action = process.env.BOLT_ACTION;

let input: { [key: string]: string } = {};
cepConfig.panels.map((panel) => {
  input[panel.name] = path.resolve(root, panel.mainPath);
});

const config: CepOptions = {
  cepConfig,
  isProduction,
  isPackage,
  isMetaPackage,
  isServe,
  debugReact,
  dir: `${__dirname}/${devDist}`,
  cepDist: cepDist,
  zxpOutput: `${__dirname}/${devDist}/zxp/${cepConfig.id}`,
  zipOutput: `${__dirname}/${devDist}/zip/${cepConfig.displayName}_${cepConfig.version}`,
  packages: cepConfig.installModules || [],
};

if (action) runAction(config, action);

// https://vitejs.dev/config/
// vite-cep-plugin emits CEP's `.debug` file into every build, packages
// included. That file turns on Chrome remote debugging for both panels on
// ports 8860-8863, so an installed copy would listen on a local debugging
// port through which any program on the machine could attach and run code in
// a panel that has Node.js file access. Kept for development builds; removed
// from the bundle before a .zxp/.zip is signed (the package is signed from
// dist/ right after this hook). `release.mjs` checks the packages for it.
const dropDebugFileFromPackages = (): Plugin => ({
  name: "drop-cep-debug-file-from-packages",
  enforce: "post",
  generateBundle(_options, bundle) {
    if (isPackage) delete bundle[".debug"];
  },
});

export default defineConfig({
  plugins: [react(), cep(config), dropDebugFileFromPackages()],
  resolve: {
    alias: [{ find: "@esTypes", replacement: path.resolve(__dirname, "src") }],
  },
  define: {
    __APP_VERSION__: JSON.stringify(cepConfig.version),
    __SECURE_BUILD__: secureBuild,
    __RELEASE_BUILD__: releaseBuild,
  },
  root,
  clearScreen: false,
  server: {
    port: cepConfig.port,
  },
  preview: {
    port: cepConfig.servePort,
  },

  build: {
    sourcemap: isPackage ? cepConfig.zxp.sourceMap : cepConfig.build?.sourceMap,
    watch: {
      include: "src/jsx/**",
    },
    rollupOptions: {
      input,
      output: {
        manualChunks: {},
        preserveModules: false,
        format: "cjs",
        entryFileNames: "assets/[name]-[hash].cjs",
        chunkFileNames: "assets/[name]-[hash].cjs",
      },
    },
    target: "chrome74",
    outDir,
  },
});

// rollup es3 build
const outPathExtendscript = path.join("dist", cepDist, "jsx", "index.js");
extendscriptConfig(`src/jsx/index.ts`, outPathExtendscript, cepConfig, extensions, isProduction, isPackage);
