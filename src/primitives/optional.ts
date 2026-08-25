import type { FieldDescriptor, FieldDescriptorFactory } from '../core/field-descriptor.js'

export function Optional<T>(
  inner: FieldDescriptorFactory<T> | FieldDescriptor<T>,
): FieldDescriptor<T | undefined> {
  const descriptor = typeof inner === 'function' ? inner() : inner
  return {
    zodSchema: descriptor.zodSchema.optional(),
    meta: descriptor.meta as never,
    itemDescriptor: descriptor.itemDescriptor,
    targetStruct: descriptor.targetStruct,
  }
}
