import { describe, expect, it } from "vitest";
import { Struct } from "../../src/core/struct.js";
import { Embed } from "../../src/core/embed.js";
import { Text } from "../../src/primitives/text.js";

describe("Embed()", () => {
  class Address extends Struct({ city: Text({ min: 2 }) }, { labels: { entityName: "Address" } }) {}

  class Parent extends Struct(
    { name: Text(), address: Embed(Address) },
    { labels: { entityName: "Parent" } },
  ) {}

  it("produces a real nested instance of the embedded Struct", () => {
    const parent = new Parent({ name: "x", address: { city: "SP" } });
    expect(parent.address).toBeInstanceOf(Address);
    expect(parent.address.city).toBe("SP");
  });

  it("rejects the whole parse when the embedded field is invalid", () => {
    expect(() => new Parent({ name: "x", address: { city: "a" } })).toThrow();
  });
});
