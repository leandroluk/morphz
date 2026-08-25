import type { FieldDescriptor } from "../core/field-descriptor.js";

/** Same zero-arg-factory convention as `Nullable`/`Define`'s `BaseTypeArg<T>`. */
export function Optional<T>(
  inner: (() => FieldDescriptor<T>) | FieldDescriptor<T>,
): FieldDescriptor<T | undefined> {
  const descriptor = typeof inner === "function" ? inner() : inner;
  return {
    zodSchema: descriptor.zodSchema.optional(),
    meta: descriptor.meta as never,
    itemDescriptor: descriptor.itemDescriptor,
    targetStruct: descriptor.targetStruct,
  };
}
