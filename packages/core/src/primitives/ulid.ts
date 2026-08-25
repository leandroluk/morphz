import { z } from "zod";
import { ulid } from "ulid";
import type { FieldDescriptor, FieldDescriptorMeta } from "../core/field-descriptor.js";

const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export function Ulid(
  overrides: Partial<FieldDescriptorMeta<string>> = {},
): FieldDescriptor<string> {
  return {
    zodSchema: z.string().regex(ULID_RE),
    meta: { default: () => ulid(), ...overrides },
  };
}
