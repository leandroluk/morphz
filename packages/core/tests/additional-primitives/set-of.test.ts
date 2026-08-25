import { describe, expect, it } from "vitest";
import { SetOf } from "../../src/primitives/set-of.js";
import { Text } from "../../src/primitives/text.js";

describe("SetOf", () => {
  it("decodes a JSON array into a real Set", () => {
    const result = SetOf(Text).zodSchema.parse(["a", "b", "c"]);
    expect(result).toBeInstanceOf(Set);
    expect(result).toEqual(new Set(["a", "b", "c"]));
  });

  it("rejects a duplicate-containing array", () => {
    expect(SetOf(Text).zodSchema.safeParse(["a", "a"]).success).toBe(false);
  });

  it("enforces minSize", () => {
    const field = SetOf(Text, { minSize: 3 });
    expect(field.zodSchema.safeParse(["a", "b"]).success).toBe(false);
    expect(field.zodSchema.safeParse(["a", "b", "c"]).success).toBe(true);
  });

  it("round-trips encode(decode(x)) back to the original array", () => {
    const field = SetOf(Text);
    const decoded = field.zodSchema.parse(["x", "y"]) as Set<string>;
    expect(field.meta.encode?.(decoded)).toEqual(["x", "y"]);
  });
});
