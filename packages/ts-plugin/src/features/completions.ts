import type * as TS from "typescript/lib/tsserverlibrary.js";
import { findAncestor, findNodeAtPosition, isStructCallExpression } from "../ast-utils.js";

/**
 * `node`'s callee resolves to `morphz`'s `FieldOf` export. Loose match by
 * declaration source path, mirroring `ast-utils.ts`'s own
 * `calleeIsNamedExportOf` (kept local/private there, so re-implemented
 * minimally here rather than widening that module's exports mid-parallel
 * work on shared files).
 */
function isFieldOfCallExpression(
  ts: typeof TS,
  checker: TS.TypeChecker,
  node: TS.Node,
): { source: TS.Expression; fieldNameArg: TS.Expression } | undefined {
  if (!ts.isCallExpression(node)) return undefined;
  if (!ts.isIdentifier(node.expression)) return undefined;
  const symbol = checker.getSymbolAtLocation(node.expression);
  if (!symbol) return undefined;
  const resolved = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  if (resolved.getName() !== "FieldOf") return undefined;
  const decl = resolved.declarations?.[0];
  if (!decl) return undefined;
  if (!/[/\\]morphz[/\\]|[/\\]packages[/\\]core[/\\]/.test(decl.getSourceFile().fileName)) {
    return undefined;
  }
  const source = node.arguments[0];
  const fieldNameArg = node.arguments[1];
  if (!source || !fieldNameArg) return undefined;
  return { source, fieldNameArg };
}

/** Reads a `Struct(...)` call's `fields` object literal's property keys. */
function fieldKeysOf(ts: typeof TS, fields: TS.ObjectLiteralExpression): string[] {
  const keys: string[] = [];
  for (const prop of fields.properties) {
    if (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) {
      if (ts.isIdentifier(prop.name)) keys.push(prop.name.text);
      else if (ts.isStringLiteral(prop.name)) keys.push(prop.name.text);
    }
  }
  return keys;
}

/**
 * Resolves `sourceExpr` (an `Identifier` referring to a `class X extends
 * Struct({...}, {...}) {}`) to that `Struct(...)` call's `fields` keys.
 */
function resolveStructFieldNames(
  ts: typeof TS,
  checker: TS.TypeChecker,
  sourceExpr: TS.Expression,
): string[] | undefined {
  if (!ts.isIdentifier(sourceExpr)) return undefined;
  const symbol = checker.getSymbolAtLocation(sourceExpr);
  const decl = symbol?.declarations?.[0];
  if (!decl || !ts.isClassDeclaration(decl)) return undefined;

  const extendsClause = decl.heritageClauses?.find((h) => h.token === ts.SyntaxKind.ExtendsKeyword);
  const superExpr = extendsClause?.types[0]?.expression;
  if (!superExpr) return undefined;

  const structInfo = isStructCallExpression(ts, checker, superExpr);
  if (!structInfo) return undefined;
  return fieldKeysOf(ts, structInfo.fields);
}

/** Finds the `description`-named `PropertyAssignment` string ancestor, if any, and its enclosing `Struct(...)` call. */
function findLabelCompletionContext(
  ts: typeof TS,
  checker: TS.TypeChecker,
  node: TS.Node,
): TS.ObjectLiteralExpression | undefined {
  const stringLiteral = findAncestor(node, ts.isStringLiteral);
  if (!stringLiteral) return undefined;

  const property = findAncestor(stringLiteral, ts.isPropertyAssignment);
  if (!property) return undefined;
  const nameIsDescription =
    (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
    property.name.text === "description";
  if (!nameIsDescription) return undefined;

  const callExpr = findAncestor(property.parent.parent ?? property.parent, ts.isCallExpression);
  // Walk up through possibly-nested call expressions (Define(...)'s options,
  // or a field factory call like Email({...})) until we reach the
  // enclosing Struct(...) call itself.
  let current: TS.Node | undefined = callExpr ?? property.parent;
  while (current) {
    if (ts.isCallExpression(current)) {
      const structInfo = isStructCallExpression(ts, checker, current);
      if (structInfo?.options) return structInfo.options;
    }
    current = current.parent;
  }
  return undefined;
}

function labelKeysOf(ts: typeof TS, options: TS.ObjectLiteralExpression): string[] {
  const labelsProp = options.properties.find(
    (p): p is TS.PropertyAssignment =>
      ts.isPropertyAssignment(p) &&
      ((ts.isIdentifier(p.name) && p.name.text === "labels") ||
        (ts.isStringLiteral(p.name) && p.name.text === "labels")),
  );
  if (!labelsProp || !ts.isObjectLiteralExpression(labelsProp.initializer)) return [];
  return fieldKeysOf(ts, labelsProp.initializer);
}

/**
 * `getCompletionsAtPosition` wrapper (REQ-003): two independent trigger
 * contexts — (a) `#label` completion inside a `Struct(...)` field's
 * `description` string, (b) `FieldOf(X, "|")`'s second-argument field-name
 * completion. Merges new entries into TS's own prior result rather than
 * replacing it. Degrades to the prior result on any internal error.
 */
export function wrapCompletions(
  info: TS.server.PluginCreateInfo,
  ts: typeof TS,
): TS.LanguageService["getCompletionsAtPosition"] {
  return (fileName, position, options, formattingSettings) => {
    const prior = info.languageService.getCompletionsAtPosition(
      fileName,
      position,
      options,
      formattingSettings,
    );

    try {
      const program = info.languageService.getProgram();
      const sourceFile = program?.getSourceFile(fileName);
      if (!program || !sourceFile) return prior;
      const checker = program.getTypeChecker();
      const node = findNodeAtPosition(ts, sourceFile, position);

      const newEntries: TS.CompletionEntry[] = [];

      const structOptions = findLabelCompletionContext(ts, checker, node);
      if (structOptions) {
        for (const key of labelKeysOf(ts, structOptions)) {
          newEntries.push({
            name: `#${key}`,
            kind: ts.ScriptElementKind.string,
            sortText: "0",
          });
        }
      }

      const fieldOfCall = findAncestor(node, (n): n is TS.CallExpression => {
        return ts.isCallExpression(n) && isFieldOfCallExpression(ts, checker, n) !== undefined;
      });
      if (fieldOfCall) {
        const fieldOfInfo = isFieldOfCallExpression(ts, checker, fieldOfCall);
        if (fieldOfInfo && fieldOfInfo.fieldNameArg.getStart(sourceFile) <= position) {
          const names = resolveStructFieldNames(ts, checker, fieldOfInfo.source);
          for (const name of names ?? []) {
            newEntries.push({
              name,
              kind: ts.ScriptElementKind.memberVariableElement,
              sortText: "0",
            });
          }
        }
      }

      if (newEntries.length === 0) return prior;

      if (prior) {
        return { ...prior, entries: [...prior.entries, ...newEntries] };
      }
      return {
        isGlobalCompletion: false,
        isMemberCompletion: false,
        isNewIdentifierLocation: false,
        entries: newEntries,
      };
    } catch {
      return prior;
    }
  };
}
