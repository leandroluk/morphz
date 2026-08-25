import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Struct } from "../../src/core/struct.js";
import { Text } from "../../src/primitives/text.js";
import type { FieldDescriptor } from "../../src/core/field-descriptor.js";

class FakeObjectId {
  constructor(public hex: string) {}
  toHexString(): string {
    return this.hex;
  }
}

function MongoId(overrides: { immutable?: boolean } = {}): FieldDescriptor<FakeObjectId> {
  return {
    zodSchema: z.string().regex(/^[0-9a-fA-F]{24}$/),
    meta: {
      immutable: overrides.immutable,
      get: (accessor) => new FakeObjectId(accessor.value as string),
      set: (val, accessor) => {
        accessor.value = val instanceof FakeObjectId ? val.toHexString() : (val as string);
      },
    },
  };
}

describe("property-interceptors integration", () => {
  const HEX_A = "507f1f77bcf86cd799439011";
  const HEX_B = "507f191e810c19729de860ea";

  class User extends Struct({
    id: MongoId(),
    name: Text({ min: 1 }),
  }) {}

  it("(a) reading the field after parse returns a real domain instance", () => {
    const user = User.parse({ id: HEX_A, name: "John" }) as User & { id: FakeObjectId };
    expect(user.id).toBeInstanceOf(FakeObjectId);
    expect(user.id.toHexString()).toBe(HEX_A);
  });

  it("(b) toJSON() returns the pure wire string, not the domain object", () => {
    const user = User.parse({ id: HEX_A, name: "John" }) as User & {
      toJSON(): Record<string, unknown>;
    };
    const json = user.toJSON();
    expect(json.id).toBe(HEX_A);
    expect(typeof json.id).toBe("string");
  });

  it("(c) reassigning a non-immutable get/set field works", () => {
    const user = User.parse({ id: HEX_A, name: "John" }) as User & { id: FakeObjectId };
    user.id = new FakeObjectId(HEX_B);
    expect(user.id.toHexString()).toBe(HEX_B);
    user.id = HEX_A as unknown as FakeObjectId;
    expect(user.id.toHexString()).toBe(HEX_A);
  });

  class Account extends Struct({
    id: MongoId({ immutable: true }),
    name: Text({ min: 1 }),
  }) {}

  it("(d) reassigning an immutable get/set field after construction throws", () => {
    const account = Account.parse({ id: HEX_A, name: "John" }) as Account & { id: FakeObjectId };
    expect(account.id.toHexString()).toBe(HEX_A);
    expect(() => {
      account.id = new FakeObjectId(HEX_B);
    }).toThrow(/immutable/);
  });
});
