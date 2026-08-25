import type { FieldDescriptor } from "./field-descriptor.js";
import { STRUCT_META, type StructClass } from "./struct-meta.js";

function maskFieldValue(value: unknown, descriptor: FieldDescriptor): unknown {
  if (value == null) return value;

  if (Array.isArray(value)) {
    const item = descriptor.itemDescriptor;
    return item ? value.map((v) => maskFieldValue(v, item)) : value;
  }

  if (
    descriptor.targetStruct &&
    typeof value === "object" &&
    "toMaskedJSON" in value &&
    typeof (value as { toMaskedJSON: unknown }).toMaskedJSON === "function"
  ) {
    return (value as { toMaskedJSON(): unknown }).toMaskedJSON();
  }

  const masked = descriptor.meta.mask ? descriptor.meta.mask(value) : value;
  return descriptor.meta.encode ? descriptor.meta.encode(masked) : masked;
}

/**
 * Serializes a Struct instance like `.toJSON()` (same `writeOnly`
 * omission, same `Embed`/`Ref`/`List`/`encode` handling) but additionally
 * applies each field's `meta.mask` redaction BEFORE `meta.encode` — nested
 * `Embed`/`Ref` instances recurse via their own `.toMaskedJSON()`, never
 * `.toJSON()`, so masking propagates through the whole structure.
 */
export function toMaskedJSON(
  instance: Record<string, unknown>,
  structMetaSymbol: typeof STRUCT_META = STRUCT_META,
): Record<string, unknown> {
  const structClass = (instance as { constructor: StructClass }).constructor;
  const meta = structClass[structMetaSymbol];
  const out: Record<string, unknown> = {};

  for (const [key, descriptor] of Object.entries(meta.fields)) {
    if (descriptor.meta.writeOnly) continue;
    out[key] = maskFieldValue(instance[key], descriptor);
  }

  return out;
}
