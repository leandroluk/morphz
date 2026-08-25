import { describe, expect, it } from "vitest";
import { Binary } from "../../src/primitives/binary.js";

describe("Binary", () => {
  it("decodes a base64 string into a Uint8Array", () => {
    const b64 = Buffer.from([1, 2, 3]).toString("base64");
    const result = Binary().zodSchema.parse(b64);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(Array.from(result as Uint8Array)).toEqual([1, 2, 3]);
  });

  it("round-trips encode(decode(x)) === x", () => {
    const field = Binary();
    const b64 = Buffer.from([9, 8, 7]).toString("base64");
    const decoded = field.zodSchema.parse(b64) as Uint8Array;
    expect(field.meta.encode?.(decoded)).toBe(b64);
  });

  it("rejects a payload exceeding maxBytes", () => {
    const field = Binary({ maxBytes: 2 });
    const b64 = Buffer.from([1, 2, 3]).toString("base64");
    expect(field.zodSchema.safeParse(b64).success).toBe(false);
  });

  it("rejects a payload not matching exactBytes", () => {
    const field = Binary({ exactBytes: 4 });
    const b64 = Buffer.from([1, 2, 3]).toString("base64");
    expect(field.zodSchema.safeParse(b64).success).toBe(false);
  });

  it("accepts a payload matching exactBytes", () => {
    const field = Binary({ exactBytes: 3 });
    const b64 = Buffer.from([1, 2, 3]).toString("base64");
    expect(field.zodSchema.safeParse(b64).success).toBe(true);
  });
});
