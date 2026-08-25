import { describe, expect, it } from "vitest";
import { Struct } from "../../src/core/struct.js";
import { Embed } from "../../src/core/embed.js";
import { Text } from "../../src/primitives/text.js";
import { Password } from "../../src/primitives/password.js";
import { List } from "../../src/primitives/list.js";
import { Define } from "../../src/core/define.js";

function toMaskedJSON(instance: unknown): Record<string, unknown> {
  return (instance as { toMaskedJSON(): Record<string, unknown> }).toMaskedJSON();
}

describe("toMaskedJSON", () => {
  const MaskedEmail = Define(Text, {
    mask: (v: string) => {
      const [user, domain] = v.split("@");
      return `${user?.slice(0, 2)}***@${domain}`;
    },
  });

  it("applies mask to a field that declares one, passes through fields without mask unchanged", () => {
    class User extends Struct({
      name: Text({ min: 1 }),
      email: MaskedEmail(),
    }) {}

    const user = new User({ name: "Ada", email: "ada@example.com" });
    const masked = toMaskedJSON(user);

    expect(masked.email).toBe("ad***@example.com");
    expect(masked.name).toBe("Ada");
  });

  it("still omits writeOnly fields entirely, in addition to masking", () => {
    class User extends Struct({
      email: MaskedEmail(),
      password: Password({ writeOnly: true }),
    }) {}

    const user = new User({ email: "ada@example.com", password: "hunter2" });
    const masked = toMaskedJSON(user);

    expect(masked).not.toHaveProperty("password");
    expect(masked.email).toBe("ad***@example.com");
  });

  it("recurses into Embed instances via their own toMaskedJSON, not toJSON", () => {
    class Address extends Struct({
      email: MaskedEmail(),
      secret: Password({ writeOnly: true }),
    }) {}

    class Parent extends Struct({
      name: Text({ min: 1 }),
      address: Embed(Address as unknown as Parameters<typeof Embed>[0]),
    }) {}

    const parent = new Parent({
      name: "Ada",
      address: { email: "child@example.com", secret: "shh" },
    });

    const masked = toMaskedJSON(parent);
    const address = masked.address as Record<string, unknown>;
    expect(address.email).toBe("ch***@example.com");
    expect(address).not.toHaveProperty("secret");
  });

  it("differs from toJSON() output for a masked field (proves mask actually applies, not a no-op)", () => {
    class User extends Struct({ email: MaskedEmail() }) {}
    const user = new User({ email: "ada@example.com" });

    const plain = (user as unknown as { toJSON(): Record<string, unknown> }).toJSON();
    const masked = toMaskedJSON(user);

    expect(plain.email).toBe("ada@example.com");
    expect(masked.email).toBe("ad***@example.com");
  });

  it("applies mask BEFORE encode when a field declares both", () => {
    const MaskedAndEncoded = Define(Text, {
      mask: (v: string) => `masked(${v})`,
      encode: (v: string) => `encoded(${v})`,
    });

    class User extends Struct({ token: MaskedAndEncoded() }) {}
    const user = new User({ token: "raw-secret" });
    const masked = toMaskedJSON(user);

    // mask runs on the raw domain value first, encode wraps the masked
    // result — proves ordering, not just that both ran.
    expect(masked.token).toBe("encoded(masked(raw-secret))");
  });

  it("masks each item of a List individually via the item descriptor", () => {
    class User extends Struct({
      contacts: List(MaskedEmail()),
    }) {}

    const user = new User({
      contacts: ["ada@example.com", "bob@example.com"],
    });
    const masked = toMaskedJSON(user);

    expect(masked.contacts).toEqual(["ad***@example.com", "bo***@example.com"]);
  });
});
