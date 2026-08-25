import { describe, expect, it } from "vitest";
import { TimeOnly } from "../../src/primitives/time-only.js";
import { PlainTime } from "../../src/core/plain-time.js";

describe("TimeOnly", () => {
  it("decodes 'HH:mm' into a PlainTime", () => {
    const result = TimeOnly().zodSchema.parse("08:30");
    expect(result).toBeInstanceOf(PlainTime);
    expect(result.hour).toBe(8);
    expect(result.minute).toBe(30);
  });

  it("round-trips via encode, preserving HH:mm vs HH:mm:ss shape", () => {
    const descriptor = TimeOnly();
    expect(descriptor.meta.encode?.(descriptor.zodSchema.parse("18:00"))).toBe("18:00");
  });

  it("rejects a malformed time string", () => {
    expect(() => TimeOnly().zodSchema.parse("not-a-time")).toThrow();
  });
});
