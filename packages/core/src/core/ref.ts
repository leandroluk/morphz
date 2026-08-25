import { z } from "zod";
import type { FieldDescriptor } from "./field-descriptor.js";
import { STRUCT_META, type StructConstructorLike } from "./struct-meta.js";

/**
 * Lazy entity-to-entity reference. The thunk isn't invoked until Zod
 * actually needs the schema (first .parse() reaching this field) — by
 * then every Struct-produced class, including a self-referencing one, has
 * its STRUCT_META fully populated. Appends its OWN instantiation transform
 * (STRUCT_META.schema stays validation-only) binding the concrete class
 * resolved by the thunk — same pattern as Embed().
 */
export function Ref<T>(thunk: () => StructConstructorLike<T>): FieldDescriptor<T> {
  const zodSchema = z.lazy(() => {
    const Target = thunk();
    const targetMeta = Target[STRUCT_META];
    return targetMeta.schema.transform((data: unknown) => new Target(data) as T);
  }) as unknown as z.ZodType<T>;

  return {
    zodSchema,
    meta: {},
    targetStruct: () => thunk(),
  };
}
