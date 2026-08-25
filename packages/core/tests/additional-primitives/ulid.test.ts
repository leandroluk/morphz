import { describe, expect, it } from "vitest";
import { Ulid } from "../../src/primitives/ulid.js";

describe("Ulid", () => {
  it("default generates a valid ULID", () => {
    const descriptor = Ulid();
    const generated = (descriptor.meta.default as () => string)();
    expect(descriptor.zodSchema.parse(generated)).toBe(generated);
    expect(generated).toHaveLength(26);
  });

  it("rejects a non-ULID string", () => {
    expect(() => Ulid().zodSchema.parse("not-a-ulid")).toThrow();
  });

  it("rejects lowercase (Crockford Base32 is uppercase-only per this regex)", () => {
    const valid = (Ulid().meta.default as () => string)();
    expect(() => Ulid().zodSchema.parse(valid.toLowerCase())).toThrow();
  });
});
