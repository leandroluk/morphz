import { describe, expect, it } from "vitest";
import { renderConfigTemplate } from "../../src/cli.js";

describe("renderConfigTemplate", () => {
  it("ts/js/mjs share the ESM form", () => {
    for (const ext of ["ts", "js", "mjs"] as const) {
      const out = renderConfigTemplate(ext);
      expect(out).toContain(`import { defineConfig } from "morphz";`);
      expect(out).toContain("export default defineConfig({");
      expect(out).toContain("jsdoc: true,");
      expect(out.endsWith("});\n")).toBe(true);
    }
  });

  it("cjs uses require / module.exports", () => {
    const out = renderConfigTemplate("cjs");
    expect(out).toContain(`const { defineConfig } = require("morphz");`);
    expect(out).toContain("module.exports = defineConfig({");
  });

  it("known config keys are present, extras commented", () => {
    const out = renderConfigTemplate("ts");
    expect(out).toContain('locale: { default: "en-US", fallback: "en-US" }');
    expect(out).toContain("// labels: { entityName:");
    expect(out).toContain("// template: { delimiter:");
  });
});
