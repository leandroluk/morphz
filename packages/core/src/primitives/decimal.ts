import { z } from "zod";
import { Decimal as DecimalJsBase } from "decimal.js";
import type { FieldDescriptor, FieldDescriptorMeta } from "../core/field-descriptor.js";
import { logCodec } from "../core/debug.js";

// decimal.js's default `.toString()` switches to exponential notation
// (e.g. "1.5e+92") once a value's magnitude crosses toExpPos/toExpNeg
// (default ±21) -- but DECIMAL_STRING_RE (the wire schema's own
// validation) only accepts plain decimal notation. Left at defaults,
// encode() could produce a string decode() then rejects, breaking the
// wire round-trip for sufficiently large/small values. Cloned (not
// `.set()` on the shared/global class) so this doesn't change decimal.js's
// behavior for any OTHER consumer importing it directly.
const DecimalJs = DecimalJsBase.clone({ toExpPos: 9e15, toExpNeg: -9e15 });
type DecimalJs = InstanceType<typeof DecimalJs>;

export interface DecimalOptions extends Partial<FieldDescriptorMeta<DecimalJs>> {
  /** Total significant digits allowed. */
  precision?: number;
  /** Digits after the decimal point — also controls `encode`'s output. */
  scale?: number;
  min?: string;
  max?: string;
}

const DECIMAL_STRING_RE = /^-?\d+(\.\d+)?$/;

/**
 * Wire is a plain decimal string ("150.50") — never a native JS `number`
 * (defeats the whole point of exact decimal arithmetic via float error).
 * Domain is a real decimal.js instance.
 */
export function Decimal(overrides: DecimalOptions = {}): FieldDescriptor<DecimalJs> {
  const { precision, scale, min, max, ...meta } = overrides;

  // .regex() (not .refine()) so the check is schema-visible to mock.ts's
  // pattern-based synthesis, in addition to being real validation.
  const wireSchema = z.string().regex(DECIMAL_STRING_RE, { error: () => "Invalid decimal string" });

  const codec = z.codec(wireSchema, z.instanceof(DecimalJs), {
    decode: (value: string, ctx) => {
      logCodec("decoding Decimal wire value %s", value);
      const decimal = new DecimalJs(value);
      if (precision !== undefined && decimal.precision(true) > precision) {
        ctx.issues.push({
          code: "custom",
          message: `Exceeds max precision of ${precision} significant digits`,
          input: value,
        });
        return z.NEVER;
      }
      if (scale !== undefined && decimal.decimalPlaces() > scale) {
        ctx.issues.push({
          code: "custom",
          message: `Exceeds max scale of ${scale} decimal places`,
          input: value,
        });
        return z.NEVER;
      }
      if (min !== undefined && decimal.lessThan(min)) {
        ctx.issues.push({ code: "custom", message: `Must be >= ${min}`, input: value });
        return z.NEVER;
      }
      if (max !== undefined && decimal.greaterThan(max)) {
        ctx.issues.push({ code: "custom", message: `Must be <= ${max}`, input: value });
        return z.NEVER;
      }
      return decimal;
    },
    encode: (value: DecimalJs) => {
      const rendered = scale !== undefined ? value.toFixed(scale) : value.toString();
      logCodec("encoding Decimal domain value %s", rendered);
      return rendered;
    },
  });

  return {
    zodSchema: codec,
    meta: {
      ...meta,
      encode: (value: DecimalJs) => (scale !== undefined ? value.toFixed(scale) : value.toString()),
    },
  };
}
