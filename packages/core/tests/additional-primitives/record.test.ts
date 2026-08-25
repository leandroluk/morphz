import { describe, expect, it } from "vitest";
import { Record } from "../../src/primitives/record.js";
import { Text } from "../../src/primitives/text.js";
import { Number } from "../../src/primitives/number.js";

describe("Record", () => {
  it("accepts a valid key/value record", () => {
    const field = Record(Text, Number);
    const result = field.zodSchema.parse({ a: 1, b: 2 });
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it("rejects a record with an invalid value type", () => {
    const field = Record(Text, Number);
    expect(field.zodSchema.safeParse({ a: "not a number" }).success).toBe(false);
  });

  it("accepts an empty record", () => {
    expect(Record(Text, Number).zodSchema.parse({})).toEqual({});
  });
});
