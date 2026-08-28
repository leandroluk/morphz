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
  omit(mask: Record<string, true>): unknown;
  pick(mask: Record<string, true>): unknown;
  partial(mask?: Record<string, true>): unknown;
};

const validInput = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  name: "Ada",
  email: "ada@example.com",
  password: "secret1",
};

describe("omit", () => {
  it("removes the masked fields and is NOT instanceof the source", () => {
    const CreateUserDto = User.omit({ id: true }) as unknown as {
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

  it("removes every masked field", () => {
    const A = User.omit({ id: true, password: true }) as unknown as {
      new (input: unknown): object;
    };
    const a = new A({ name: "Ada", email: "ada@example.com" });
    expect(a).toEqual({ name: "Ada", email: "ada@example.com" });
  });

  it("throws a migration error when given the removed variadic / array form", () => {
    // @ts-expect-error — old API, deliberately calling wrong at runtime
    expect(() => User.omit("id", "password")).toThrow(/mask object/);
    // @ts-expect-error — old API
    expect(() => User.omit(["id"])).toThrow(/mask object/);
  });
});

describe("pick", () => {
  it("keeps only the masked fields", () => {
    const NameOnly = User.pick({ name: true }) as unknown as {
      new (input: unknown): { name: string };
    };
    const instance = new NameOnly({ name: "Ada" });
    expect(instance.name).toBe("Ada");
    expect((instance as unknown as { email?: string }).email).toBeUndefined();
  });
});

describe("partial", () => {
  it("makes every remaining field optional with no mask", () => {
    const Partial_ = User.pick({ name: true, email: true }).partial() as unknown as {
      new (input: unknown): { name?: string; email?: string };
    };
    expect(() => new Partial_({})).not.toThrow();
  });

  it("with a mask, makes ONLY the masked fields optional", () => {
    const SelPartial = User.omit({ id: true, password: true }).partial({
      email: true,
    }) as unknown as {
      new (input: unknown): { name: string; email?: string };
    };
    // email masked -> optional
    expect(() => new SelPartial({ name: "Ada" })).not.toThrow();
    // name NOT masked -> still required
    expect(() => new SelPartial({ email: "ada@example.com" })).toThrow();
  });
});

describe("immutable enforcement on derived variants", () => {
  const PatchUserDto = User.omit({ password: true }).partial() as unknown as {
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
    const Chained = User.pick({ name: true, email: true }).partial() as unknown as {
      new (input: unknown): { name?: string };
    };
    expect(new Chained({ name: "Ada" }).name).toBe("Ada");
  });
});
