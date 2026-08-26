import { describe, expect, it } from "vitest";
import * as ts from "typescript";
import { createTestEnv, positionOf } from "./test-harness.js";
import { wrapCompletions } from "../src/features/completions.js";

/** Minimal fake `PluginCreateInfo` — wrapCompletions only reads `.languageService`. */
function fakeInfo(languageService: ts.LanguageService): ts.server.PluginCreateInfo {
  return { languageService } as unknown as ts.server.PluginCreateInfo;
}

describe("wrapCompletions", () => {
  it("suggests '#entityName' inside a Struct field's description string", () => {
    const SOURCE = `
import { Struct, Text } from "morphz";

export class User extends Struct(
  { name: Text({ description: "The name of #" }) },
  { labels: { entityName: "User", module: "Accounts" } },
) {}
`;
    const { languageService, sourceFile } = createTestEnv(SOURCE);
    const completions = wrapCompletions(fakeInfo(languageService), ts);

    const pos =
      positionOf(SOURCE, 'description: "The name of #') + 'description: "The name of #'.length;
    const result = completions(sourceFile.fileName, pos, {});

    expect(result).toBeDefined();
    const names = result!.entries.map((e) => e.name);
    expect(names).toContain("#entityName");
    expect(names).toContain("#module");
  });

  it('suggests User\'s real field names inside FieldOf(User, "|")', () => {
    const SOURCE = `
import { Struct, Text, FieldOf } from "morphz";

export class User extends Struct({ id: Text(), name: Text() }, {}) {}

export class Post extends Struct(
  { userId: FieldOf(User, "") },
  {},
) {}
`;
    const { languageService, sourceFile } = createTestEnv(SOURCE);
    const completions = wrapCompletions(fakeInfo(languageService), ts);

    const pos = positionOf(SOURCE, 'FieldOf(User, "') + 'FieldOf(User, "'.length;
    const result = completions(sourceFile.fileName, pos, {});

    expect(result).toBeDefined();
    const names = result!.entries.map((e) => e.name);
    expect(names).toContain("id");
    expect(names).toContain("name");
  });

  it("returns the prior result untouched when completing somewhere unrelated", () => {
    const SOURCE = `
import { Struct, Text } from "morphz";
export class User extends Struct({ name: Text() }, {}) {}
`;
    const { languageService, sourceFile } = createTestEnv(SOURCE);
    const completions = wrapCompletions(fakeInfo(languageService), ts);

    const pos = positionOf(SOURCE, "class User");
    const prior = languageService.getCompletionsAtPosition(sourceFile.fileName, pos, {});
    const result = completions(sourceFile.fileName, pos, {});

    expect(result).toEqual(prior);
  });
});
