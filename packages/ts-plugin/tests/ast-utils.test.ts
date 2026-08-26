import { describe, expect, it } from "vitest";
import * as ts from "typescript";
import { createTestEnv, positionOf } from "./test-harness.js";
import {
  findNodeAtPosition,
  isStructCallExpression,
  isDefineCallExpression,
  getObjectLiteralProperty,
  findAncestor,
} from "../src/ast-utils.js";

const SOURCE = `
import { Struct, Text, Define } from "morphz";

export const Slug = Define(Text, {
  description: "Friendly slug of #entityName",
  regex: /^[a-z0-9-]+$/,
});

export class User extends Struct({ name: Text(), username: Slug() }, {}) {}
`;

describe("ast-utils: isStructCallExpression", () => {
  it("recognizes a real Struct(...) call against the real morphz package", () => {
    const { sourceFile, checker } = createTestEnv(SOURCE);
    const pos = positionOf(SOURCE, "Struct({");
    const node = findNodeAtPosition(ts, sourceFile, pos + 1);
    const callExpr = findAncestor(node, ts.isCallExpression);
    expect(callExpr).toBeDefined();

    const info = isStructCallExpression(ts, checker, callExpr!);
    expect(info).toBeDefined();
    expect(info!.fields.properties.length).toBe(2);
  });

  it("returns undefined for a non-Struct call", () => {
    const { sourceFile, checker } = createTestEnv(SOURCE);
    const pos = positionOf(SOURCE, "Define(Text");
    const node = findNodeAtPosition(ts, sourceFile, pos + 1);
    const callExpr = findAncestor(node, ts.isCallExpression);
    expect(callExpr).toBeDefined();
    expect(isStructCallExpression(ts, checker, callExpr!)).toBeUndefined();
  });
});

describe("ast-utils: isDefineCallExpression", () => {
  it("recognizes a real Define(...) call against the real morphz package", () => {
    const { sourceFile, checker } = createTestEnv(SOURCE);
    const pos = positionOf(SOURCE, "Define(Text");
    const node = findNodeAtPosition(ts, sourceFile, pos + 1);
    const callExpr = findAncestor(node, ts.isCallExpression);
    expect(callExpr).toBeDefined();

    const info = isDefineCallExpression(ts, checker, callExpr!);
    expect(info).toBeDefined();
    expect(info!.options).toBeDefined();
  });
});

describe("ast-utils: getObjectLiteralProperty", () => {
  it("finds a property by identifier key", () => {
    const { sourceFile, checker } = createTestEnv(SOURCE);
    const pos = positionOf(SOURCE, "Define(Text");
    const node = findNodeAtPosition(ts, sourceFile, pos + 1);
    const callExpr = findAncestor(node, ts.isCallExpression);
    const info = isDefineCallExpression(ts, checker, callExpr!);
    const descProp = getObjectLiteralProperty(ts, info!.options!, "description");
    expect(descProp).toBeDefined();
    expect(ts.isStringLiteral(descProp!.initializer)).toBe(true);
    expect((descProp!.initializer as ts.StringLiteral).text).toBe(
      "Friendly slug of #entityName",
    );
  });

  it("returns undefined for a missing key", () => {
    const { sourceFile, checker } = createTestEnv(SOURCE);
    const pos = positionOf(SOURCE, "Define(Text");
    const node = findNodeAtPosition(ts, sourceFile, pos + 1);
    const callExpr = findAncestor(node, ts.isCallExpression);
    const info = isDefineCallExpression(ts, checker, callExpr!);
    expect(getObjectLiteralProperty(ts, info!.options!, "nonexistent")).toBeUndefined();
  });
});
