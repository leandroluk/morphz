import type * as ts from "typescript/lib/tsserverlibrary.js";

/**
 * Scaffold only — real hover/completion/diagnostics logic lands with the
 * `ts-language-service-plugin` feature. This stub just satisfies the real
 * `ts.server.PluginModuleFactory` shape so the package builds and can be
 * wired into `packages/core`'s `exports["./ts-plugin"]` subpath.
 */
function init(_mod: { typescript: typeof ts }): ts.server.PluginModule {
  return {
    create(createInfo: ts.server.PluginCreateInfo): ts.LanguageService {
      return createInfo.languageService;
    },
  };
}

export default init;
