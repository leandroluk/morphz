import { z } from "zod";
import type { FieldDescriptor } from "./field-descriptor.js";

/**
 * Thin z.literal() wrapper — leaf primitive, same tier as Text/Number in
 * define-metatypes, scoped here since its only real use is as a Union member.
 */
export function Literal<T extends string | number | boolean | null>(value: T): FieldDescriptor<T> {
  return {
    zodSchema: z.literal(value),
    meta: {},
  };
}
