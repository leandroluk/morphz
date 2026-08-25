/**
 * Resolves `#placeholder` tokens in a string against a labels record.
 * An unresolved placeholder (no matching label) is left untouched — never
 * throws. Scoped to a single `Struct(...)` call's own `labels`; callers
 * decide whether/how to recurse into nested Structs (they don't cascade).
 */
export function resolveTemplateString(input: string, labels: Record<string, string>, delimiter = '#'): string {
  const escaped = delimiter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`${escaped}([a-zA-Z_][a-zA-Z0-9_]*)`, 'g')
  return input.replace(pattern, (match, key: string) => {
    return Object.prototype.hasOwnProperty.call(labels, key) ? (labels[key] as string) : match
  })
}

function resolveMessageValue(value: unknown, labels: Record<string, string>, delimiter: string): unknown {
  if (typeof value === 'string') return resolveTemplateString(value, labels, delimiter)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = resolveMessageValue(v, labels, delimiter)
    }
    return out
  }
  return value
}

/**
 * Returns a NEW meta object with `description`/`message` template strings
 * resolved against `labels` — never mutates the input (shared `Define`
 * descriptors must stay untouched across multiple `Struct` calls).
 */
export function resolveFieldTemplates<M extends { description?: string; message?: unknown }>(
  meta: M,
  labels: Record<string, string>,
  delimiter = '#',
): M {
  const resolved: M = { ...meta }
  if (typeof resolved.description === 'string') {
    resolved.description = resolveTemplateString(resolved.description, labels, delimiter) as M['description']
  }
  if (resolved.message !== undefined) {
    resolved.message = resolveMessageValue(resolved.message, labels, delimiter) as M['message']
  }
  return resolved
}
