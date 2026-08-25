import { describe, expect, it } from "vitest";
import { extractFieldConstraints } from "../../src/core/jsdoc/extract-constraints.js";
import { Text } from "../../src/primitives/text.js";
import { Number } from "../../src/primitives/number.js";
import { Email } from "../../src/primitives/email.js";
import { Optional } from "../../src/primitives/optional.js";

describe("extractFieldConstraints", () => {
  it("extracts @minLength/@maxLength/@pattern for a regex+min+max Text field", () => {
    const tags = extractFieldConstraints(Text({ min: 2, max: 10, regex: /^[a-z]+$/ }).zodSchema);
    expect(tags).toContainEqual({ tagName: "minLength", text: "2" });
    expect(tags).toContainEqual({ tagName: "maxLength", text: "10" });
    expect(tags).toContainEqual({ tagName: "pattern", text: "^[a-z]+$" });
  });

  it("extracts @minimum/@maximum for a Number field", () => {
    const tags = extractFieldConstraints(Number({ min: 0, max: 100 }).zodSchema);
    expect(tags).toContainEqual({ tagName: "minimum", text: "0" });
    expect(tags).toContainEqual({ tagName: "maximum", text: "100" });
  });

  it("extracts @format for a format-check primitive like Email", () => {
    const tags = extractFieldConstraints(Email().zodSchema);
    expect(tags).toContainEqual({ tagName: "format", text: "email" });
  });

  it("unwraps Optional() to reach the inner schema's constraints", () => {
    const tags = extractFieldConstraints(Optional(Text({ min: 3 })).zodSchema);
    expect(tags).toContainEqual({ tagName: "minLength", text: "3" });
  });

  it("returns an empty array for a schema with no checks", () => {
    expect(extractFieldConstraints(Text().zodSchema)).toEqual([]);
  });
});
