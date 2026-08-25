import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Isolated module registry per test file — resolveLocale.ts's default
// configLocaleReader closure captures getConfig() from THIS file's own
// fresh module instance, so this doesn't collide with other test files'
// (or resolve-locale.test.ts's own) singleton state.
describe("resolveLocale() reading a real discovered config", () => {
  const originalCwd = process.cwd();
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "morphz-resolvelocale-"));
    writeFileSync(
      join(tmpDir, "morphz.config.mjs"),
      "export default { locale: { default: 'ja-JP' } };\n",
    );
    process.chdir(tmpDir);
  });

  afterAll(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("uses config.locale.default when no AsyncLocalStorage context is set", async () => {
    const { resolveLocale } = await import("../../src/core/i18n/resolve-locale.js");
    expect(resolveLocale()).toBe("ja-JP");
  });
});
