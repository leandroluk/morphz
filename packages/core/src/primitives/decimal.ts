import { z } from "zod";
import { Decimal as DecimalJs } from "decimal.js";
import type { FieldDescriptor, FieldDescriptorMeta } from "../core/field-descriptor.js";
import { logCodec } from "../core/debug.js";

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

  const wireSchema = z.string().refine((val) => DECIMAL_STRING_RE.test(val), {
    error: () => "Invalid decimal string",
  });

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
