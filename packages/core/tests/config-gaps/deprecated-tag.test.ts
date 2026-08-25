import { describe, expect, it } from "vitest";
import { buildFieldTags } from "../../src/core/jsdoc/build-field-tags.js";
import { Text } from "../../src/primitives/text.js";

describe("buildFieldTags @deprecated", () => {
  it("emits a bare @deprecated tag when meta.deprecated is true", () => {
    const { tags } = buildFieldTags(Text({ deprecated: true }), "en-US");
    expect(tags).toContainEqual({ tagName: "deprecated", text: undefined });
  });

  it("emits @deprecated with a reason when meta.deprecated is a string", () => {
    const { tags } = buildFieldTags(Text({ deprecated: "use `newField` instead" }), "en-US");
    expect(tags).toContainEqual({ tagName: "deprecated", text: "use `newField` instead" });
  });

  it("omits @deprecated entirely when unset", () => {
    const { tags } = buildFieldTags(Text(), "en-US");
    expect(tags.find((t) => t.tagName === "deprecated")).toBeUndefined();
  });
});
