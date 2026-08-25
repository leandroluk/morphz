import { z } from "zod";
import type { FieldDescriptor, FieldDescriptorMeta } from "../core/field-descriptor.js";

export interface TextOptions extends Partial<FieldDescriptorMeta<string>> {
  min?: number;
  max?: number;
  regex?: RegExp;
}

export function Text(options: TextOptions = {}): FieldDescriptor<string> {
  const { min, max, regex, ...meta } = options;
  let schema = z.string();
  if (min !== undefined) schema = schema.min(min);
  if (max !== undefined) schema = schema.max(max);
  if (regex) schema = schema.regex(regex);
  return { zodSchema: schema, meta };
}
