import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Struct } from "../../src/core/struct.js";
import { Embed } from "../../src/core/embed.js";
import { Text } from "../../src/primitives/text.js";
import type { FieldDescriptor } from "../../src/core/field-descriptor.js";

class FakeObjectId {
  constructor(public hex: string) {}
  toHexString(): string {
    return this.hex;
  }
}

function MongoId(overrides: { mask?: (v: string) => string } = {}): FieldDescriptor<FakeObjectId> {
  return {
    zodSchema: z.string().regex(/^[0-9a-fA-F]{24}$/),
    meta: {
      mask: overrides.mask,
      get: (accessor) => new FakeObjectId(accessor.value as string),
      set: (val, accessor) => {
        accessor.value = val instanceof FakeObjectId ? val.toHexString() : (val as string);
      },
    },
  };
}

describe("property-interceptors edge cases", () => {
  const HEX_A = "507f1f77bcf86cd799439011";
  const HEX_B = "507f191e810c19729de860ea";

  describe("(1) .mock()", () => {
    class User extends Struct({
      id: MongoId(),
      name: Text({ min: 1 }),
    }) {}

    it("synthesizes a valid instance without throwing", () => {
      const user = User.mock() as unknown as User & { id: FakeObjectId };
      expect(user.id).toBeInstanceOf(FakeObjectId);
      expect(typeof user.id.toHexString()).toBe("string");
    });
  });

  describe("(2) .toMaskedJSON() with mask on a get/set field", () => {
    class User extends Struct({
      id: MongoId({ mask: (hex) => `${hex.slice(0, 4)}****` }),
      name: Text({ min: 1 }),
    }) {}

    it("applies mask to the WIRE value, not the domain object", () => {
      const user = User.parse({ id: HEX_A, name: "John" }) as User & {
        toMaskedJSON(): Record<string, unknown>;
      };
      const masked = user.toMaskedJSON();
      expect(masked.id).toBe(`${HEX_A.slice(0, 4)}****`);
      expect(typeof masked.id).toBe("string");
    });
  });

  describe("(3) Embed with a get/set field on the child", () => {
    class Child extends Struct({
      id: MongoId(),
      label: Text({ min: 1 }),
    }) {}

    class Parent extends Struct({
      child: Embed(Child),
    }) {}

    it("reading the nested field returns the domain object", () => {
      const parent = Parent.parse({
        child: { id: HEX_A, label: "x" },
      }) as Parent & { child: Child & { id: FakeObjectId } };
      expect(parent.child.id).toBeInstanceOf(FakeObjectId);
      expect(parent.child.id.toHexString()).toBe(HEX_A);
    });

    it("toJSON()/toMaskedJSON() recurse to the child's wire value", () => {
      const parent = Parent.parse({ child: { id: HEX_A, label: "x" } }) as Parent & {
        toJSON(): Record<string, unknown>;
        toMaskedJSON(): Record<string, unknown>;
      };
      const json = parent.toJSON();
      expect((json.child as Record<string, unknown>).id).toBe(HEX_A);
      expect(typeof (json.child as Record<string, unknown>).id).toBe("string");

      const masked = parent.toMaskedJSON();
      expect((masked.child as Record<string, unknown>).id).toBe(HEX_A);
    });
  });

  describe("(4) safeParse applies get/set", () => {
    class User extends Struct({
      id: MongoId(),
      name: Text({ min: 1 }),
    }) {}

    it("safeParse's success path produces a domain-typed field", () => {
      const result = User.safeParse({ id: HEX_A, name: "John" });
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as unknown as User & { id: FakeObjectId };
        expect(data.id).toBeInstanceOf(FakeObjectId);
        expect(data.id.toHexString()).toBe(HEX_A);
      }
    });

    it("safeParse instance's toJSON() also reads the wire value", () => {
      const result = User.safeParse({ id: HEX_A, name: "John" });
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as unknown as { toJSON(): Record<string, unknown> };
        expect(data.toJSON().id).toBe(HEX_A);
      }
    });
  });

  describe("(5) repeated reassignment on a non-immutable field", () => {
    class User extends Struct({
      id: MongoId(),
      name: Text({ min: 1 }),
    }) {}

    it("never locks after the first set -- keeps accepting new values", () => {
      const user = User.parse({ id: HEX_A, name: "John" }) as User & { id: FakeObjectId };
      user.id = new FakeObjectId(HEX_B);
      expect(user.id.toHexString()).toBe(HEX_B);
      user.id = new FakeObjectId(HEX_A);
      expect(user.id.toHexString()).toBe(HEX_A);
      user.id = new FakeObjectId(HEX_B);
      expect(user.id.toHexString()).toBe(HEX_B);
    });
  });
});
