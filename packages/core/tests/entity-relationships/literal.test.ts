import { describe, expect, it } from "vitest";
import { Literal } from "../../src/core/literal.js";

describe("Literal", () => {
  it("accepts only the exact literal value", () => {
    const draft = Literal("DRAFT");
    expect(draft.zodSchema.parse("DRAFT")).toBe("DRAFT");
    expect(() => draft.zodSchema.parse("PUBLISHED")).toThrow();
  });

  it("works with non-string literals too", () => {
    const zero = Literal(0);
    expect(zero.zodSchema.parse(0)).toBe(0);
    expect(() => zero.zodSchema.parse(1)).toThrow();
  });
});
