import { z } from "zod";
import type { FieldDescriptor, FieldDescriptorMeta } from "../core/field-descriptor.js";
import { logCodec } from "../core/debug.js";

export interface BigIntOptions extends Partial<FieldDescriptorMeta<bigint>> {
  min?: bigint;
  max?: bigint;
}

/**
 * Wire is a string (JSON has no native bigint literal) so
 * z.toJSONSchema() stays representable — same reasoning as DateTime never
 * being a bare z.date().
 */
export function BigInt(overrides: BigIntOptions = {}): FieldDescriptor<bigint> {
  const { min, max, ...meta } = overrides;

  let domainSchema = z.bigint();
  if (min !== undefined) domainSchema = domainSchema.min(min);
  if (max !== undefined) domainSchema = domainSchema.max(max);

  // The regex is also what lets mock.ts synthesize a valid wire example
  // via pattern-based generation, in addition to being real validation.
  const codec = z.codec(z.string().regex(/^-?\d+$/), domainSchema, {
    decode: (value: string, payload) => {
      logCodec("decoding BigInt wire value %s", value);
      // globalThis.BigInt() throws a raw SyntaxError on malformed input —
      // z.codec does NOT catch exceptions thrown inside decode (verified:
      // they propagate uncaught even through safeParse), so this must
      // catch it manually and report it as a real Zod issue instead.
      try {
        return globalThis.BigInt(value);
      } catch {
        payload.issues.push({
          code: "custom",
          message: `Invalid bigint string: ${value}`,
          input: value,
        });
        return z.NEVER;
      }
    },
    encode: (value: bigint) => {
      logCodec("encoding BigInt domain value %s", value.toString());
      return value.toString();
    },
  });

  return {
    zodSchema: codec,
    meta: {
      ...meta,
      encode: (value: bigint) => value.toString(),
    },
  };
}
