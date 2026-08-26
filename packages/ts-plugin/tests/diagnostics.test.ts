import { describe, expect, it } from "vitest";
import * as ts from "typescript";
import { createTestEnv } from "./test-harness.js";
import { wrapDiagnostics } from "../src/features/diagnostics.js";

/** Minimal fake `PluginCreateInfo` — wrapDiagnostics only reads `.languageService`. */
function fakeInfo(languageService: ts.LanguageService): ts.server.PluginCreateInfo {
  return { languageService } as unknown as ts.server.PluginCreateInfo;
}

const BROKEN_TEMPLATE_SOURCE = `
import { Struct, Text } from "morphz";

export class User extends Struct(
  { username: Text({ description: "User #foo" }) },
  { labels: { entityName: "User" } },
);
`;

const VALID_TEMPLATE_SOURCE = `
import { Struct, Text } from "morphz";

export class User extends Struct(
  { username: Text({ description: "User #entityName" }) },
  { labels: { entityName: "User" } },
);
`;

const BAD_POST_PATH_SOURCE = `
import { Struct, Text } from "morphz";

export class User extends Struct(
  { name: Text() },
  {
    labels: { entityName: "User" },
    post: (val, ctx) => {
      ctx.addIssue({ path: ["nope"], message: "bad" });
    },
  },
);
`;

const VALID_POST_PATH_SOURCE = `
import { Struct, Text } from "morphz";

export class User extends Struct(
  { name: Text() },
  {
    labels: { entityName: "User" },
    post: (val, ctx) => {
      ctx.addIssue({ path: ["name"], message: "bad" });
    },
  },
);
`;

describe("wrapDiagnostics", () => {
  it("flags a #placeholder with no matching label (positive)", () => {
    const { languageService, sourceFile } = createTestEnv(BROKEN_TEMPLATE_SOURCE);
    const diagnostics = wrapDiagnostics(fakeInfo(languageService), ts);
    const result = diagnostics(sourceFile.fileName);

    const ours = result.filter((d) => d.source === "morphz");
    expect(ours).toHaveLength(1);
    expect(ours[0]?.code).toBe(900001);
    expect(String(ours[0]?.messageText)).toContain("#foo");
  });

  it("does not flag a #placeholder that matches a real label (negative)", () => {
    const { languageService, sourceFile } = createTestEnv(VALID_TEMPLATE_SOURCE);
    const diagnostics = wrapDiagnostics(fakeInfo(languageService), ts);
    const result = diagnostics(sourceFile.fileName);

    expect(result.filter((d) => d.source === "morphz")).toHaveLength(0);
  });

  it("flags a post-hook ctx.addIssue path referencing a nonexistent field (positive)", () => {
    const { languageService, sourceFile } = createTestEnv(BAD_POST_PATH_SOURCE);
    const diagnostics = wrapDiagnostics(fakeInfo(languageService), ts);
    const result = diagnostics(sourceFile.fileName);

    const ours = result.filter((d) => d.source === "morphz");
    expect(ours).toHaveLength(1);
    expect(ours[0]?.code).toBe(900002);
    expect(String(ours[0]?.messageText)).toContain("nope");
  });

  it("does not flag a post-hook path referencing a real field (negative)", () => {
    const { languageService, sourceFile } = createTestEnv(VALID_POST_PATH_SOURCE);
    const diagnostics = wrapDiagnostics(fakeInfo(languageService), ts);
    const result = diagnostics(sourceFile.fileName);

    expect(result.filter((d) => d.source === "morphz")).toHaveLength(0);
  });

  it("still returns TS's own prior diagnostics untouched", () => {
    const { languageService, sourceFile } = createTestEnv(VALID_TEMPLATE_SOURCE);
    const prior = languageService.getSemanticDiagnostics(sourceFile.fileName);
    const diagnostics = wrapDiagnostics(fakeInfo(languageService), ts);
    const result = diagnostics(sourceFile.fileName);

    for (const p of prior) {
      expect(result).toContain(p);
    }
  });
});
