import { z } from "zod";
import ms from "ms";
import type { FieldDescriptor, FieldDescriptorMeta } from "../core/field-descriptor.js";
import { logCodec } from "../core/debug.js";

const ISO_DURATION_RE =
  /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const MS_PER_MONTH = 30 * MS_PER_DAY; // approximation, same as Duration's own "friendly" granularity
const MS_PER_YEAR = 365 * MS_PER_DAY;

/** Parses "PnYnMnDTnHnMnS" into milliseconds. Returns undefined if malformed. */
function parseIsoDuration(value: string): number | undefined {
  const match = ISO_DURATION_RE.exec(value);
  if (!match) return undefined;
  const [, years, months, days, hours, minutes, seconds] = match;
  if (!years && !months && !days && !hours && !minutes && !seconds) return undefined;
  return (
    Number(years ?? 0) * MS_PER_YEAR +
    Number(months ?? 0) * MS_PER_MONTH +
    Number(days ?? 0) * MS_PER_DAY +
    Number(hours ?? 0) * MS_PER_HOUR +
    Number(minutes ?? 0) * MS_PER_MINUTE +
    Number(seconds ?? 0) * MS_PER_SECOND
  );
}

/** Formats milliseconds into a canonical "PnDTnHnMnS" ISO 8601 duration string. */
function formatIsoDuration(totalMs: number): string {
  let remaining = Math.abs(Math.trunc(totalMs));
  const days = Math.floor(remaining / MS_PER_DAY);
  remaining -= days * MS_PER_DAY;
  const hours = Math.floor(remaining / MS_PER_HOUR);
  remaining -= hours * MS_PER_HOUR;
  const minutes = Math.floor(remaining / MS_PER_MINUTE);
  remaining -= minutes * MS_PER_MINUTE;
  const seconds = Math.floor(remaining / MS_PER_SECOND);

  const datePart = days ? `${days}D` : "";
  const timePart =
    hours || minutes || seconds
      ? `T${hours ? `${hours}H` : ""}${minutes ? `${minutes}M` : ""}${seconds ? `${seconds}S` : ""}`
      : "";
  const body = `${datePart}${timePart}`;
  return `P${body || "T0S"}`;
}

export function Duration(
  overrides: Partial<FieldDescriptorMeta<number>> = {},
): FieldDescriptor<number> {
  const codec = z.codec(z.string(), z.number(), {
    decode: (value: string, payload) => {
      logCodec("decoding Duration wire value %s", value);
      const isoMs = parseIsoDuration(value);
      if (isoMs !== undefined) return isoMs;

      const friendlyMs = ms(value as Parameters<typeof ms>[0]);
      if (typeof friendlyMs === "number") return friendlyMs;

      payload.issues.push({
        code: "custom",
        message: `Invalid duration: ${value}`,
        input: value,
      });
      return z.NEVER;
    },
    encode: (value: number) => {
      const rendered = formatIsoDuration(value);
      logCodec("encoding Duration domain value %s", rendered);
      return rendered;
    },
  });

  // Duration's wire schema is a bare z.string() (no regex — it accepts
  // TWO distinct formats, ISO 8601 or `ms`-parseable shorthand, so a
  // single schema-level regex can't usefully constrain it without either
  // rejecting real input or being too loose for mock.ts's pattern-based
  // synthesis to help). A built-in default example (15 minutes, domain-
  // typed so it flows through mock.ts's encode-aware examples path) is
  // the pragmatic way to keep `.mock()` working out of the box even when
  // the caller declares no `examples` of their own.
  const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

  return {
    zodSchema: codec,
    meta: {
      examples: [FIFTEEN_MINUTES_MS],
      ...overrides,
      encode: (value: number) => formatIsoDuration(value),
    },
  };
}
