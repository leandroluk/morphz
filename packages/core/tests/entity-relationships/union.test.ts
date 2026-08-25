import { describe, expect, it } from "vitest";
import { Struct } from "../../src/core/struct.js";
import { Embed } from "../../src/core/embed.js";
import { Union } from "../../src/core/union.js";
import { Literal } from "../../src/core/literal.js";
import { Text } from "../../src/primitives/text.js";
import { Number as NumberField } from "../../src/primitives/number.js";

describe("Union", () => {
  it("mixed Literal members fall back to a plain union", () => {
    const status = Union([Literal("DRAFT"), Literal("PUBLISHED"), Literal("ARCHIVED")]);
    expect(status.zodSchema.parse("DRAFT")).toBe("DRAFT");
    expect(() => status.zodSchema.parse("DELETED")).toThrow();
  });

  it("resolves as a discriminated union between Struct members embedded via Embed()", () => {
    class Draft extends Struct({ kind: Literal("draft"), title: Text() }, {}) {}
    class Published extends Struct(
      { kind: Literal("published"), title: Text(), publishedAt: Text() },
      {},
    ) {}

    const postUnion = Union([Embed(Draft), Embed(Published)]);

    const draft = postUnion.zodSchema.parse({ kind: "draft", title: "wip" });
    expect(draft).toBeInstanceOf(Draft);

    const published = postUnion.zodSchema.parse({
      kind: "published",
      title: "done",
      publishedAt: "2024-01-01",
    });
    expect(published).toBeInstanceOf(Published);

    // discriminated union gives a fast, precise rejection on a wrong-shape input
    // for the matched discriminator branch (missing publishedAt on 'published')
    expect(() => postUnion.zodSchema.parse({ kind: "published", title: "done" })).toThrow();
  });

  it("a Struct member missing the shared key falls back to plain union (no crash)", () => {
    class A extends Struct({ kind: Literal("a"), x: Text() }, {}) {}
    class B extends Struct({ y: NumberField() }, {}) {}

    const mixed = Union([Embed(A), Embed(B)]);
    const a = mixed.zodSchema.parse({ kind: "a", x: "hi" });
    expect(a).toBeInstanceOf(A);
    const b = mixed.zodSchema.parse({ y: 5 });
    expect(b).toBeInstanceOf(B);
  });
});
