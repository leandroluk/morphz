import type { FieldDescriptor, FieldDescriptorFactory } from "../core/field-descriptor.js";

export function Nullable<T>(
  inner: FieldDescriptorFactory<T> | FieldDescriptor<T>,
): FieldDescriptor<T | null> {
  const descriptor = typeof inner === "function" ? inner() : inner;
  return {
    zodSchema: descriptor.zodSchema.nullable(),
    meta: descriptor.meta as never,
    itemDescriptor: descriptor.itemDescriptor,
    targetStruct: descriptor.targetStruct,
  };
}
