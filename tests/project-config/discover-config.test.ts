import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { discoverConfig } from "../../src/core/config.js";

describe("discoverConfig", () => {
  const originalCwd = process.cwd();
  let tmpDir: string | undefined;

  afterEach(() => {
    process.chdir(originalCwd);
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = undefined;
    }
  });

  it("returns undefined when no config file exists anywhere upward", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "morphz-noconfig-"));
    process.chdir(tmpDir);
    // A temp dir under the OS tmp root has no morphz.config.* in any
    // ancestor in practice — if this ever flakes in a weird CI tmp layout,
    // it's an environment issue, not a discoverConfig() bug.
    expect(discoverConfig()).toBeUndefined();
  });

  it("finds and loads a morphz.config.mjs from process.cwd()", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "morphz-config-"));
    writeFileSync(
      join(tmpDir, "morphz.config.mjs"),
      "export default { locale: { default: 'pt-BR' }, template: { delimiter: '@' } };\n",
    );
    process.chdir(tmpDir);

    const config = discoverConfig();
    expect(config?.locale?.default).toBe("pt-BR");
    expect(config?.template?.delimiter).toBe("@");
  });

  it("finds a config from a nested subdirectory (upward search)", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "morphz-config-nested-"));
    writeFileSync(
      join(tmpDir, "morphz.config.mjs"),
      "export default { locale: { default: 'en-US' } };\n",
    );
    const nested = join(tmpDir, "a", "b", "c");
    mkdirSync(nested, { recursive: true });
    process.chdir(nested);

    const config = discoverConfig();
    expect(config?.locale?.default).toBe("en-US");
  });
});
