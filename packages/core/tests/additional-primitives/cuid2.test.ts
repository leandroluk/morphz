import { describe, expect, it } from "vitest";
import { Cuid2 } from "../../src/primitives/cuid2.js";

describe("Cuid2", () => {
  it("default generates a valid CUID2", () => {
    const generated = (Cuid2().meta.default as () => string)();
    expect(Cuid2().zodSchema.parse(generated)).toBe(generated);
  });

  it("rejects an invalid CUID2 string", () => {
    expect(() => Cuid2().zodSchema.parse("not-a-cuid2!!!")).toThrow();
  });
});
