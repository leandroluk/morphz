import { z } from "zod";
import { createId, isCuid } from "@paralleldrive/cuid2";
import type { FieldDescriptor, FieldDescriptorMeta } from "../core/field-descriptor.js";

export function Cuid2(
  overrides: Partial<FieldDescriptorMeta<string>> = {},
): FieldDescriptor<string> {
  return {
    zodSchema: z.string().refine((val) => isCuid(val), { error: () => "Invalid CUID2" }),
    meta: { default: () => createId(), ...overrides },
  };
}
