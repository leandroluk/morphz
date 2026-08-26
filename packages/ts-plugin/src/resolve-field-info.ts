import type * as TS from "typescript/lib/tsserverlibrary.js";
import { getObjectLiteralProperty, isDefineCallExpression } from "./ast-utils.js";

export interface ResolvedFieldInfo {
  description?: string;
  regex?: string;
  examples?: string[];
  /** e.g. ['Text', 'Slug'] — the primitive base plus each Define specialization name, outermost last. */
  defineChain: string[];
}

function readStringLiteral(ts: typeof TS, expr: TS.Expression | undefined): string | undefined {
  return expr && ts.isStringLiteral(expr) ? expr.text : undefined;
}

function readRegexLiteral(ts: typeof TS, expr: TS.Expression | undefined): string | undefined {
  return expr && ts.isRegularExpressionLiteral(expr) ? expr.text : undefined;
}

function readStringArrayLiteral(
  ts: typeof TS,
  expr: TS.Expression | undefined,
): string[] | undefined {
  if (!expr || !ts.isArrayLiteralExpression(expr)) return undefined;
  const out: string[] = [];
  for (const el of expr.elements) {
    if (ts.isStringLiteral(el)) out.push(el.text);
  }
  return out.length > 0 ? out : undefined;
}

/**
 * Reads description/regex/examples off ONE options object literal (either
 * a `Define(...)`'s second arg, or a field-call's own inline overrides).
 */
function readMetaFromOptions(
  ts: typeof TS,
  options: TS.ObjectLiteralExpression,
): Pick<ResolvedFieldInfo, "description" | "regex" | "examples"> {
  return {
    description: readStringLiteral(ts, getObjectLiteralProperty(ts, options, "description")?.initializer),
    regex: readRegexLiteral(ts, getObjectLiteralProperty(ts, options, "regex")?.initializer),
    examples: readStringArrayLiteral(ts, getObjectLiteralProperty(ts, options, "examples")?.initializer),
  };
}

/**
 * Given a field-declaration `PropertyAssignment` (a key inside a
 * `Struct(...)`'s `fields` object literal, e.g. `username: Slug()`),
 * resolves description/regex/examples by following the callee's
 * declaration back through any `Define(...)` chain, merging the field
 * call's OWN inline overrides on top (own args win — mirrors
 * `mergeDescriptor`'s real shallow-overwrite semantics in `packages/core`).
 *
 * Best-effort: any non-literal / non-statically-resolvable shape is simply
 * omitted from the result rather than throwing — this is a DX enrichment
 * layer, not a requirement to model every possible expression shape.
 */
export function resolveFieldInfo(
  ts: typeof TS,
  checker: TS.TypeChecker,
  fieldProperty: TS.PropertyAssignment,
): ResolvedFieldInfo {
  const result: ResolvedFieldInfo = { defineChain: [] };
  const initializer = fieldProperty.initializer;
  if (!ts.isCallExpression(initializer)) return result;

  // 1. Inline overrides on the field call itself, e.g. Email({ description: '...' }).
  const inlineArg = initializer.arguments[0];
  if (inlineArg && ts.isObjectLiteralExpression(inlineArg)) {
    Object.assign(result, readMetaFromOptions(ts, inlineArg));
  }

  // 2. Resolve the callee identifier's declaration.
  if (!ts.isIdentifier(initializer.expression)) return result;
  const symbol = checker.getSymbolAtLocation(initializer.expression);
  const resolvedSymbol =
    symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  const calleeName = resolvedSymbol?.getName();
  if (calleeName) result.defineChain.push(calleeName);

  const decl = resolvedSymbol?.declarations?.[0];
  if (!decl || !ts.isVariableDeclaration(decl) || !decl.initializer) return result;

  // 3. If the declaration is `export const X = Define(Base, {options})`,
  //    walk the whole Define chain (Base may itself be another Define call),
  //    merging from OUTERMOST-declared-base to innermost (so the field's own
  //    inline overrides, already applied above, still win last).
  let current: TS.Expression = decl.initializer;
  const chainMeta: Pick<ResolvedFieldInfo, "description" | "regex" | "examples">[] = [];
  const chainNames: string[] = [];
  while (ts.isCallExpression(current)) {
    const defineInfo = isDefineCallExpression(ts, checker, current);
    if (!defineInfo) break;
    if (defineInfo.options) chainMeta.unshift(readMetaFromOptions(ts, defineInfo.options));
    if (ts.isIdentifier(defineInfo.baseType)) {
      chainNames.unshift(defineInfo.baseType.text);
    }
    current = defineInfo.baseType;
  }

  for (const meta of chainMeta) {
    result.description = result.description ?? meta.description;
    result.regex = result.regex ?? meta.regex;
    result.examples = result.examples ?? meta.examples;
  }
  result.defineChain = [...chainNames, ...result.defineChain];

  return result;
}
