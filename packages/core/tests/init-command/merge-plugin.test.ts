import { describe, expect, it } from "vitest";
import { mergePluginEntry } from "../../src/cli.js";

const PLUGIN = `{ "name": "morphz/ts-plugin" }`;

describe("mergePluginEntry", () => {
  it("adds compilerOptions + plugins when neither exists", () => {
    const r = mergePluginEntry(`{\n  "compilerOptions": { "strict": true }\n}\n`);
    expect(r.action).toBe("updated");
    if (r.action === "updated") {
      expect(r.text).toMatch(/"plugins"/);
      expect(r.text).toMatch(/morphz\/ts-plugin/);
      expect(r.text).toMatch(/"strict": true/); // sibling preserved
    }
  });

  it("appends to an existing plugins array, keeping other entries", () => {
    const src = `{
  "compilerOptions": {
    "plugins": [{ "name": "typescript-plugin-css-modules" }]
  }
}
`;
    const r = mergePluginEntry(src);
    expect(r.action).toBe("updated");
    if (r.action === "updated") {
      expect(r.text).toMatch(/typescript-plugin-css-modules/);
      expect(r.text).toMatch(/morphz\/ts-plugin/);
    }
  });

  it("is a no-op when morphz/ts-plugin is already present", () => {
    const src = `{ "compilerOptions": { "plugins": [${PLUGIN}] } }`;
    expect(mergePluginEntry(src).action).toBe("already");
  });

  it("preserves comments and trailing commas", () => {
    const src = `{
  // project config
  "compilerOptions": {
    "strict": true, // recommended
  },
}
`;
    const r = mergePluginEntry(src);
    expect(r.action).toBe("updated");
    if (r.action === "updated") {
      expect(r.text).toContain("// project config");
      expect(r.text).toContain("// recommended");
      expect(r.text).toMatch(/morphz\/ts-plugin/);
    }
  });

  it("bails to print on genuinely broken JSON", () => {
    expect(mergePluginEntry(`{ "compilerOptions": `).action).toBe("print");
    expect(mergePluginEntry(`not json at all`).action).toBe("print");
  });

  it("bails to print when plugins is not an array", () => {
    expect(mergePluginEntry(`{ "compilerOptions": { "plugins": "nope" } }`).action).toBe("print");
  });
});
