import type * as ts from "typescript/lib/tsserverlibrary.js";
import { wrapCompletions } from "./features/completions.js";
import { wrapDiagnostics } from "./features/diagnostics.js";
import { wrapHover } from "./features/hover.js";
import { resolveLocale } from "./resolve-locale.js";

/**
 * `morphz` TS Language Service Plugin — pass-through proxy over the real
 * language service, enriching hover/completions/diagnostics for `Struct`/
 * `Define` fields. Every override degrades to the prior/unmodified result
 * on internal error (see each `features/*.ts` wrapper) — the proxy layer
 * itself never throws either, so a broken plugin can't take down tsserver.
 */
function init(_mod: { typescript: typeof ts }): ts.server.PluginModule {
  function create(info: ts.server.PluginCreateInfo): ts.LanguageService {
    try {
      const locale = resolveLocale(info.project.getCurrentDirectory());
      info.project.projectService.logger.info(`[morphz] plugin active, locale=${locale}`);
    } catch {
      // logging is best-effort — never block plugin creation over it
    }

    const proxy: ts.LanguageService = Object.create(null);
    for (const key of Object.keys(info.languageService) as (keyof ts.LanguageService)[]) {
      const target = info.languageService[key];
      // @ts-expect-error — standard pass-through decorator pattern, generic index signature
      proxy[key] = (...args: unknown[]) =>
        (target as (...a: unknown[]) => unknown).apply(info.languageService, args);
    }

    proxy.getQuickInfoAtPosition = wrapHover(info, _mod.typescript);
    proxy.getCompletionsAtPosition = wrapCompletions(info, _mod.typescript);
    proxy.getSemanticDiagnostics = wrapDiagnostics(info, _mod.typescript);

    return proxy;
  }

  return { create };
}

// `export =` (not `export default`) is deliberate: tsserver loads plugins
// via `require()` expecting the module's export to BE the init function
// directly (`module.exports = init`), matching the official TS wiki's
// pattern exactly. A default export would compile (with esbuild/tsup's
// CJS output) to `exports.default = init` instead — `require()`-ing that
// gives tsserver an object, not a callable, breaking plugin loading
// silently (no error, the plugin just never activates). `export =` is
// valid TypeScript syntax alongside `import type` statements; esbuild
// (tsup's transform) maps it straight to `module.exports = init` in the
// CJS build output — verified directly against `dist/index.cjs`.
export = init;
