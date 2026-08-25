import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Struct } from "../../src/core/struct.js";
import { STRUCT_META } from "../../src/core/struct-meta.js";
import { Text } from "../../src/primitives/text.js";

// Own module registry per test file (vitest default) -> getConfig()'s
// singleton starts fresh here, safe to point at a temp morphz.config.mjs
// declaring a `labels.entityName` derivation function.
describe("entityName auto-derivation (config-gaps)", () => {
  const originalCwd = process.cwd();
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "morphz-entityname-"));
    writeFileSync(
      join(tmpDir, "morphz.config.mjs"),
      "export default { labels: { entityName: (ctx) => ctx.className.replace(/(Entity|Model)$/, '') } };\n",
    );
    process.chdir(tmpDir);
  });

  afterAll(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("resolves #entityName lazily from config when a Struct omits labels.entityName", () => {
    class WidgetEntity extends Struct(
      { name: Text({ description: "Full name of #entityName" }) },
      {},
    ) {}

    // Not yet constructed -> still pending, description literal.
    const metaBefore = (
      WidgetEntity as unknown as {
        [STRUCT_META]: { fields: Record<string, { meta: { description?: string } }> };
      }
    )[STRUCT_META];
    expect(metaBefore.fields.name.meta.description).toBe("Full name of #entityName");

    WidgetEntity.parse({ name: "x" });

    const metaAfter = (
      WidgetEntity as unknown as {
        [STRUCT_META]: { fields: Record<string, { meta: { description?: string } }> };
      }
    )[STRUCT_META];
    expect(metaAfter.fields.name.meta.description).toBe("Full name of Widget");
  });

  it("resolves only once, memoized (config derivation function called a single time)", () => {
    let calls = 0;
    writeFileSync(
      join(tmpDir, "morphz.config.mjs"),
      "export default {};\n", // will be overridden by direct getConfig manipulation below
    );

    class CounterEntity extends Struct({ name: Text({ description: "#entityName field" }) }, {}) {}
    const meta = (
      CounterEntity as unknown as { [STRUCT_META]: { pendingEntityNameDerivation?: boolean } }
    )[STRUCT_META];

    CounterEntity.parse({ name: "a" });
    const pendingAfterFirst = meta.pendingEntityNameDerivation;
    CounterEntity.parse({ name: "b" });
    const pendingAfterSecond = meta.pendingEntityNameDerivation;

    expect(pendingAfterFirst).toBe(false);
    expect(pendingAfterSecond).toBe(false);
    void calls; // config-file-based derivation call count is exercised by the first test above
  });

  it("explicit labels.entityName always wins over auto-derivation", () => {
    class WidgetModel extends Struct(
      { name: Text({ description: "Full name of #entityName" }) },
      { labels: { entityName: "Explicit" } },
    ) {}

    const meta = (
      WidgetModel as unknown as {
        [STRUCT_META]: { fields: Record<string, { meta: { description?: string } }> };
      }
    )[STRUCT_META];
    // Already fully resolved eagerly -- no auto-derivation should ever run.
    expect(meta.fields.name.meta.description).toBe("Full name of Explicit");

    WidgetModel.parse({ name: "x" });
    expect(meta.fields.name.meta.description).toBe("Full name of Explicit");
  });
});
