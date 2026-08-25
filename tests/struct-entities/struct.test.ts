import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Struct } from "../../src/core/struct.js";
import { STRUCT_META } from "../../src/core/struct-meta.js";
import { Text } from "../../src/primitives/text.js";
import { Uuid } from "../../src/primitives/uuid.js";

describe("Struct() basics", () => {
  class Foo extends Struct(
    { id: Uuid({ default: () => "00000000-0000-0000-0000-000000000000" }), name: Text({ min: 2 }) },
    { labels: { entityName: "Foo" } },
  ) {}

  it("constructs a real instance with validated fields", () => {
    const foo = new Foo({ id: "11111111-1111-4111-8111-111111111111", name: "ab" });
    expect(foo).toBeInstanceOf(Foo);
    expect(foo.name).toBe("ab");
    expect(foo.id).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("throws on invalid input", () => {
    expect(() => new Foo({ id: "11111111-1111-4111-8111-111111111111", name: "a" })).toThrow();
  });

  it("applies meta.default when field absent", () => {
    const foo = new Foo({ name: "ab" });
    expect(foo.id).toBe("00000000-0000-0000-0000-000000000000");
  });
});

describe("new.target polymorphism", () => {
  class Base extends Struct({ name: Text() }, { labels: { entityName: "Base" } }) {}
  class Sub extends Base {
    greet() {
      return `hi ${this.name}`;
    }
  }

  it("subclass instances satisfy instanceof for both classes", () => {
    const sub = new Sub({ name: "x" });
    expect(sub).toBeInstanceOf(Sub);
    expect(sub).toBeInstanceOf(Base);
    expect(sub.greet()).toBe("hi x");
  });

  it("static parse() inherited by subclass resolves to the subclass via new.target", () => {
    const sub = Sub.parse({ name: "y" }) as Sub;
    expect(sub).toBeInstanceOf(Sub);
    expect(sub).toBeInstanceOf(Base);
    expect(sub.greet()).toBe("hi y");
  });

  it("calling parse on the base class still produces a Base instance, not Sub", () => {
    const base = Base.parse({ name: "z" });
    expect(base).toBeInstanceOf(Base);
    expect(base).not.toBeInstanceOf(Sub);
  });
});

describe("template resolution", () => {
  class Widget extends Struct(
    { label: Text({ description: "Label of #entityName" }) },
    { labels: { entityName: "Widget" } },
  ) {}

  it("resolves #entityName placeholder using labels", () => {
    const resolved = (
      Widget as unknown as {
        [STRUCT_META]: { fields: Record<string, { meta: { description?: string } }> };
      }
    )[STRUCT_META].fields.label.meta.description;
    expect(resolved).toBe("Label of Widget");
  });

  it("leaves unresolved placeholders untouched (no matching label)", () => {
    class NoLabel extends Struct({ label: Text({ description: "Uses #missing here" }) }, {}) {}
    const resolved = (
      NoLabel as unknown as {
        [STRUCT_META]: { fields: Record<string, { meta: { description?: string } }> };
      }
    )[STRUCT_META].fields.label.meta.description;
    expect(resolved).toBe("Uses #missing here");
  });
});

describe("pre hook", () => {
  class User extends Struct(
    { username: Text() },
    {
      pre: (val) => ({
        ...(val as Record<string, unknown>),
        username: String((val as { username: unknown }).username).toLowerCase(),
      }),
    },
  ) {}

  it("normalizes input before field validation", () => {
    const user = new User({ username: "ABC" });
    expect(user.username).toBe("abc");
  });
});

describe("post hook", () => {
  class Range extends Struct(
    { start: Text(), end: Text() },
    {
      post: (val, ctx) => {
        const v = val as { start: string; end: string };
        if (v.start >= v.end) {
          (ctx as { addIssue: (i: unknown) => void }).addIssue({
            code: "custom",
            path: ["end"],
            message: "end must be after start",
          });
        }
      },
    },
  ) {}

  it("rejects when cross-field rule fails", () => {
    expect(() => new Range({ start: "b", end: "a" })).toThrow();
  });

  it("accepts when cross-field rule passes", () => {
    const r = new Range({ start: "a", end: "b" });
    expect(r.start).toBe("a");
  });
});

describe("STRUCT_META", () => {
  class Sample extends Struct({ id: Uuid() }, { labels: { entityName: "Sample" } }) {}

  it("rawObjectSchema is a bare ZodObject reflecting the field shape", () => {
    const meta = (
      Sample as unknown as { [STRUCT_META]: { rawObjectSchema: z.ZodObject; schema: z.ZodType } }
    )[STRUCT_META];
    expect(meta.rawObjectSchema).toBeInstanceOf(z.ZodObject);
    expect(Object.keys(meta.rawObjectSchema.shape)).toContain("id");
  });

  it("fields carries resolved descriptors", () => {
    const meta = (Sample as unknown as { [STRUCT_META]: { fields: Record<string, unknown> } })[
      STRUCT_META
    ];
    expect(meta.fields.id).toBeDefined();
  });
});
