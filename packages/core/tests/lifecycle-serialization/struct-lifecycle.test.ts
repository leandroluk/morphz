import { describe, expect, it } from "vitest";
import { Struct } from "../../src/core/struct.js";
import { Embed } from "../../src/core/embed.js";
import { ValidationError } from "../../src/core/validation-error.js";
import { Text } from "../../src/primitives/text.js";
import { Password } from "../../src/primitives/password.js";
import { DateTime } from "../../src/primitives/date-time.js";
import { STRUCT_META } from "../../src/core/struct-meta.js";

describe("Struct lifecycle", () => {
  class User extends Struct({
    name: Text({ min: 1 }),
  }) {}

  it("new X(valid) constructs, instanceof holds, fields accessible", () => {
    const user = new User({ name: "Ada" });
    expect(user).toBeInstanceOf(User);
    expect((user as unknown as { name: string }).name).toBe("Ada");
  });

  it("new X(invalid) throws ValidationError, not raw ZodError", () => {
    let caught: unknown;
    try {
      new User({ name: "" });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ValidationError);
    expect((caught as ValidationError).issues.length).toBeGreaterThan(0);
    expect((caught as ValidationError).issues[0]?.path).toEqual(["name"]);
  });

  it("static parse(valid) returns instance; parse(invalid) throws", () => {
    const user = User.parse({ name: "Grace" });
    expect(user).toBeInstanceOf(User);

    expect(() => User.parse({ name: "" })).toThrow(ValidationError);
  });

  it("static safeParse(invalid) returns {success:false, errors} without throwing", () => {
    const result = User.safeParse({ name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it("static safeParse(valid) returns {success:true, data instanceof X}", () => {
    const result = User.safeParse({ name: "Ada" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeInstanceOf(User);
      expect((result.data as unknown as { name: string }).name).toBe("Ada");
    }
  });

  it("polymorphism: pure JS subclass resolves parse/safeParse via new.target", () => {
    class AdminUser extends User {
      isAdmin(): boolean {
        return true;
      }
    }

    const admin = AdminUser.parse({ name: "Root" });
    expect(admin).toBeInstanceOf(AdminUser);
    expect(admin).toBeInstanceOf(User);
    expect((admin as unknown as AdminUser).isAdmin()).toBe(true);

    const safe = AdminUser.safeParse({ name: "Root2" });
    expect(safe.success).toBe(true);
    if (safe.success) {
      expect(safe.data).toBeInstanceOf(AdminUser);
    }
  });

  it("toJSON: writeOnly field is omitted, DateTime field serializes to ISO string", () => {
    class Account extends Struct({
      name: Text({ min: 1 }),
      password: Password({ writeOnly: true }),
      createdAt: DateTime(),
    }) {}

    const account = new Account({
      name: "Ada",
      password: "hunter2",
      createdAt: "2024-01-01T00:00:00.000Z",
    });

    const json = (account as unknown as { toJSON(): Record<string, unknown> }).toJSON();
    expect(json).not.toHaveProperty("password");
    expect(json.name).toBe("Ada");
    expect(json.createdAt).toBe("2024-01-01T00:00:00.000Z");
  });

  it("toJSON: Embed instance serializes recursively via its own toJSON", () => {
    class Address extends Struct({
      city: Text({ min: 1 }),
      secret: Password({ writeOnly: true }),
    }) {}

    class Parent extends Struct({
      name: Text({ min: 1 }),
      address: Embed(Address as unknown as Parameters<typeof Embed>[0]),
    }) {}

    const parent = new Parent({
      name: "Ada",
      address: { city: "Recife", secret: "shh" },
    });

    const json = (parent as unknown as { toJSON(): Record<string, unknown> }).toJSON();
    expect(json.address).toEqual({ city: "Recife" });
    expect(json.address as Record<string, unknown>).not.toHaveProperty("secret");
  });

  it("safeParse does not run the pre hook twice", () => {
    let preCalls = 0;
    class Counted extends Struct(
      { name: Text({ min: 1 }) },
      {
        pre: (val) => {
          preCalls++;
          return val;
        },
      },
    ) {}

    const result = Counted.safeParse({ name: "Ada" });
    expect(result.success).toBe(true);
    expect(preCalls).toBe(1);
  });

  it("STRUCT_META is attached and accessible on the class", () => {
    expect(User[STRUCT_META]).toBeDefined();
    expect(Object.keys(User[STRUCT_META].fields)).toContain("name");
  });
});
