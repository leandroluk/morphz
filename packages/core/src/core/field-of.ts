import type { FieldDescriptor, FieldDescriptorMeta } from "./field-descriptor.js";
import { mergeDescriptor } from "./merge-descriptor.js";
import { STRUCT_META, type StructConstructorLike } from "./struct-meta.js";

/**
 * Eager clone of another Struct's already-declared field shape — reuses
 * the FULL descriptor (zodSchema incl. regex/refine, and meta) EXCEPT
 * `default`/`immutable` (a FK reusing a PK's type shouldn't silently
 * inherit the PK's self-generation/write-once semantics). Not lazy: the
 * source Struct must already be fully declared (STRUCT_META populated) at
 * call time — throws synchronously, immediately, if the field is missing.
 */
export function FieldOf<S, K extends keyof S & string>(
  Source: StructConstructorLike<S>,
  fieldName: K,
  options?: Partial<FieldDescriptorMeta<S[K]>>,
): FieldDescriptor<S[K]> {
  const sourceMeta = Source[STRUCT_META];
  const sourceField = sourceMeta.fields[fieldName];

  if (!sourceField) {
    const available = Object.keys(sourceMeta.fields).join(", ");
    throw new Error(
      `FieldOf: field '${fieldName}' does not exist on the given Struct. ` +
        `Make sure the source Struct is fully declared BEFORE calling FieldOf(...) ` +
        `(available fields: ${available}).`,
    );
  }

  const { default: _default, immutable: _immutable, ...restMeta } = sourceField.meta;

  const cloned: FieldDescriptor<S[K]> = {
    zodSchema: sourceField.zodSchema as FieldDescriptor<S[K]>["zodSchema"],
    meta: { ...restMeta } as FieldDescriptorMeta<S[K]>,
    itemDescriptor: sourceField.itemDescriptor,
    targetStruct: sourceField.targetStruct,
  };

  return mergeDescriptor(cloned, options);
}
