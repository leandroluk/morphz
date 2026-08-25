import { describe, expect, it } from "vitest";
import { Boolean } from "../../src/primitives/boolean.js";

describe("Boolean", () => {
  it("accepts a real boolean", () => {
    expect(Boolean().zodSchema.parse(true)).toBe(true);
    expect(Boolean().zodSchema.parse(false)).toBe(false);
  });

  it("coerces 'true'/'1' strings to true", () => {
    expect(Boolean().zodSchema.parse("true")).toBe(true);
    expect(Boolean().zodSchema.parse("1")).toBe(true);
  });

  it("coerces 'false'/'0' strings to false (not raw JS truthiness)", () => {
    expect(Boolean().zodSchema.parse("false")).toBe(false);
    expect(Boolean().zodSchema.parse("0")).toBe(false);
  });

  it("rejects an unrecognized string", () => {
    expect(() => Boolean().zodSchema.parse("maybe")).toThrow();
  });
});
