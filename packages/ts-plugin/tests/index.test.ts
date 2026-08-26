import { describe, expect, it } from "vitest";
import * as ts from "typescript";
import { createTestEnv, positionOf } from "./test-harness.js";
import init from "../src/index.js";

const SOURCE = `
import { Struct, Text, Define } from "morphz";

export const Slug = Define(Text, {
  description: "Friendly slug of #entityName",
  regex: /^[a-z0-9-]+$/,
  examples: ["my-slug"],
});

export class User extends Struct({ name: Text(), username: Slug() }, {}) {}
`;

/**
 * Minimal fake `PluginCreateInfo` — the proxy's own logic only reads
 * `.languageService` and `.project.getCurrentDirectory()` /
 * `.project.projectService.logger.info()` (best-effort, wrapped in
 * try/catch), matching the real fields every `features/*.ts` wrapper
 * already relies on.
 */
function fakeInfo(languageService: ts.LanguageService): ts.server.PluginCreateInfo {
  return {
    languageService,
    project: {
      getCurrentDirectory: () => process.cwd(),
      projectService: { logger: { info: () => {} } },
    },
  } as unknown as ts.server.PluginCreateInfo;
}

describe("plugin init/create", () => {
  it("returns a PluginModule whose create() builds a working proxy language service", () => {
    const { languageService } = createTestEnv(SOURCE);
    const pluginModule = init({ typescript: ts as unknown as typeof import("typescript/lib/tsserverlibrary.js") });
    expect(pluginModule.create).toBeTypeOf("function");

    const proxy = pluginModule.create(fakeInfo(languageService));
    expect(proxy.getQuickInfoAtPosition).toBeTypeOf("function");
    expect(proxy.getCompletionsAtPosition).toBeTypeOf("function");
    expect(proxy.getSemanticDiagnostics).toBeTypeOf("function");
  });

  it("passes through an untouched LS method unchanged (pure pass-through decorator)", () => {
    const { languageService, sourceFile } = createTestEnv(SOURCE);
    const pluginModule = init({ typescript: ts as unknown as typeof import("typescript/lib/tsserverlibrary.js") });
    const proxy = pluginModule.create(fakeInfo(languageService));

    const prior = languageService.getSyntacticDiagnostics(sourceFile.fileName);
    const result = proxy.getSyntacticDiagnostics(sourceFile.fileName);
    expect(result).toEqual(prior);
  });

  it("enriches hover through the proxy end-to-end", () => {
    const { languageService, sourceFile } = createTestEnv(SOURCE);
    const pluginModule = init({ typescript: ts as unknown as typeof import("typescript/lib/tsserverlibrary.js") });
    const proxy = pluginModule.create(fakeInfo(languageService));

    const pos = positionOf(SOURCE, "username: Slug()") + "username: ".length;
    const result = proxy.getQuickInfoAtPosition(sourceFile.fileName, pos);

    expect(result).toBeDefined();
    const docText = (result!.documentation ?? []).map((p) => p.text).join("");
    expect(docText).toContain("Friendly slug of #entityName");
    expect(docText).toContain("^[a-z0-9-]+$");
  });

  it("appends diagnostics through the proxy for a bad post-hook path", () => {
    const badSource = `
import { Struct, Text } from "morphz";

export class User extends Struct(
  { name: Text() },
  { post: (val, ctx) => { ctx.addIssue({ path: ["nope"], message: "bad" }); } },
) {}
`;
    const { languageService, sourceFile } = createTestEnv(badSource);
    const pluginModule = init({ typescript: ts as unknown as typeof import("typescript/lib/tsserverlibrary.js") });
    const proxy = pluginModule.create(fakeInfo(languageService));

    const result = proxy.getSemanticDiagnostics(sourceFile.fileName);
    expect(result.some((d) => d.code === 900002)).toBe(true);
  });
});
