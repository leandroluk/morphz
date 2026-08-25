import { z } from "zod";
import type { FieldDescriptor, FieldDescriptorMeta } from "../core/field-descriptor.js";

export function Enum<T extends Record<string, string | number>>(
  enumObj: T,
  options: Partial<FieldDescriptorMeta<T[keyof T]>> = {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): FieldDescriptor<T[keyof T]> {
  const schema = z.enum(enumObj as never) as unknown as z.ZodType<T[keyof T]>;
  return { zodSchema: schema, meta: options };
}
