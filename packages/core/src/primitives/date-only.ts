import { z } from "zod";
import type { FieldDescriptor, FieldDescriptorMeta } from "../core/field-descriptor.js";
import { PlainDate } from "../core/plain-date.js";
import { logCodec } from "../core/debug.js";

const DateOnlyCodec = z.codec(z.iso.date(), z.instanceof(PlainDate), {
  decode: (value: string) => {
    logCodec("decoding DateOnly wire value %s", value);
    return new PlainDate(value);
  },
  encode: (value: PlainDate) => {
    const rendered = value.toString();
    logCodec("encoding DateOnly domain value %s", rendered);
    return rendered;
  },
});

export function DateOnly(
  overrides: Partial<FieldDescriptorMeta<PlainDate>> = {},
): FieldDescriptor<PlainDate> {
  return {
    zodSchema: DateOnlyCodec,
    meta: { ...overrides, encode: (value: PlainDate) => value.toString() },
  };
}
