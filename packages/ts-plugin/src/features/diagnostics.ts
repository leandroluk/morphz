import type * as TS from "typescript/lib/tsserverlibrary.js";
import { getObjectLiteralProperty, isStructCallExpression } from "../ast-utils.js";

const BROKEN_TEMPLATE_CODE = 900001;
const BAD_POST_PATH_CODE = 900002;
const PLACEHOLDER_RE = /#(\w+)/g;

function fieldNames(ts: typeof TS, fields: TS.ObjectLiteralExpression): Set<string> {
  const names = new Set<string>();
  for (const prop of fields.properties) {
    if (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) {
      if (ts.isIdentifier(prop.name)) names.add(prop.name.text);
      else if (ts.isStringLiteral(prop.name)) names.add(prop.name.text);
    }
  }
  return names;
}

function labelKeys(ts: typeof TS, options: TS.ObjectLiteralExpression | undefined): Set<string> {
  const keys = new Set<string>();
  const labels = options && getObjectLiteralProperty(ts, options, "labels")?.initializer;
  if (labels && ts.isObjectLiteralExpression(labels)) {
    for (const prop of labels.properties) {
      if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) keys.add(prop.name.text);
    }
  }
  return keys;
}

/**
 * (a) Broken template: an INLINE `description` string literal directly
 * present inside a Struct's own `fields` object (e.g. `Slug({description:
 * 'User #foo'})`) — deliberately NOT following the `Define` chain like
 * `resolveFieldInfo` does for hover, since a diagnostic needs an accurate
 * LOCAL position to point at; a description inherited from a `Define`
 * declared elsewhere isn't this Struct call's own literal to flag.
 */
function checkBrokenTemplates(
  ts: typeof TS,
  sourceFile: TS.SourceFile,
  fields: TS.ObjectLiteralExpression,
  labels: Set<string>,
): TS.Diagnostic[] {
  const diagnostics: TS.Diagnostic[] = [];

  for (const prop of fields.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const call = prop.initializer;
    if (!ts.isCallExpression(call)) continue;
    const arg0 = call.arguments[0];
    if (!arg0 || !ts.isObjectLiteralExpression(arg0)) continue;
    const descProp = getObjectLiteralProperty(ts, arg0, "description");
    const descValue = descProp?.initializer;
    if (!descValue || !ts.isStringLiteral(descValue)) continue;

    const text = descValue.text;
    const stringStart = descValue.getStart(sourceFile) + 1; // skip opening quote
    for (const match of text.matchAll(PLACEHOLDER_RE)) {
      const name = match[1];
      if (name === undefined || labels.has(name)) continue;
      diagnostics.push({
        file: sourceFile,
        start: stringStart + (match.index ?? 0),
        length: match[0].length,
        messageText: `Label '#${name}' is not defined in this Struct's labels (morphz.config.ts's global auto-derivation, if any, can't be statically checked — this may be a false positive).`,
        category: ts.DiagnosticCategory.Warning,
        code: BROKEN_TEMPLATE_CODE,
        source: "morphz",
      });
    }
  }

  return diagnostics;
}

/**
 * (b) Bad `post`-hook path: every `ctx.addIssue({ path: [...] })` call
 * inside the Struct's `options.post` hook body, checked against that
 * Struct's own field names (first path segment only).
 */
function checkPostHookPaths(
  ts: typeof TS,
  sourceFile: TS.SourceFile,
  options: TS.ObjectLiteralExpression | undefined,
  fields: Set<string>,
): TS.Diagnostic[] {
  const diagnostics: TS.Diagnostic[] = [];
  if (!options) return diagnostics;

  const postProp = getObjectLiteralProperty(ts, options, "post");
  const postFn = postProp?.initializer;
  if (!postFn || !(ts.isArrowFunction(postFn) || ts.isFunctionExpression(postFn))) {
    return diagnostics;
  }

  function visit(node: TS.Node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "addIssue"
    ) {
      const arg0 = node.arguments[0];
      if (arg0 && ts.isObjectLiteralExpression(arg0)) {
        const pathProp = getObjectLiteralProperty(ts, arg0, "path");
        const pathValue = pathProp?.initializer;
        if (pathValue && ts.isArrayLiteralExpression(pathValue)) {
          const first = pathValue.elements[0];
          if (first && ts.isStringLiteral(first) && !fields.has(first.text)) {
            diagnostics.push({
              file: sourceFile,
              start: pathValue.getStart(sourceFile),
              length: pathValue.getWidth(sourceFile),
              messageText: `Field '${first.text}' does not exist on this entity.`,
              category: ts.DiagnosticCategory.Warning,
              code: BAD_POST_PATH_CODE,
              source: "morphz",
            });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(postFn.body);

  return diagnostics;
}

/**
 * `getSemanticDiagnostics` wrapper (REQ-004): walks the whole `SourceFile`
 * once, appending broken-template and bad-post-path warnings onto TS's own
 * prior diagnostics array — never replaces it. Degrades to the prior array
 * untouched on any internal error; never throws (a throwing LS method can
 * degrade the whole editor's TS experience, not just this plugin's feature).
 */
export function wrapDiagnostics(
  info: TS.server.PluginCreateInfo,
  ts: typeof TS,
): TS.LanguageService["getSemanticDiagnostics"] {
  return (fileName: string) => {
    const prior = info.languageService.getSemanticDiagnostics(fileName);

    try {
      const program = info.languageService.getProgram();
      const maybeSourceFile = program?.getSourceFile(fileName);
      const maybeChecker = program?.getTypeChecker();
      if (!program || !maybeSourceFile || !maybeChecker) return prior;
      const sourceFile: TS.SourceFile = maybeSourceFile;
      const checker: TS.TypeChecker = maybeChecker;

      const extra: TS.Diagnostic[] = [];

      function visit(node: TS.Node) {
        const structInfo = isStructCallExpression(ts, checker, node);
        if (structInfo) {
          const labels = labelKeys(ts, structInfo.options);
          extra.push(...checkBrokenTemplates(ts, sourceFile, structInfo.fields, labels));
          extra.push(
            ...checkPostHookPaths(
              ts,
              sourceFile,
              structInfo.options,
              fieldNames(ts, structInfo.fields),
            ),
          );
        }
        ts.forEachChild(node, visit);
      }
      visit(sourceFile);

      return extra.length > 0 ? [...prior, ...extra] : prior;
    } catch {
      return prior;
    }
  };
}
