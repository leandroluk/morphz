import { z } from "zod";
import type { FieldDescriptor, FieldDescriptorMeta } from "../core/field-descriptor.js";

export interface PasswordOptions extends Partial<FieldDescriptorMeta<string>> {
  min?: number;
}

/** Semantically-marked Text — usually paired with `writeOnly: true`. */
export function Password(options: PasswordOptions = {}): FieldDescriptor<string> {
  const { min, ...meta } = options;
  let schema = z.string();
  if (min !== undefined) schema = schema.min(min);
  return { zodSchema: schema, meta };
}
