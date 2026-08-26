import { describe, expect, it } from "vitest";
import * as ts from "typescript";
import { createTestEnv, positionOf } from "./test-harness.js";
import { findNodeAtPosition, findAncestor, isStructCallExpression } from "../src/ast-utils.js";
import { resolveFieldInfo } from "../src/resolve-field-info.js";

const SOURCE = `
import { Struct, Text, Define, Email } from "morphz";

export const Slug = Define(Text, {
  description: "Friendly slug of #entityName",
  regex: /^[a-z0-9-]+$/,
  examples: ["my-slug"],
});

export class User extends Struct(
  {
    username: Slug(),
    email: Email({ description: "Work email override" }),
  },
  {},
) {}
`;

function getFieldProperty(sourceFile: ts.SourceFile, checker: ts.TypeChecker, fieldName: string) {
  const pos = positionOf(SOURCE, "Struct(");
  const node = findNodeAtPosition(ts, sourceFile, pos + 1);
  const callExpr = findAncestor(node, ts.isCallExpression);
  const info = isStructCallExpression(ts, checker, callExpr!);
  const prop = info!.fields.properties.find(
    (p): p is ts.PropertyAssignment =>
      ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === fieldName,
  );
  if (!prop) throw new Error(`field ${fieldName} not found`);
  return prop;
}

describe("resolve-field-info", () => {
  it("resolves description/regex/examples through a Define chain", () => {
    const { sourceFile, checker } = createTestEnv(SOURCE);
    const prop = getFieldProperty(sourceFile, checker, "username");
    const info = resolveFieldInfo(ts, checker, prop);

    expect(info.description).toBe("Friendly slug of #entityName");
    expect(info.regex).toBe("/^[a-z0-9-]+$/");
    expect(info.examples).toEqual(["my-slug"]);
    expect(info.defineChain).toContain("Slug");
  });

  it("merges the field's own inline overrides on top", () => {
    const { sourceFile, checker } = createTestEnv(SOURCE);
    const prop = getFieldProperty(sourceFile, checker, "email");
    const info = resolveFieldInfo(ts, checker, prop);

    expect(info.description).toBe("Work email override");
  });
});
