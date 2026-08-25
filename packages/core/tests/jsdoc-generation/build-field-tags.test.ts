import { describe, expect, it } from "vitest";
import { buildFieldTags } from "../../src/core/jsdoc/build-field-tags.js";
import { Text } from "../../src/primitives/text.js";

describe("buildFieldTags", () => {
  it("composes description + @default + @example + @readonly + @writeOnly + constraint tags", () => {
    const descriptor = Text({
      description: "A field",
      min: 2,
      max: 5,
      default: () => "abc",
      examples: ["abc", "xyz"],
      immutable: true,
      writeOnly: true,
    });

    const { description, tags } = buildFieldTags(descriptor, "en-US");

    expect(description).toBe("A field");
    expect(tags).toContainEqual({ tagName: "default", text: "abc" });
    expect(tags).toContainEqual({ tagName: "example", text: "abc" });
    expect(tags).toContainEqual({ tagName: "example", text: "xyz" });
    expect(tags).toContainEqual({ tagName: "readonly" });
    expect(tags).toContainEqual({ tagName: "writeOnly" });
    expect(tags).toContainEqual({ tagName: "minLength", text: "2" });
    expect(tags).toContainEqual({ tagName: "maxLength", text: "5" });
  });

  it("resolves an i18n description map by locale, falling back", () => {
    const descriptor = Text();
    descriptor.meta.description = { "pt-BR": "Um campo", "en-US": "A field" } as unknown as string;

    expect(buildFieldTags(descriptor, "pt-BR").description).toBe("Um campo");
    expect(buildFieldTags(descriptor, "fr-FR", "en-US").description).toBe("A field");
    expect(buildFieldTags(descriptor, "fr-FR").description).toBe("Um campo"); // first available key
  });

  it("omits tags entirely for a bare field with no meta", () => {
    const { description, tags } = buildFieldTags(Text(), "en-US");
    expect(description).toBe("");
    expect(tags).toEqual([]);
  });
});
