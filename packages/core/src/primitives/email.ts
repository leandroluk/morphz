import { z } from "zod";
import type { FieldDescriptor, FieldDescriptorMeta } from "../core/field-descriptor.js";

export function Email(options: Partial<FieldDescriptorMeta<string>> = {}): FieldDescriptor<string> {
  return { zodSchema: z.email(), meta: options };
}
