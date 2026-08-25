import { describe, expect, it } from "vitest";
import { Struct } from "../../src/core/struct.js";
import { Ref } from "../../src/core/ref.js";
import { Text } from "../../src/primitives/text.js";
import { Optional } from "../../src/primitives/optional.js";

describe("Ref", () => {
  it("resolves lazily and produces a real instance", () => {
    class Post extends Struct({ title: Text() }, {}) {}

    class Author extends Struct(
      {
        name: Text(),
        latestPost: Optional(Ref(() => Post)),
      },
      {},
    ) {}

    const a = new Author({ name: "Ada", latestPost: { title: "Hello" } }) as unknown as {
      latestPost: unknown;
    };
    expect(a.latestPost).toBeInstanceOf(Post);
  });

  it("supports self-reference (Category -> parent -> Ref(() => Category))", () => {
    class Category extends Struct(
      {
        name: Text(),
        parent: Optional(Ref(() => Category)),
      },
      {},
    ) {}

    const root = new Category({ name: "root" }) as unknown as { name: string };
    const child = new Category({ name: "child", parent: { name: "root" } }) as unknown as {
      parent: unknown;
    };

    expect(root.name).toBe("root");
    expect(child.parent).toBeInstanceOf(Category);
  });
});
