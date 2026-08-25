import type { FieldDescriptor } from "../field-descriptor.js";
import { extractFieldConstraints, type JsDocTag } from "./extract-constraints.js";
import { sanitizeExample } from "./sanitize-example.js";

export interface FieldJsDoc {
  description: string;
  tags: JsDocTag[];
}

/**
 * Resolves a `description` that MAY be an i18n locale map at runtime
 * (duck-typed — `FieldDescriptorMeta.description` is typed `string`
 * today, but this stays defensive for a future/loosened shape rather than
 * assuming callers never pass one). Falls back to `fallbackLocale`, then
 * the first available key, then an empty string.
 */
function resolveDescription(description: unknown, locale: string, fallbackLocale?: string): string {
  if (typeof description === "string") return description;
  if (description && typeof description === "object") {
    const map = description as Record<string, string>;
    return (
      map[locale] ??
      (fallbackLocale ? map[fallbackLocale] : undefined) ??
      Object.values(map)[0] ??
      ""
    );
  }
  return "";
}

/**
 * Composes the full `{ description, tags }` JSDoc payload for one field,
 * per INSIGHT.md §10's mapping table. Build-time only — locale resolves
 * from `config.locale.default`/`fallback` (passed in), never
 * `AsyncLocalStorage` (no request context exists at build time).
 */
export function buildFieldTags(
  descriptor: FieldDescriptor,
  locale: string,
  fallbackLocale?: string,
): FieldJsDoc {
  const tags: JsDocTag[] = [];
  const meta = descriptor.meta;

  if (meta.default !== undefined) {
    const value =
      typeof meta.default === "function" ? (meta.default as () => unknown)() : meta.default;
    tags.push({ tagName: "default", text: sanitizeExample(value) });
  }
  for (const example of meta.examples ?? []) {
    tags.push({ tagName: "example", text: sanitizeExample(example) });
  }
  if (meta.immutable) tags.push({ tagName: "readonly" });
  if (meta.writeOnly) tags.push({ tagName: "writeOnly" });
  tags.push(...extractFieldConstraints(descriptor.zodSchema));

  return {
    description: resolveDescription(meta.description, locale, fallbackLocale),
    tags,
  };
}
