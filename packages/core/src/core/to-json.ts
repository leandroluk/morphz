import type { FieldDescriptor } from "./field-descriptor.js";
import { STRUCT_META, type StructClass } from "./struct-meta.js";

function encodeFieldValue(value: unknown, descriptor: FieldDescriptor): unknown {
  if (value == null) return value;

  if (Array.isArray(value)) {
    const item = descriptor.itemDescriptor;
    return item ? value.map((v) => encodeFieldValue(v, item)) : value;
  }

  if (
    descriptor.targetStruct &&
    typeof value === "object" &&
    "toJSON" in value &&
    typeof (value as { toJSON: unknown }).toJSON === "function"
  ) {
    return (value as { toJSON(): unknown }).toJSON();
  }

  return descriptor.meta.encode ? descriptor.meta.encode(value) : value;
}

/**
 * Serializes a Struct instance to a plain JSON-compatible object. Skips
 * `writeOnly` fields entirely, recurses into `Embed`/`Ref` instances via
 * their own `.toJSON()`, maps `List` items via `itemDescriptor`, applies
 * `meta.encode` for codec fields (e.g. DateTime -> ISO string).
 */
export function toJSON(
  instance: Record<string, unknown>,
  structMetaSymbol: typeof STRUCT_META = STRUCT_META,
): Record<string, unknown> {
  const structClass = (instance as { constructor: StructClass }).constructor;
  const meta = structClass[structMetaSymbol];
  const out: Record<string, unknown> = {};

  for (const [key, descriptor] of Object.entries(meta.fields)) {
    if (descriptor.meta.writeOnly) continue;
    out[key] = encodeFieldValue(instance[key], descriptor);
  }

  return out;
}
