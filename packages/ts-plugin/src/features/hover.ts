import type * as TS from "typescript/lib/tsserverlibrary.js";
import {
  findAncestor,
  findNodeAtPosition,
  isStructCallExpression,
} from "../ast-utils.js";
import { resolveFieldInfo, type ResolvedFieldInfo } from "../resolve-field-info.js";

/**
 * Formats a `ResolvedFieldInfo` into the enrichment text appended to the
 * prior hover's `documentation`. Best-effort — omits any piece that
 * wasn't statically resolvable rather than showing a placeholder for it.
 */
function formatFieldInfo(info: ResolvedFieldInfo): string | undefined {
  const lines: string[] = [];
  if (info.description) lines.push(info.description);
  if (info.regex) lines.push(`Regex: ${info.regex}`);
  if (info.examples && info.examples.length > 0) {
    lines.push(`Examples: ${info.examples.join(", ")}`);
  }
  if (info.defineChain.length > 0) {
    lines.push(`Origin: ${info.defineChain.join(" -> ")}`);
  }
  return lines.length > 0 ? lines.join("\n") : undefined;
}

/**
 * Finds the field-declaration `PropertyAssignment` enclosing `node`, IF
 * its parent object literal is a `Struct(...)` call's `fields` argument.
 * Returns undefined for anything else (hover falls back to prior only).
 */
function findEnclosingFieldDeclaration(
  ts: typeof TS,
  checker: TS.TypeChecker,
  node: TS.Node,
): TS.PropertyAssignment | undefined {
  const property = findAncestor(node, ts.isPropertyAssignment);
  if (!property) return undefined;

  const objectLiteral = property.parent;
  if (!ts.isObjectLiteralExpression(objectLiteral)) return undefined;

  const callExpr = findAncestor(objectLiteral.parent, ts.isCallExpression);
  if (!callExpr) return undefined;

  const structInfo = isStructCallExpression(ts, checker, callExpr);
  if (!structInfo || structInfo.fields !== objectLiteral) return undefined;

  return property;
}

/**
 * `getQuickInfoAtPosition` wrapper (REQ-002): on hover over a field
 * DECLARATION site inside a `Struct({...})` call (e.g. `username: Slug()`),
 * appends the resolved description/regex/examples/Define-origin info onto
 * TS's own prior hover result — never replaces it. Degrades to the prior
 * result untouched on any internal error or unrecognized shape; never
 * throws (a throwing LS method can degrade the whole editor's TS
 * experience, not just this plugin's feature).
 */
export function wrapHover(
  info: TS.server.PluginCreateInfo,
  ts: typeof TS,
): TS.LanguageService["getQuickInfoAtPosition"] {
  return (fileName: string, position: number) => {
    const prior = info.languageService.getQuickInfoAtPosition(fileName, position);

    try {
      const program = info.languageService.getProgram();
      const sourceFile = program?.getSourceFile(fileName);
      if (!program || !sourceFile || !prior) return prior;

      const checker = program.getTypeChecker();
      const node = findNodeAtPosition(ts, sourceFile, position);
      const fieldProperty = findEnclosingFieldDeclaration(ts, checker, node);
      if (!fieldProperty) return prior;

      const fieldInfo = resolveFieldInfo(ts, checker, fieldProperty);
      const text = formatFieldInfo(fieldInfo);
      if (!text) return prior;

      return {
        ...prior,
        documentation: [...(prior.documentation ?? []), { kind: "text", text: `\n\n${text}` }],
      };
    } catch {
      return prior;
    }
  };
}
