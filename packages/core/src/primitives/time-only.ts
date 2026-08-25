import { z } from "zod";
import type { FieldDescriptor, FieldDescriptorMeta } from "../core/field-descriptor.js";
import { PlainTime } from "../core/plain-time.js";
import { logCodec } from "../core/debug.js";

const TimeOnlyCodec = z.codec(z.iso.time(), z.instanceof(PlainTime), {
  decode: (value: string) => {
    logCodec("decoding TimeOnly wire value %s", value);
    return new PlainTime(value);
  },
  encode: (value: PlainTime) => {
    const rendered = value.toString();
    logCodec("encoding TimeOnly domain value %s", rendered);
    return rendered;
  },
});

export function TimeOnly(
  overrides: Partial<FieldDescriptorMeta<PlainTime>> = {},
): FieldDescriptor<PlainTime> {
  return {
    zodSchema: TimeOnlyCodec,
    meta: { ...overrides, encode: (value: PlainTime) => value.toString() },
  };
}
