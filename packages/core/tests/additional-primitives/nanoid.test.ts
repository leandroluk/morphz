import { describe, expect, it } from "vitest";
import { Nanoid } from "../../src/primitives/nanoid.js";

describe("Nanoid", () => {
  it("default generates a 21-char id (default length)", () => {
    const generated = (Nanoid().meta.default as () => string)();
    expect(generated).toHaveLength(21);
    expect(Nanoid().zodSchema.parse(generated)).toBe(generated);
  });

  it("respects a custom length", () => {
    const descriptor = Nanoid({ length: 10 });
    const generated = (descriptor.meta.default as () => string)();
    expect(generated).toHaveLength(10);
    expect(descriptor.zodSchema.parse(generated)).toBe(generated);
  });

  it("rejects a string of the wrong length", () => {
    expect(() => Nanoid({ length: 10 }).zodSchema.parse("tooshort")).toThrow();
  });
});
