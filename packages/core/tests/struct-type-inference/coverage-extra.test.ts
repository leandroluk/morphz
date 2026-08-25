import { describe, expectTypeOf, it } from "vitest";
import { Struct } from "../../src/core/struct.js";
import { Embed } from "../../src/core/embed.js";
import { FieldOf } from "../../src/core/field-of.js";
import { Union } from "../../src/core/union.js";
import { Literal } from "../../src/core/literal.js";
import { Text } from "../../src/primitives/text.js";
import { Uuid } from "../../src/primitives/uuid.js";
import { Timestamp } from "../../src/primitives/timestamp.js";
import { DateTime } from "../../src/primitives/date-time.js";
import { Password } from "../../src/primitives/password.js";
import { Enum } from "../../src/primitives/enum.js";
import { Nullable } from "../../src/primitives/nullable.js";
import { Optional } from "../../src/primitives/optional.js";
import { List } from "../../src/primitives/list.js";

enum UserRole {
  ADMIN = "ADMIN",
  USER = "USER",
}

describe("struct-type-inference: full INSIGHT.md-style User/Post", () => {
  class Address extends Struct(
    { street: Text({ min: 3 }) },
    { labels: { entityName: "Address" } },
  ) {}

  class User extends Struct(
    {
      id: Uuid(),
      createdAt: Timestamp(),
      updatedAt: Timestamp(),
      deletedAt: Nullable(DateTime),
      name: Text({ min: 2, max: 50 }),
      email: Text({ min: 3 }),
      password: Password({ writeOnly: true }),
      role: Enum(UserRole, { default: UserRole.USER }),
      address: Optional(Embed(Address)),
      tags: List(Text(), { default: () => [] }),
    },
    { labels: { entityName: "User" } },
  ) {}

  class Post extends Struct(
    {
      id: Uuid(),
      userId: FieldOf(User, "id"),
      title: Text({ min: 5 }),
      status: Union([Literal("DRAFT"), Literal("PUBLISHED"), Literal("ARCHIVED")]),
    },
    { labels: { entityName: "Post" } },
  ) {}

  it("every scalar/enum/nested/list field on User infers correctly", () => {
    const user = User.parse({
      id: "11111111-1111-4111-8111-111111111111",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      name: "John",
      email: "john@example.com",
      password: "hash",
      role: UserRole.ADMIN,
      tags: ["a", "b"],
    });
    expectTypeOf(user.id).toEqualTypeOf<string>();
    expectTypeOf(user.createdAt).toEqualTypeOf<Date>();
    expectTypeOf(user.deletedAt).toEqualTypeOf<Date | null>();
    expectTypeOf(user.name).toEqualTypeOf<string>();
    expectTypeOf(user.role).toEqualTypeOf<UserRole>();
    expectTypeOf(user.tags).toEqualTypeOf<string[]>();
    if (user.address) {
      expectTypeOf(user.address).toEqualTypeOf<Address>();
    }
  });

  it("FieldOf(User, 'id') infers User's own 'id' field type (string), not unknown", () => {
    const post = Post.parse({
      id: "22222222-2222-4222-8222-222222222222",
      userId: "11111111-1111-4111-8111-111111111111",
      title: "Hello world",
      status: "DRAFT",
    });
    expectTypeOf(post.userId).toEqualTypeOf<string>();
  });

  it("Union([Literal(...), Literal(...), Literal(...)]) infers the literal union, not a widened string", () => {
    const post = Post.parse({
      id: "22222222-2222-4222-8222-222222222222",
      userId: "11111111-1111-4111-8111-111111111111",
      title: "Hello world",
      status: "DRAFT",
    });
    expectTypeOf(post.status).toEqualTypeOf<"DRAFT" | "PUBLISHED" | "ARCHIVED">();
  });

  class PatchUserDto extends User.omit("password").partial() {}
  it("real PatchUserDto: all remaining fields optional, password gone", () => {
    const dto = PatchUserDto.parse({});
    expectTypeOf(dto.name).toEqualTypeOf<string | undefined>();
    expectTypeOf(dto.role).toEqualTypeOf<UserRole | undefined>();
    expectTypeOf(dto).not.toHaveProperty("password");
  });
});

describe("struct-type-inference: mockMany + triple chaining", () => {
  class User extends Struct(
    { name: Text({ min: 2 }), email: Text({ min: 3 }) },
    { labels: { entityName: "User" } },
  ) {
    isAdmin(): boolean {
      return false;
    }
  }

  it("mockMany() returns a real typed array, factory receives (index: number)", () => {
    const batch = User.mockMany(3, (index) => ({ email: `user-${index}@example.com` }));
    expectTypeOf(batch).toEqualTypeOf<User[]>();
    // noUncheckedIndexedAccess is on -- batch[0] is User | undefined, not User.
    expectTypeOf(batch[0]).toEqualTypeOf<User | undefined>();
  });

  class UpdateUserWithBioDto extends User.pick("name", "email").partial().extend({
    bio: Text({ min: 1 }),
  }) {}

  it("triple chaining (.pick().partial().extend()) combines optional-picked + required-new correctly", () => {
    const dto = UpdateUserWithBioDto.parse({ bio: "hello" });
    expectTypeOf(dto.name).toEqualTypeOf<string | undefined>();
    expectTypeOf(dto.email).toEqualTypeOf<string | undefined>();
    expectTypeOf(dto.bio).toEqualTypeOf<string>();
  });
});
