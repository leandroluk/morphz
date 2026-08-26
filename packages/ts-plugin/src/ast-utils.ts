import type * as TS from "typescript/lib/tsserverlibrary.js";

/**
 * Standard `ts.forEachChild` descent to the deepest node containing
 * `position` — the well-known `getTokenAtPosition`-style traversal every
 * TS tooling project reimplements (no public API exports this directly).
 */
export function findNodeAtPosition(
  ts: typeof TS,
  sourceFile: TS.SourceFile,
  position: number,
): TS.Node {
  function find(node: TS.Node): TS.Node {
    const child = ts.forEachChild(node, (n) => {
      if (position >= n.getStart(sourceFile) && position < n.getEnd()) {
        return find(n);
      }
      return undefined;
    });
    return child ?? node;
  }
  return find(sourceFile);
}

/** Walks `node`'s ancestors (via `.parent`) until `predicate` matches, or root. */
export function findAncestor<T extends TS.Node>(
  node: TS.Node,
  predicate: (n: TS.Node) => n is T,
): T | undefined {
  let current: TS.Node | undefined = node;
  while (current) {
    if (predicate(current)) return current;
    current = current.parent;
  }
  return undefined;
}

export interface StructCallInfo {
  fields: TS.ObjectLiteralExpression;
  options?: TS.ObjectLiteralExpression;
}

/**
 * Resolves a call expression's callee identifier to its declaration's
 * originating module specifier, checking it's the named export from a
 * module resolving to `morphz` (handles both `morphz` itself and any
 * deep-path re-export, matched loosely by module symbol name to keep this
 * robust across the workspace-vs-published package name difference).
 */
function calleeIsNamedExportOf(
  ts: typeof TS,
  checker: TS.TypeChecker,
  callee: TS.Expression,
  exportName: string,
): boolean {
  if (!ts.isIdentifier(callee)) return false;
  const symbol = checker.getSymbolAtLocation(callee);
  if (!symbol) return false;
  const resolved = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  if (resolved.getName() !== exportName) return false;
  const decl = resolved.declarations?.[0];
  if (!decl) return false;
  const declSourceFile = decl.getSourceFile();
  // Real morphz package resolves through node_modules/morphz -> packages/core's
  // dist/build output OR (in a source-level workspace check) packages/core/src —
  // matched loosely by path segment rather than an exact string, to be robust to
  // whichever of dist/.d.ts or src/.ts TS actually resolved for this project.
  return /[/\\]morphz[/\\]|[/\\]packages[/\\]core[/\\]/.test(declSourceFile.fileName);
}

/**
 * `node` is a `CallExpression` whose callee resolves to `morphz`'s `Struct`
 * export. Returns the call's `fields` (arg 0, expected `ObjectLiteralExpression`)
 * and `options` (arg 1, optional `ObjectLiteralExpression`).
 */
export function isStructCallExpression(
  ts: typeof TS,
  checker: TS.TypeChecker,
  node: TS.Node,
): StructCallInfo | undefined {
  if (!ts.isCallExpression(node)) return undefined;
  if (!calleeIsNamedExportOf(ts, checker, node.expression, "Struct")) return undefined;
  const fieldsArg = node.arguments[0];
  if (!fieldsArg || !ts.isObjectLiteralExpression(fieldsArg)) return undefined;
  const optionsArg = node.arguments[1];
  const options =
    optionsArg && ts.isObjectLiteralExpression(optionsArg) ? optionsArg : undefined;
  return { fields: fieldsArg, options };
}

export interface DefineCallInfo {
  baseType: TS.Expression;
  options?: TS.ObjectLiteralExpression;
}

/** Same idea as `isStructCallExpression`, for `morphz`'s `Define` export. */
export function isDefineCallExpression(
  ts: typeof TS,
  checker: TS.TypeChecker,
  node: TS.Node,
): DefineCallInfo | undefined {
  if (!ts.isCallExpression(node)) return undefined;
  if (!calleeIsNamedExportOf(ts, checker, node.expression, "Define")) return undefined;
  const baseType = node.arguments[0];
  if (!baseType) return undefined;
  const optionsArg = node.arguments[1];
  const options =
    optionsArg && ts.isObjectLiteralExpression(optionsArg) ? optionsArg : undefined;
  return { baseType, options };
}

/** Finds a `PropertyAssignment` by key inside an object literal. */
export function getObjectLiteralProperty(
  ts: typeof TS,
  obj: TS.ObjectLiteralExpression,
  name: string,
): TS.PropertyAssignment | undefined {
  for (const prop of obj.properties) {
    if (
      ts.isPropertyAssignment(prop) &&
      ((ts.isIdentifier(prop.name) && prop.name.text === name) ||
        (ts.isStringLiteral(prop.name) && prop.name.text === name))
    ) {
      return prop;
    }
  }
  return undefined;
}
