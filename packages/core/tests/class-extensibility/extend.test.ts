import { describe, expect, it } from "vitest";
import { Struct } from "../../src/core/struct.js";
import { Text } from "../../src/primitives/text.js";
import { Uuid } from "../../src/primitives/uuid.js";

const User = Struct(
  {
    id: Uuid({ immutable: true }),
    name: Text({ min: 2 }),
  },
  { labels: { entityName: "User" } },
) as unknown as {
  new (input: unknown): { id: string; name: string };
  extend(fields: Record<string, unknown>): unknown;
};

describe("extend", () => {
  it("produces a real subclass: instanceof holds for both AdminUser and User", () => {
    class AdminUser extends (User.extend({ department: Text() }) as unknown as new (
      input: unknown,
    ) => { id: string; name: string; department: string }) {
      shout(): string {
        return `${(this as unknown as { name: string }).name}!`;
      }
    }

    const admin = new AdminUser({
      id: "123e4567-e89b-12d3-a456-426614174000",
      name: "Ada",
      department: "eng",
    });

    expect(admin).toBeInstanceOf(AdminUser);
    expect(admin).toBeInstanceOf(User as unknown as new (input: unknown) => unknown);
    expect(admin.department).toBe("eng");
    expect(admin.shout()).toBe("Ada!");
  });

  it("applies meta.default on a newly extended field, same as Struct() itself", () => {
    const WithDefault = User.extend({
      department: Text({ default: () => "unassigned" }),
    }) as unknown as { new (input: unknown): { department: string } };

    expect(
      new WithDefault({ id: "123e4567-e89b-12d3-a456-426614174000", name: "Ada" }).department,
    ).toBe("unassigned");
  });

  it("redeclaring an existing field name silently overrides the parent's", () => {
    const Extended = User.extend({ name: Text({ min: 10 }) }) as unknown as {
      new (input: unknown): { name: string };
    };

    expect(
      () => new Extended({ id: "123e4567-e89b-12d3-a456-426614174000", name: "short" }),
    ).toThrow();
    expect(
      new Extended({ id: "123e4567-e89b-12d3-a456-426614174000", name: "long enough" }).name,
    ).toBe("long enough");
  });
});
