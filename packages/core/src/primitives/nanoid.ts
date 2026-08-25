import { z } from "zod";
import { nanoid } from "nanoid";
import type { FieldDescriptor, FieldDescriptorMeta } from "../core/field-descriptor.js";

export interface NanoidOptions extends Partial<FieldDescriptorMeta<string>> {
  length?: number;
}

const DEFAULT_LENGTH = 21;

export function Nanoid(overrides: NanoidOptions = {}): FieldDescriptor<string> {
  const { length = DEFAULT_LENGTH, ...meta } = overrides;
  return {
    zodSchema: z.string().regex(new RegExp(`^[A-Za-z0-9_-]{${length}}$`)),
    meta: { default: () => nanoid(length), ...meta },
  };
}
