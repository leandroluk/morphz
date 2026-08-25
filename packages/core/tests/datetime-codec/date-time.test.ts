import { describe, expect, it } from "vitest";
import { DateTime } from "../../src/primitives/date-time.js";

describe("DateTime", () => {
  it("parses a Z-suffixed ISO string into a real Date", () => {
    const descriptor = DateTime();
    const result = descriptor.zodSchema.parse("2024-01-01T00:00:00Z");
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).toISOString()).toBe("2024-01-01T00:00:00.000Z");
  });

  it("rejects an offset string (+02:00)", () => {
    const descriptor = DateTime();
    expect(() => descriptor.zodSchema.parse("2024-01-01T00:00:00+02:00")).toThrow();
  });

  it("rejects a local (timezone-less) string", () => {
    const descriptor = DateTime();
    expect(() => descriptor.zodSchema.parse("2024-01-01T00:00:00")).toThrow();
  });

  it("meta.encode round-trips a Date back to the identical ISO string", () => {
    const descriptor = DateTime();
    const original = "2024-06-15T12:30:00.000Z";
    const date = descriptor.zodSchema.parse(original) as Date;
    expect(descriptor.meta.encode?.(date)).toBe(original);
  });
});
