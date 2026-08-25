import { z } from "zod";
import type { FieldDescriptor, FieldDescriptorMeta } from "../core/field-descriptor.js";

/**
 * Wire side is a strict UTC ISO string (`z.iso.datetime()`, no `offset`/
 * `local` options) so `encode`'s `.toISOString()` round-trips exactly —
 * z.toJSONSchema() only ever sees this side, never `z.date()` directly,
 * which is what keeps date fields representable in OpenAPI/JSON Schema.
 */
const DateTimeCodec = z.codec(z.iso.datetime(), z.date(), {
  decode: (value: string) => new Date(value),
  encode: (value: Date) => value.toISOString(),
});

export function DateTime(
  overrides: Partial<FieldDescriptorMeta<Date>> = {},
): FieldDescriptor<Date> {
  return {
    zodSchema: DateTimeCodec,
    meta: {
      ...overrides,
      encode: (value: Date) => value.toISOString(),
    },
  };
}
