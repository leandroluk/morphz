import { z } from "zod";
import type {
  FieldDescriptor,
  FieldDescriptorFactory,
  FieldDescriptorMeta,
} from "../core/field-descriptor.js";

export function Record<K extends string | number | symbol, V>(
  keyType: FieldDescriptorFactory<K> | FieldDescriptor<K>,
  valueType: FieldDescriptorFactory<V> | FieldDescriptor<V>,
  overrides: Partial<FieldDescriptorMeta<Record<K, V>>> = {},
): FieldDescriptor<Record<K, V>> {
  const keyDescriptor = typeof keyType === "function" ? keyType() : keyType;
  const valueDescriptor = typeof valueType === "function" ? valueType() : valueType;
  // `z.record()`'s key type parameter is intentionally not modeled precisely
  // here (K is caller-supplied, morphz's own field-descriptor generics
  // aren't reflected in Zod's internal $ZodRecordKey bound) -- the runtime
  // shape is correct, only the exact TS overload resolution is loosened.
  const schema = (z.record as (key: z.ZodType, value: z.ZodType) => z.ZodType)(
    keyDescriptor.zodSchema,
    valueDescriptor.zodSchema,
  );
  return { zodSchema: schema as unknown as z.ZodType<Record<K, V>>, meta: overrides };
}
