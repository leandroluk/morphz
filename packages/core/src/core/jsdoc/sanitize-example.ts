/**
 * Escapes `@` (tsserver's JSDoc parser otherwise misreads it as a new tag
 * boundary — a real, documented quirk, not hypothetical) and fences
 * multi-line/structured values in a ```ts block, per INSIGHT.md §10.
 */
export function sanitizeExample(value: unknown): string {
  const rendered = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const escaped = rendered.replace(/@/g, "&#64;");
  return typeof value === "string" && !value.includes("\n")
    ? escaped
    : "```ts\n" + escaped + "\n```";
}
