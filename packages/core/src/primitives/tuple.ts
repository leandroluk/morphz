import { z } from "zod";
import type {
  FieldDescriptor,
  FieldDescriptorFactory,
  FieldDescriptorMeta,
} from "../core/field-descriptor.js";

export function Tuple(
  items: (FieldDescriptorFactory | FieldDescriptor)[],
  overrides: Partial<FieldDescriptorMeta<unknown[]>> = {},
): FieldDescriptor<unknown[]> {
  const descriptors = items.map((item) => (typeof item === "function" ? item() : item));
  const schema = z.tuple(
    descriptors.map((d) => d.zodSchema) as unknown as [z.ZodType, ...z.ZodType[]],
  );
  return { zodSchema: schema as unknown as z.ZodType<unknown[]>, meta: overrides };
}
