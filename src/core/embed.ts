import type { FieldDescriptor } from "./field-descriptor.js";
import { STRUCT_META, type StructConstructorLike } from "./struct-meta.js";

/**
 * Wraps another Struct class for use as a nested value-object field.
 * Reuses the target's validation-only STRUCT_META.schema, then appends
 * its OWN instantiation transform binding the CONCRETE target class
 * (never `this`/polymorphic — Embed always knows its target statically).
 */
export function Embed<T>(TargetStruct: StructConstructorLike<T>): FieldDescriptor<T> {
  const targetMeta = TargetStruct[STRUCT_META];
  const zodSchema = targetMeta.schema.transform((data: unknown) => new TargetStruct(data) as T);

  return {
    zodSchema,
    meta: {},
    targetStruct: () => TargetStruct,
  };
}
