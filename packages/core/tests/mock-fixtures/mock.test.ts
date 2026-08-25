import { z } from "zod";
import { describe, expect, it } from "vitest";
import { Struct } from "../../src/core/struct.js";
import { Embed } from "../../src/core/embed.js";
import { Ref } from "../../src/core/ref.js";
import { FromZodType } from "../../src/core/from-zod-type.js";
import { Text } from "../../src/primitives/text.js";
import { Number } from "../../src/primitives/number.js";
import { Email } from "../../src/primitives/email.js";
import { Optional } from "../../src/primitives/optional.js";
import { Uuid } from "../../src/primitives/uuid.js";

describe(".mock()", () => {
  it("uses the first declared example when present", () => {
    class User extends Struct({ name: Text({ examples: ["Ada Lovelace"] }), email: Email() }, {}) {}
    const u = (User as unknown as { mock: (o?: object) => { name: string; email: string } }).mock();
    expect(u.name).toBe("Ada Lovelace");
    expect(u.email).toBe("user@example.com");
  });

  it("overrides win over any synthesis strategy", () => {
    class User extends Struct({ name: Text({ examples: ["Ada"] }) }, {}) {}
    const u = (User as unknown as { mock: (o?: object) => { name: string } }).mock({
      name: "Grace",
    });
    expect(u.name).toBe("Grace");
  });

  it("synthesizes a regex-constrained field via randexp when no examples exist", () => {
    class Coupon extends Struct({ code: Text({ regex: /^[A-Z]{4}-\d{4}$/ }) }, {}) {}
    const c = (Coupon as unknown as { mock: (o?: object) => { code: string } }).mock();
    expect(c.code).toMatch(/^[A-Z]{4}-\d{4}$/);
  });

  it("synthesizes numeric fields within min/max", () => {
    class Product extends Struct({ price: Number({ min: 10, max: 20 }) }, {}) {}
    const p = (Product as unknown as { mock: (o?: object) => { price: number } }).mock();
    expect(p.price).toBeGreaterThanOrEqual(10);
    expect(p.price).toBeLessThanOrEqual(20);
  });

  it("still validates the synthesized instance (real instanceof, real methods)", () => {
    class User extends Struct({ name: Text({ examples: ["Ada"] }) }, {}) {
      greet(): string {
        return `hi ${this.name as string}`;
      }
    }
    const u = (
      User as unknown as {
        mock: (o?: object) => { greet(): string };
      }
    ).mock();
    expect(u).toBeInstanceOf(User);
    expect(u.greet()).toBe("hi Ada");
  });

  it("recursively mocks Embed()-ed fields", () => {
    class Address extends Struct({ city: Text({ examples: ["SP"] }) }, {}) {}
    class User extends Struct({ address: Embed(Address) }, {}) {}
    const u = (User as unknown as { mock: (o?: object) => { address: unknown } }).mock();
    expect(u.address).toBeInstanceOf(Address);
  });

  it("recursively mocks Ref()-ed fields", () => {
    class Author extends Struct({ name: Text({ examples: ["Ada"] }) }, {}) {}
    class Post extends Struct(
      { title: Text({ examples: ["Hi"] }), author: Ref(() => Author) },
      {},
    ) {}
    const p = (Post as unknown as { mock: (o?: object) => { author: unknown } }).mock();
    expect(p.author).toBeInstanceOf(Author);
  });

  it("terminates a self-referencing Ref chain via an Optional field, no stack overflow", () => {
    class Category extends Struct(
      { name: Text({ examples: ["root"] }), parent: Optional(Ref(() => Category)) },
      {},
    ) {}
    const c = (Category as unknown as { mock: (o?: object) => { parent: unknown } }).mock();
    expect(c.parent).toBeUndefined();
  });

  it("synthesized data round-trips through a real .parse() without throwing", () => {
    class User extends Struct(
      { id: Uuid({ immutable: true }), name: Text({ examples: ["Ada"] }), email: Email() },
      {},
    ) {}
    const UserCtor = User as unknown as {
      mock: (o?: object) => { toJSON(): Record<string, unknown> };
      parse: (input: unknown) => unknown;
    };
    const mocked = UserCtor.mock();
    expect(() => UserCtor.parse(mocked.toJSON())).not.toThrow();
    const reparsed = UserCtor.parse(mocked.toJSON());
    expect(reparsed).toBeInstanceOf(User);
  });

  it("immutable fields (e.g. a PrimaryKey-shaped id) are synthesized normally, not omitted", () => {
    class User extends Struct({ id: Uuid({ immutable: true }) }, {}) {}
    const u = (User as unknown as { mock: (o?: object) => { id: string } }).mock();
    expect(typeof u.id).toBe("string");
    expect(u.id.length).toBeGreaterThan(0);
  });

  it("partial overrides leave every other field independently synthesized", () => {
    class User extends Struct(
      { name: Text({ examples: ["Ada"] }), age: Number({ min: 18, max: 99 }), email: Email() },
      {},
    ) {}
    const u = (
      User as unknown as { mock: (o?: object) => { name: string; age: number; email: string } }
    ).mock({ name: "Grace" });
    expect(u.name).toBe("Grace");
    expect(u.age).toBeGreaterThanOrEqual(18);
    expect(u.age).toBeLessThanOrEqual(99);
    expect(u.email).toBe("user@example.com");
  });

  it("required (non-Optional) mutually-circular Refs fail loud instead of hanging/overflowing", () => {
    class A extends Struct({ name: Text({ examples: ["a"] }), b: Ref((): typeof B => B) }, {}) {}
    class B extends Struct({ name: Text({ examples: ["b"] }), a: Ref(() => A) }, {}) {}
    expect(() => (A as unknown as { mock: () => unknown }).mock()).toThrow(/circular or too-deep/);
  });

  it("plain unconstrained Text() still synthesizes (no examples/default/regex needed)", () => {
    class Simple extends Struct({ note: Text() }, {}) {}
    const s = (Simple as unknown as { mock: (o?: object) => { note: string } }).mock();
    expect(typeof s.note).toBe("string");
  });

  it("throws a clear error for a genuinely unsynthesizable field (opaque FromZodType, no examples)", () => {
    // z.tuple()/z.record() are now synthesizable (mock.ts gained cases for
    // both when additional-primitives shipped Tuple/Record/Json) -- use a
    // schema shape mock.ts genuinely has no case for instead, e.g. a
    // z.instanceof() check, which stays opaque by construction.
    class Weird extends Struct({ id: FromZodType(z.instanceof(URL)) }, {}) {}
    expect(() => (Weird as unknown as { mock: () => unknown }).mock()).toThrow(/cannot synthesize/);
  });
});

describe(".mockMany()", () => {
  it("generates `count` instances, factory receiving the index", () => {
    class User extends Struct({ email: Text({ examples: ["a@x.com"] }) }, {}) {}
    const batch = (
      User as unknown as {
        mockMany: (n: number, f?: (i: number) => object) => { email: string }[];
      }
    ).mockMany(3, (i) => ({ email: `user-${i}@example.com` }));
    expect(batch).toHaveLength(3);
    expect(batch.map((u) => u.email)).toEqual([
      "user-0@example.com",
      "user-1@example.com",
      "user-2@example.com",
    ]);
  });
});
