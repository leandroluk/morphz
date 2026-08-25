import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getConfig } from "../../src/core/config.js";

// This file's module registry is isolated per-vitest-file, so getConfig()'s
// module-level singleton starts fresh here — safe to test discovery timing
// without interference from other test files that may also call getConfig()
// (directly, or indirectly via resolveLocale()/Struct()'s template resolver).
describe("getConfig singleton", () => {
  const originalCwd = process.cwd();
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "morphz-getconfig-"));
    writeFileSync(
      join(tmpDir, "morphz.config.mjs"),
      "export default { locale: { default: 'fr-FR' } };\n",
    );
    process.chdir(tmpDir);
  });

  afterAll(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("discovers config on first call and returns the same cached object on subsequent calls", () => {
    const first = getConfig();
    expect(first.locale?.default).toBe("fr-FR");

    const second = getConfig();
    expect(second).toBe(first); // same reference -> proves it's cached, not re-discovered
  });
});
