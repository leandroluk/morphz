import { describe, expect, it } from "vitest";
import { Tuple } from "../../src/primitives/tuple.js";
import { Text } from "../../src/primitives/text.js";
import { Number } from "../../src/primitives/number.js";

describe("Tuple", () => {
  it("accepts a positionally-typed tuple", () => {
    const field = Tuple([Number, Number]);
    expect(field.zodSchema.parse([1.5, 2.5])).toEqual([1.5, 2.5]);
  });

  it("rejects a wrong-type item at a position", () => {
    const field = Tuple([Text, Number]);
    expect(field.zodSchema.safeParse(["ok", "not a number"]).success).toBe(false);
  });

  it("rejects a wrong-length tuple", () => {
    const field = Tuple([Number, Number]);
    expect(field.zodSchema.safeParse([1]).success).toBe(false);
  });
});
