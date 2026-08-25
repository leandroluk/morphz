import { describe, expect, it } from "vitest";
import { Json } from "../../src/primitives/json.js";

describe("Json", () => {
  it("accepts an arbitrary object", () => {
    const field = Json<{ tags: string[] }>();
    const result = field.zodSchema.parse({ tags: ["a", "b"] });
    expect(result).toEqual({ tags: ["a", "b"] });
  });

  it("rejects a non-object (e.g. a bare string)", () => {
    expect(Json().zodSchema.safeParse("not an object").success).toBe(false);
  });

  it("accepts an empty object", () => {
    expect(Json().zodSchema.parse({})).toEqual({});
  });
});
