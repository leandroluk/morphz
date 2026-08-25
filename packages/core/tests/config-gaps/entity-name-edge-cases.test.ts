import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Struct } from "../../src/core/struct.js";
import { STRUCT_META } from "../../src/core/struct-meta.js";
import { Text } from "../../src/primitives/text.js";

declare global {
  // eslint-disable-next-line no-var
  var __entityNameDerivationCalls: string[] | undefined;
}

describe("entityName auto-derivation edge cases (config-gaps)", () => {
  const originalCwd = process.cwd();
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "morphz-entityname-edge-"));
    writeFileSync(
      join(tmpDir, "morphz.config.mjs"),
      [
        "globalThis.__entityNameDerivationCalls = globalThis.__entityNameDerivationCalls || [];",
        "export default { labels: { entityName: (ctx) => {",
        "  globalThis.__entityNameDerivationCalls.push(ctx.className);",
        "  return ctx.className.replace(/(Entity|Model)$/, '');",
        "} } };",
      ].join("\n"),
    );
    process.chdir(tmpDir);
    globalThis.__entityNameDerivationCalls = [];
  });

  afterAll(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("calls the deriver exactly once per class even across multiple instances", () => {
    class ThingEntity extends Struct({ name: Text({ description: "#entityName field" }) }, {}) {}

    ThingEntity.parse({ name: "a" });
    ThingEntity.parse({ name: "b" });
    new ThingEntity({ name: "c" });

    const calls = (globalThis.__entityNameDerivationCalls ?? []).filter((c) => c === "ThingEntity");
    expect(calls).toHaveLength(1);
  });

  it("resolves each class's own name independently, no cross-class leakage", () => {
    class AlphaEntity extends Struct({ name: Text({ description: "#entityName A" }) }, {}) {}
    class BetaEntity extends Struct({ name: Text({ description: "#entityName B" }) }, {}) {}

    AlphaEntity.parse({ name: "a" });
    BetaEntity.parse({ name: "b" });

    const alphaMeta = (
      AlphaEntity as unknown as {
        [STRUCT_META]: { fields: Record<string, { meta: { description?: string } }> };
      }
    )[STRUCT_META];
    const betaMeta = (
      BetaEntity as unknown as {
        [STRUCT_META]: { fields: Record<string, { meta: { description?: string } }> };
      }
    )[STRUCT_META];

    expect(alphaMeta.fields.name.meta.description).toBe("#entityName A".replace("#entityName", "Alpha"));
    expect(betaMeta.fields.name.meta.description).toBe("#entityName B".replace("#entityName", "Beta"));
  });

  it(".extend() propagates lazy entityName derivation to the subclass's own name", () => {
    class BaseEntity extends Struct({ name: Text({ description: "Name of #entityName" }) }, {}) {}
    class ChildEntity extends BaseEntity.extend({
      note: Text({ description: "Note for #entityName", deprecated: "use `name` instead" }),
    }) {}

    // Constructing the CHILD (never the base) -- child's own class name
    // ("ChildEntity" -> "Child") must be what gets derived, not the parent's.
    ChildEntity.parse({ name: "x", note: "y" });

    const childMeta = (
      ChildEntity as unknown as {
        [STRUCT_META]: {
          fields: Record<string, { meta: { description?: string; deprecated?: boolean | string } }>;
        };
      }
    )[STRUCT_META];

    expect(childMeta.fields.name.meta.description).toBe("Name of Child");
    expect(childMeta.fields.note.meta.description).toBe("Note for Child");
    expect(childMeta.fields.note.meta.deprecated).toBe("use `name` instead");
  });
});
