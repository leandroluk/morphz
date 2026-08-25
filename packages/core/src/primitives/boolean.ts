import { z } from "zod";
import type { FieldDescriptor, FieldDescriptorMeta } from "../core/field-descriptor.js";

// z.coerce.boolean() uses raw JS truthiness (Boolean(input)) — "false" is a
// non-empty string, so it would coerce to `true`. Wrong for querystring/
// payload semantics ("true"/"1" -> true, "false"/"0" -> false), so this
// hand-rolls the mapping via preprocess instead of using z.coerce.boolean().
const TRUE_VALUES = new Set(["true", "1", true, 1]);
const FALSE_VALUES = new Set(["false", "0", false, 0]);

const BooleanSchema = z.preprocess((val) => {
  if (typeof val === "boolean") return val;
  if (TRUE_VALUES.has(val as string | number)) return true;
  if (FALSE_VALUES.has(val as string | number)) return false;
  return val;
}, z.boolean());

export function Boolean(
  overrides: Partial<FieldDescriptorMeta<boolean>> = {},
): FieldDescriptor<boolean> {
  return { zodSchema: BooleanSchema, meta: overrides };
}
