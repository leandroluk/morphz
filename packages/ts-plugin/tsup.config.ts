import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  // CJS ONLY (not dual esm/cjs like packages/core): tsserver loads plugins
  // via Node's `require()` — a synchronous CommonJS load. An ESM-only
  // build would throw ERR_REQUIRE_ESM in a real tsserver process, a
  // failure invisible to unit tests that call create() directly in-process
  // (bypassing the actual module-loading step entirely).
  format: ["cjs"],
  outExtension: () => ({ js: ".cjs" }),
  dts: true,
  sourcemap: true,
  clean: true,
});
