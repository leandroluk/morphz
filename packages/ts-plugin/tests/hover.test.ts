import { describe, expect, it } from "vitest";
import * as ts from "typescript";
import { createTestEnv, positionOf } from "./test-harness.js";
import { wrapHover } from "../src/features/hover.js";

const SOURCE = `
import { Struct, Text, Define } from "morphz";

export const Slug = Define(Text, {
  description: "Friendly slug of #entityName",
  regex: /^[a-z0-9-]+$/,
  examples: ["my-slug"],
});

export class User extends Struct({ name: Text(), username: Slug() }, {}) {}
`;

/** Minimal fake `PluginCreateInfo` — wrapHover only reads `.languageService`. */
function fakeInfo(languageService: ts.LanguageService): ts.server.PluginCreateInfo {
  return { languageService } as unknown as ts.server.PluginCreateInfo;
}

describe("wrapHover", () => {
  it("appends resolved description/regex/examples/origin onto the prior hover", () => {
    const { languageService, sourceFile } = createTestEnv(SOURCE);
    const hover = wrapHover(fakeInfo(languageService), ts);

    const pos = positionOf(SOURCE, "username: Slug()") + "username: ".length;
    const result = hover(sourceFile.fileName, pos);

    expect(result).toBeDefined();
    const docText = (result!.documentation ?? []).map((p) => p.text).join("");
    expect(docText).toContain("Friendly slug of #entityName");
    expect(docText).toContain("^[a-z0-9-]+$");
    expect(docText).toContain("my-slug");
    expect(docText).toContain("Text");
    expect(docText).toContain("Slug");
  });

  it("still returns the original hover's display parts (property type) untouched", () => {
    const { languageService, sourceFile } = createTestEnv(SOURCE);
    const hover = wrapHover(fakeInfo(languageService), ts);
    const pos = positionOf(SOURCE, "username: Slug()") + "username: ".length;

    const prior = languageService.getQuickInfoAtPosition(sourceFile.fileName, pos);
    const result = hover(sourceFile.fileName, pos);

    expect(result!.displayParts).toEqual(prior!.displayParts);
  });

  it("returns the prior result untouched when hovering somewhere unrelated", () => {
    const { languageService, sourceFile } = createTestEnv(SOURCE);
    const hover = wrapHover(fakeInfo(languageService), ts);

    const pos = positionOf(SOURCE, "class User");
    const prior = languageService.getQuickInfoAtPosition(sourceFile.fileName, pos);
    const result = hover(sourceFile.fileName, pos);

    expect(result).toEqual(prior);
  });
});
