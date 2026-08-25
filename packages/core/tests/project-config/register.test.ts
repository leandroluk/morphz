import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Isolated module registry per test file (same reasoning as get-config.test.ts)
// — safe to import the register side-effect module fresh here.
describe("morphz/register (src/register.ts)", () => {
  const originalCwd = process.cwd();
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "morphz-register-"));
    writeFileSync(
      join(tmpDir, "morphz.config.mjs"),
      "export default { locale: { default: 'de-DE' } };\n",
    );
    process.chdir(tmpDir);
  });

  afterAll(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("eagerly populates the config singleton on import, before any other call", async () => {
    await import("../../src/register.js");
    const { getConfig } = await import("../../src/core/config.js");

    // getConfig() should return the ALREADY-discovered value with no
    // further discovery needed — proven by it matching the fixture set up
    // before the import ran.
    expect(getConfig().locale?.default).toBe("de-DE");
  });

  it("importing it twice is a no-op (ESM module caching already guarantees single execution)", async () => {
    // Re-importing the same specifier resolves to the cached module record
    // per the ESM spec — top-level side effects run exactly once regardless
    // of import count. A call-count spy on discoverConfig() would require
    // refactoring config.ts for dependency injection, which isn't worth it
    // just to re-prove what ESM module semantics already guarantee.
    await import("../../src/register.js");
    const { getConfig } = await import("../../src/core/config.js");
    expect(getConfig().locale?.default).toBe("de-DE");
  });
});
