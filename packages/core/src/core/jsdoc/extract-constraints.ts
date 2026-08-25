// Zod's `_zod.def` is an INTERNAL API (not the public `z.*` surface) —
// same introspection pattern already used in `union.ts`/`mock.ts`. Could
// break on a Zod internal refactor across major versions, not on
// minor/patch (Zod's public-API semver promise doesn't cover this shape).

export interface JsDocTag {
  tagName: string;
  text?: string;
}

interface ZodCheckDef {
  check?: string;
  format?: string;
  pattern?: RegExp;
  minimum?: number;
  maximum?: number;
}

interface ZodDef {
  type: string;
  format?: string;
  innerType?: unknown;
  checks?: { _zod?: { def?: ZodCheckDef } }[];
}

function getDef(schema: unknown): ZodDef | undefined {
  return (schema as { _zod?: { def?: ZodDef } })._zod?.def;
}

function findChecks(schema: unknown, checkName: string): ZodCheckDef[] {
  return (getDef(schema)?.checks ?? [])
    .map((c) => c._zod?.def)
    .filter((def): def is ZodCheckDef => def?.check === checkName);
}

/**
 * Extracts `@minLength`/`@maxLength`/`@minimum`/`@maximum`/`@pattern`/
 * `@format` JSDoc tags by walking a Zod schema's own `checks` array —
 * `FieldDescriptorMeta` never stores these separately (see design.md).
 * Unwraps `optional`/`nullable`/`pipe` (codec) wrappers to reach the
 * actual constrained schema.
 */
export function extractFieldConstraints(schema: unknown): JsDocTag[] {
  const def = getDef(schema);
  if (!def) return [];

  if (def.type === "optional" || def.type === "nullable" || def.type === "default" || def.type === "prefault") {
    return extractFieldConstraints(def.innerType);
  }
  if (def.type === "pipe") {
    const inSchema = (schema as { _zod?: { def?: { in?: unknown } } })._zod?.def?.in;
    return inSchema ? extractFieldConstraints(inSchema) : [];
  }

  const tags: JsDocTag[] = [];
  const isString = def.type === "string";
  const isNumber = def.type === "number";

  for (const c of findChecks(schema, "min_length")) {
    tags.push({ tagName: isString ? "minLength" : "minSize", text: String(c.minimum) });
  }
  for (const c of findChecks(schema, "max_length")) {
    tags.push({ tagName: isString ? "maxLength" : "maxSize", text: String(c.maximum) });
  }
  if (isNumber) {
    for (const c of findChecks(schema, "greater_than")) {
      tags.push({ tagName: "minimum", text: String((c as { value?: unknown }).value) });
    }
    for (const c of findChecks(schema, "less_than")) {
      tags.push({ tagName: "maximum", text: String((c as { value?: unknown }).value) });
    }
  }
  for (const c of findChecks(schema, "string_format")) {
    if (c.format === "regex" && c.pattern) {
      tags.push({ tagName: "pattern", text: c.pattern.source });
    } else if (c.format) {
      tags.push({ tagName: "format", text: c.format });
    }
  }
  // top-level format (e.g. z.email() sets def.format directly, no separate check)
  if (isString && def.format && !tags.some((t) => t.tagName === "format")) {
    tags.push({ tagName: "format", text: def.format });
  }

  return tags;
}
