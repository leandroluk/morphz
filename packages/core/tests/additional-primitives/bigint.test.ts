import { describe, expect, it } from "vitest";
import { BigInt as BigIntField } from "../../src/primitives/bigint.js";

describe("BigInt", () => {
  it("decodes a numeric string to a real bigint", () => {
    const result = BigIntField().zodSchema.parse("12345678901234567890");
    expect(result).toBe(12345678901234567890n);
    expect(typeof result).toBe("bigint");
  });

  it("round-trips via encode", () => {
    const descriptor = BigIntField();
    const value = descriptor.zodSchema.parse("42");
    expect(descriptor.meta.encode?.(value)).toBe("42");
  });

  it("enforces min/max", () => {
    const descriptor = BigIntField({ min: 0n, max: 100n });
    expect(() => descriptor.zodSchema.parse("-1")).toThrow();
    expect(() => descriptor.zodSchema.parse("101")).toThrow();
    expect(descriptor.zodSchema.parse("50")).toBe(50n);
  });

  it("rejects a non-numeric string", () => {
    expect(() => BigIntField().zodSchema.parse("not-a-number")).toThrow();
  });
});
