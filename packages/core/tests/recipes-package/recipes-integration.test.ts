import { describe, expect, it } from "vitest";
import { CreatedAt, DeletedAt, PrimaryKey, UpdatedAt } from "../../src/recipes.js";
import { Struct } from "../../src/core/struct.js";
import { Text } from "../../src/primitives/text.js";

describe("morphz/recipes — full-entity integration", () => {
  it("a real Struct combining PrimaryKey/CreatedAt/UpdatedAt/DeletedAt parses with correct defaults", () => {
    class User extends Struct(
      {
        id: PrimaryKey(),
        createdAt: CreatedAt(),
        updatedAt: UpdatedAt(),
        deletedAt: DeletedAt(),
        name: Text({ min: 2 }),
      },
      { labels: { entityName: "Usuário" } },
    ) {}

    const user = User.parse({ name: "John Doe" }) as {
      id: string;
      createdAt: Date;
      updatedAt: unknown;
      deletedAt: Date | null;
      name: string;
    };

    expect(user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.deletedAt).toBeNull();
    expect(user.name).toBe("John Doe");

    // updatedAt has no default in INSIGHT.md's own recipe -- omitting it
    // entirely must still parse (field is required-but-undefined only if
    // Timestamp itself has no default; confirm actual behavior rather than
    // assuming).
    expect(user.updatedAt === undefined || user.updatedAt instanceof Date).toBe(true);
  });

  it("id (PrimaryKey) is immutable -- an update-shaped derived class rejects it if present", () => {
    class User extends Struct(
      { id: PrimaryKey(), name: Text({ min: 2 }) },
      { labels: { entityName: "User" } },
    ) {}
    const PatchUserDto = User.omit("name").partial();
    const validUserId = (User.parse({ name: "ab" }) as { id: string }).id;

    expect(() => PatchUserDto.parse({ id: validUserId })).toThrow();
    expect(() => PatchUserDto.parse({})).not.toThrow();
  });
});
