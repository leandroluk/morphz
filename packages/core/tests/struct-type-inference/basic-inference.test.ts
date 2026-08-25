import { describe, expectTypeOf, it } from "vitest";
import { Struct } from "../../src/core/struct.js";
import { Embed } from "../../src/core/embed.js";
import { Ref } from "../../src/core/ref.js";
import { Text } from "../../src/primitives/text.js";
import { Number } from "../../src/primitives/number.js";
import { Optional } from "../../src/primitives/optional.js";
import { List } from "../../src/primitives/list.js";

describe("struct-type-inference: basic field inference", () => {
  class User extends Struct(
    { name: Text({ min: 2 }), age: Number({ int: true, min: 0 }) },
    { labels: { entityName: "User" } },
  ) {
    isAdult(): boolean {
      return this.age >= 18;
    }
  }

  it("infers field types on a parsed instance, not any/unknown", () => {
    const user = User.parse({ name: "John", age: 30 });
    expectTypeOf(user.name).toEqualTypeOf<string>();
    expectTypeOf(user.age).toEqualTypeOf<number>();
    expectTypeOf(user).toHaveProperty("isAdult");
  });

  it("infers field types via safeParse's success branch too", () => {
    const result = User.safeParse({ name: "John", age: 30 });
    if (result.success) {
      expectTypeOf(result.data.name).toEqualTypeOf<string>();
      expectTypeOf(result.data.age).toEqualTypeOf<number>();
    }
  });

  it("infers field types via the constructor directly", () => {
    const user = new User({ name: "John", age: 30 });
    expectTypeOf(user.name).toEqualTypeOf<string>();
  });
});

describe("struct-type-inference: subclass polymorphism at the type level", () => {
  class User extends Struct({ name: Text({ min: 2 }) }, { labels: { entityName: "User" } }) {}
  class Sub extends User {
    extra(): string {
      return "x";
    }
  }

  it("Sub.parse() types as Sub, not User", () => {
    const sub = Sub.parse({ name: "ab" });
    expectTypeOf(sub).toEqualTypeOf<Sub>();
    expectTypeOf(sub).toHaveProperty("extra");
    expectTypeOf(sub.name).toEqualTypeOf<string>();
  });
});

describe("struct-type-inference: Embed/Ref flow through InferShape", () => {
  class Address extends Struct(
    { street: Text({ min: 3 }) },
    { labels: { entityName: "Address" } },
  ) {}

  class Post extends Struct({ title: Text({ min: 1 }) }, { labels: { entityName: "Post" } }) {}

  class User extends Struct(
    {
      name: Text({ min: 2 }),
      address: Optional(Embed(Address)),
      posts: Optional(List(Ref(() => Post))),
    },
    { labels: { entityName: "User" } },
  ) {}

  it("Embed()'d field infers the nested Struct's own instance type", () => {
    const user = User.parse({ name: "ab", address: { street: "Main St" } });
    if (user.address) {
      expectTypeOf(user.address).toEqualTypeOf<Address>();
      expectTypeOf(user.address.street).toEqualTypeOf<string>();
    }
  });

  it("Ref()'d field (wrapped in List/Optional) infers the target's instance type", () => {
    const user = User.parse({ name: "ab" });
    if (user.posts) {
      expectTypeOf(user.posts).toEqualTypeOf<Post[]>();
    }
  });
});

describe("struct-type-inference: .extend()/.omit()/.pick()/.partial() shapes", () => {
  class User extends Struct(
    { name: Text({ min: 2 }), email: Text({ min: 3 }) },
    { labels: { entityName: "User" } },
  ) {
    isAdmin(): boolean {
      return false;
    }
  }

  class AdminUser extends User.extend({ department: Text({ min: 1 }) }) {
    canExecute(): boolean {
      return this.department.length > 0 || this.isAdmin();
    }
  }

  it(".extend() adds the new field's type and keeps the parent's + own methods", () => {
    const admin = AdminUser.parse({ name: "ab", email: "abc", department: "eng" });
    expectTypeOf(admin.name).toEqualTypeOf<string>();
    expectTypeOf(admin.department).toEqualTypeOf<string>();
    expectTypeOf(admin).toHaveProperty("isAdmin");
    expectTypeOf(admin).toHaveProperty("canExecute");
  });

  class CreatePostDto extends User.omit("email") {}
  it(".omit() removes the named field from the inferred shape", () => {
    const dto = CreatePostDto.parse({ name: "ab" });
    expectTypeOf(dto.name).toEqualTypeOf<string>();
    expectTypeOf(dto).not.toHaveProperty("email");
  });

  class UpdateUserDto extends User.pick("name").partial() {}
  it(".pick().partial() keeps only the picked field, made optional", () => {
    const dto = UpdateUserDto.parse({});
    expectTypeOf(dto.name).toEqualTypeOf<string | undefined>();
    expectTypeOf(dto).not.toHaveProperty("email");
  });
});
