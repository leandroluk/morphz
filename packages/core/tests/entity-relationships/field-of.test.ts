import { describe, expect, it } from "vitest";
import { Struct } from "../../src/core/struct.js";
import { FieldOf } from "../../src/core/field-of.js";
import { Text } from "../../src/primitives/text.js";
import { Uuid } from "../../src/primitives/uuid.js";

describe("FieldOf", () => {
  class User extends Struct(
    {
      id: Uuid({ default: () => "11111111-1111-4111-8111-111111111111", immutable: true }),
      name: Text(),
    },
    {},
  ) {}

  it("reuses the source field's Zod type but not default/immutable", () => {
    const userId = FieldOf(User as never, "id");
    expect(userId.meta.default).toBeUndefined();
    expect(userId.meta.immutable).toBeUndefined();
    // still the same base validation (a valid UUID string parses)
    expect(userId.zodSchema.parse("22222222-2222-4222-8222-222222222222")).toBe(
      "22222222-2222-4222-8222-222222222222",
    );
    expect(() => userId.zodSchema.parse("not-a-uuid")).toThrow();
  });

  it("merges own options on top (description override)", () => {
    const userId = FieldOf(User as never, "id", { description: "FK to User" });
    expect(userId.meta.description).toBe("FK to User");
  });

  it("throws synchronously for a non-existent field name", () => {
    expect(() => FieldOf(User as never, "bogus")).toThrow(/does not exist/);
  });
});
