import { describe, expect, it } from "vitest";
import { Duration } from "../../src/primitives/duration.js";

describe("Duration", () => {
  it("decodes friendly notation ('30d') into milliseconds", () => {
    const result = Duration().zodSchema.parse("30d");
    expect(result).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("decodes ISO 8601 duration ('PT15M') into milliseconds", () => {
    const result = Duration().zodSchema.parse("PT15M");
    expect(result).toBe(15 * 60 * 1000);
  });

  it("encode always produces canonical ISO 8601, even from a friendly-notation input", () => {
    const descriptor = Duration();
    const value = descriptor.zodSchema.parse("30d");
    expect(descriptor.meta.encode?.(value)).toBe("P30D");
  });

  it("rejects a garbage duration string", () => {
    expect(() => Duration().zodSchema.parse("not-a-duration")).toThrow();
  });

  it("safeParse never throws on invalid input", () => {
    const result = Duration().zodSchema.safeParse("garbage");
    expect(result.success).toBe(false);
  });
});
