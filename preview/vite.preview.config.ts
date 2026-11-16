// Dev-only preview harness config (see shims.js). Serves the real panel
// source with the host faked, for screenshots. Never used by the build.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

const ROOT = path.resolve(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8"));

export default defineConfig({
  root: ROOT,
  plugins: [
    react(),
    {
      name: "preview-mock-analyze",
      enforce: "pre",
      resolveId(source, importer) {
        if (importer && importer.replace(/\\/g, "/").endsWith("src/js/main/main.tsx") && source === "../lib/analyze") {
          return path.resolve(__dirname, "mocks/analyze.ts");
        }
        return null;
      },
    },
  ],
  resolve: { alias: [{ find: "@esTypes", replacement: path.resolve(ROOT, "src") }] },
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __SECURE_BUILD__: false, __RELEASE_BUILD__: false },
  server: { port: 5199, strictPort: true, fs: { allow: [ROOT] } },
  logLevel: "warn",
});
