import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Struct } from "../../src/core/struct.js";
import { STRUCT_META } from "../../src/core/struct-meta.js";
import { Text } from "../../src/primitives/text.js";

// No morphz.config anywhere on the path -> getConfig() is `{}`. The
// identity default deriver (default-entity-name) must still fill
// `#entityName` from the bare class name, zero config.
describe("entityName default = class name (default-entity-name)", () => {
  const originalCwd = process.cwd();
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "morphz-entityname-default-"));
    process.chdir(tmpDir);
  });

  afterAll(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function descOf(klass: unknown, field: string): string | undefined {
    return (
      klass as unknown as {
        [STRUCT_META]: { fields: Record<string, { meta: { description?: string } }> };
      }
    )[STRUCT_META].fields[field]?.meta.description;
  }

  it("resolves #entityName to the class name with no config file", () => {
    class Widget extends Struct({ name: Text({ description: "Name of #entityName" }) }, {}) {}

    // pending until first construction
    expect(descOf(Widget, "name")).toBe("Name of #entityName");
    Widget.parse({ name: "x" });
    expect(descOf(Widget, "name")).toBe("Name of Widget");
  });

  it("explicit labels.entityName still wins over the default", () => {
    class Gadget extends Struct(
      { name: Text({ description: "Name of #entityName" }) },
      { labels: { entityName: "Overridden" } },
    ) {}
    expect(descOf(Gadget, "name")).toBe("Name of Overridden");
    Gadget.parse({ name: "x" });
    expect(descOf(Gadget, "name")).toBe("Name of Overridden");
  });

  it(".extend() derives the subclass's OWN name, not the base's", () => {
    class Base extends Struct({ name: Text({ description: "Name of #entityName" }) }, {}) {}
    class Child extends Base.extend({ note: Text({ description: "Note for #entityName" }) }) {}

    Child.parse({ name: "x", note: "y" });
    expect(descOf(Child, "name")).toBe("Name of Child");
    expect(descOf(Child, "note")).toBe("Note for Child");
  });

  it(".omit() pins the source's resolved name onto the DTO", () => {
    class Account extends Struct(
      {
        id: Text({ description: "Id of #entityName" }),
        secret: Text({ description: "Secret of #entityName" }),
      },
      {},
    ) {}
    // force the source to resolve first
    Account.parse({ id: "a", secret: "b" });

    const PublicAccountDto = Account.omit({ secret: true }) as unknown as {
      new (input: unknown): { id: string };
      [typeof STRUCT_META]: { fields: Record<string, { meta: { description?: string } }> };
    };
    expect(descOf(PublicAccountDto, "id")).toBe("Id of Account");
  });
});
