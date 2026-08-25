import { describe, expect, it } from "vitest";
import { Decimal } from "../../src/primitives/decimal.js";

describe("Decimal", () => {
  it("decodes a decimal string to a real Decimal instance", () => {
    const result = Decimal().zodSchema.parse("150.50");
    expect(result.toString()).toBe("150.5");
  });

  it("round-trips via encode, respecting scale", () => {
    const descriptor = Decimal({ scale: 2 });
    const value = descriptor.zodSchema.parse("150.5");
    expect(descriptor.meta.encode?.(value)).toBe("150.50");
  });

  it("rejects a value exceeding scale", () => {
    expect(() => Decimal({ scale: 2 }).zodSchema.parse("150.505")).toThrow();
  });

  it("enforces min/max", () => {
    const descriptor = Decimal({ min: "0.00", max: "1.00" });
    expect(() => descriptor.zodSchema.parse("-0.01")).toThrow();
    expect(() => descriptor.zodSchema.parse("1.01")).toThrow();
    expect(descriptor.zodSchema.parse("0.50").toString()).toBe("0.5");
  });

  it("rejects a malformed decimal string", () => {
    expect(() => Decimal().zodSchema.parse("not-a-number")).toThrow();
  });
});
