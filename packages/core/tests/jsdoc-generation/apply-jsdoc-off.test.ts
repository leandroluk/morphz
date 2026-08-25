import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

// See apply-jsdoc.test.ts's top comment for why this imports from the
// built dist/index.js and why this case needs its OWN file (a fresh
// getConfig() singleton, isolated per-file by vitest).
const CORE_DIST_INDEX = pathToFileURL(join(__dirname, "..", "..", "dist", "index.js")).href;
const { applyJsDoc } = (await import(CORE_DIST_INDEX)) as {
  applyJsDoc: (options: { jsEntryPath: string; dtsPath: string }) => Promise<void>;
};

describe("applyJsDoc — jsdoc disabled", () => {
  const originalCwd = process.cwd();
  let tmpDir: string | undefined;

  afterEach(() => {
    process.chdir(originalCwd);
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = undefined;
    }
  });

  it("is a no-op (file untouched) when jsdoc is unset/false", async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "morphz-jsdoc-off-"));
    writeFileSync(join(tmpDir, "morphz.config.cjs"), "module.exports = {};\n");

    writeFileSync(
      join(tmpDir, "fixture.mjs"),
      `
import { Struct, Text } from "${CORE_DIST_INDEX}";
export class Plain extends Struct({ name: Text({ description: "x" }) }, {}) {}
`,
    );
    writeFileSync(join(tmpDir, "fixture.d.ts"), `export declare class Plain {\n  name: string;\n}\n`);

    process.chdir(tmpDir);

    const before = readFileSync(join(tmpDir, "fixture.d.ts"), "utf-8");
    await applyJsDoc({ jsEntryPath: "./fixture.mjs", dtsPath: "./fixture.d.ts" });
    const after = readFileSync(join(tmpDir, "fixture.d.ts"), "utf-8");

    expect(after).toBe(before);
  });
});
