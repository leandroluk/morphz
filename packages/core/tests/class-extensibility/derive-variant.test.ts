import { describe, expect, it } from "vitest";
import { Struct } from "../../src/core/struct.js";
import { Text } from "../../src/primitives/text.js";
import { Uuid } from "../../src/primitives/uuid.js";

interface UserShape {
  id: string;
  name: string;
  email: string;
  password: string;
}

const User = Struct(
  {
    id: Uuid({ immutable: true }),
    name: Text({ min: 2 }),
    email: Text({ min: 3 }),
    password: Text({ min: 6 }),
  },
  { labels: { entityName: "User" } },
) as unknown as {
  new (input: unknown): UserShape;
  omit(...names: string[] | [string[]]): unknown;
  pick(...names: string[] | [string[]]): unknown;
  partial(): unknown;
};

const validInput = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  name: "Ada",
  email: "ada@example.com",
  password: "secret1",
};

describe("omit", () => {
  it("variadic form removes the named fields and is NOT instanceof the source", () => {
    const CreateUserDto = User.omit("id") as unknown as {
      new (input: unknown): { name: string; email: string; password: string };
    };
    const dto = new CreateUserDto({
      name: "Ada",
      email: "ada@example.com",
      password: "secret1",
    });
    expect((dto as unknown as { id?: string }).id).toBeUndefined();
    expect(dto).not.toBeInstanceOf(User as unknown as new (input: unknown) => unknown);
  });

  it("single-array form removes the same fields as the variadic form", () => {
    const A = User.omit("id", "password") as unknown as { new (input: unknown): object };
    const B = User.omit(["id", "password"]) as unknown as { new (input: unknown): object };
    const a = new A({ name: "Ada", email: "ada@example.com" });
    const b = new B({ name: "Ada", email: "ada@example.com" });
    expect(a).toEqual(b);
  });
});

describe("pick", () => {
  it("keeps only the named fields", () => {
    const NameOnly = User.pick("name") as unknown as { new (input: unknown): { name: string } };
    const instance = new NameOnly({ name: "Ada" });
    expect(instance.name).toBe("Ada");
    expect((instance as unknown as { email?: string }).email).toBeUndefined();
  });
});

describe("partial", () => {
  it("makes every remaining field optional", () => {
    const Partial_ = User.pick("name", "email").partial() as unknown as {
      new (input: unknown): { name?: string; email?: string };
    };
    expect(() => new Partial_({})).not.toThrow();
  });
});

describe("immutable enforcement on derived variants", () => {
  const PatchUserDto = User.omit("password").partial() as unknown as {
    new (input: unknown): { id?: string; name?: string; email?: string };
  };

  it("rejects a payload that includes the immutable id field", () => {
    expect(() => new PatchUserDto({ id: validInput.id, name: "New name" })).toThrow();
  });

  it("accepts a payload that omits the immutable id field", () => {
    expect(() => new PatchUserDto({ name: "New name" })).not.toThrow();
  });
});

describe("chaining across the derived family", () => {
  it("pick().partial() works and both static methods are available", () => {
    const Chained = User.pick("name", "email").partial() as unknown as {
      new (input: unknown): { name?: string };
    };
    expect(new Chained({ name: "Ada" }).name).toBe("Ada");
  });
});
