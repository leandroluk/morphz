import { z } from "zod";
import type { FieldDescriptor, FieldDescriptorMeta } from "../core/field-descriptor.js";

export interface VersionOptions extends Partial<FieldDescriptorMeta<number>> {
  /** Only 'incr' (optimistic monotonic counter) supported for now. */
  type?: "incr";
}

export function Version(options: VersionOptions = {}): FieldDescriptor<number> {
  const { type: _type, ...meta } = options;
  return { zodSchema: z.number().int().min(0), meta: { default: 0, ...meta } };
}
