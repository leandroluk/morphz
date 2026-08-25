import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

// `pathToFileURL`, not a bare "C:/..." string — a bare Windows drive-letter
// path is misread by Node's ESM loader as a URL with scheme "c:" (see
// apply-jsdoc.ts's own fix for the same class of bug).
const CORE_DIST_INDEX = pathToFileURL(join(__dirname, "..", "..", "dist", "index.js")).href;

/**
 * `applyJsDoc` is imported from the BUILT `dist/index.js` here — NOT from
 * source like every other test in this repo — deliberately: `STRUCT_META`
 * is `Symbol("morphz.structMeta")`, a fresh unique symbol PER MODULE
 * EVALUATION. If `applyJsDoc` were imported from source (a separate
 * module instantiation from whatever the fixture below imports) while the
 * fixture imports `Struct`/`Text`/`Uuid` from `dist/index.js`, the two
 * sides would carry DIFFERENT `STRUCT_META` symbols and `applyJsDoc`
 * would silently find nothing (confirmed the hard way while writing this
 * test). Importing BOTH `applyJsDoc` and the fixture's morphz imports
 * from the exact same `dist/index.js` module simulates the REAL scenario
 * correctly: a consumer's build resolves `morphz` as an external
 * dependency exactly ONCE via node_modules, so their code and `morphz`'s
 * own `applyJsDoc` (also loaded from that same installed package) always
 * share the same `STRUCT_META` symbol in practice.
 */
const { applyJsDoc } = (await import(CORE_DIST_INDEX)) as {
  applyJsDoc: (options: { jsEntryPath: string; dtsPath: string }) => Promise<void>;
};

/**
 * IMPORTANT (see report): `Struct()`'s current `.d.ts` output does NOT
 * declare any field properties on a class extending it (a separate,
 * pre-existing typing gap unrelated to jsdoc-generation — `StructConstructor`
 * isn't generic over `fields`, so `class Widget extends Struct({...}) {}`
 * compiles to an EMPTY class body in the emitted declaration). Because of
 * that, this integration test builds its OWN `.d.ts` fixture with explicit
 * property declarations (what a consumer's `.d.ts` looks like once that gap
 * is fixed, or what one maintains by hand today) — this is still a REAL
 * end-to-end test of applyJsDoc's actual mechanism (real `import()` of the
 * real built morphz runtime, a real `Struct()` call producing a real,
 * fully-resolved `STRUCT_META`, real `ts-morph` AST patching, real file
 * read-back) — it just doesn't depend on the separate, larger gap being
 * fixed first.
 */
describe("applyJsDoc (integration — real runtime metadata + real ts-morph patch)", () => {
  const originalCwd = process.cwd();
  let tmpDir: string | undefined;

  afterEach(() => {
    process.chdir(originalCwd);
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = undefined;
    }
  });

  it("writes correct JSDoc onto real PropertyDeclarations when jsdoc:true", async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "morphz-jsdoc-"));
    writeFileSync(join(tmpDir, "morphz.config.cjs"), "module.exports = { jsdoc: true };\n");

    // Real .js: imports the REAL built morphz runtime, calls the REAL
    // Struct()/Text()/Uuid(), producing a class with a REAL, fully-resolved
    // STRUCT_META (this is genuine morphz runtime behavior, not a mock).
    writeFileSync(
      join(tmpDir, "fixture.mjs"),
      `
import { Struct, Text, Uuid } from "${CORE_DIST_INDEX}";

export class Widget extends Struct(
  {
    id: Uuid({ description: "Unique widget id", immutable: true }),
    name: Text({
      description: "Widget display name",
      min: 2,
      max: 20,
      examples: ["Foo Widget"],
      default: () => "untitled",
    }),
  },
  { labels: { entityName: "Widget" } },
) {}
`,
    );

    // Hand-authored companion .d.ts (what a consumer's declaration file
    // looks like once Struct()'s per-field type-inference gap is fixed) —
    // property NAMES must match the fields above for applyJsDoc to find them.
    writeFileSync(
      join(tmpDir, "fixture.d.ts"),
      `
export declare class Widget {
  id: string;
  name: string;
}
`,
    );

    process.chdir(tmpDir);

    await applyJsDoc({ jsEntryPath: "./fixture.mjs", dtsPath: "./fixture.d.ts" });

    const dts = readFileSync(join(tmpDir, "fixture.d.ts"), "utf-8");

    // id: description + @readonly (immutable), no @default/@example —
    // scoped to id's OWN JSDoc block only (not a greedy cross-property
    // match, which would false-positive against name's @default below).
    const idBlock = dts.match(/\/\*\*[\s\S]*?\*\/\s*id: string;/)?.[0] ?? "";
    expect(idBlock).toContain("Unique widget id");
    expect(idBlock).toContain("@readonly");
    expect(idBlock).not.toContain("@default");

    // name: description + @default + @example + @minLength + @maxLength
    expect(dts).toMatch(/Widget display name/);
    expect(dts).toMatch(/@default untitled/);
    expect(dts).toMatch(/@example Foo Widget/);
    expect(dts).toMatch(/@minLength 2/);
    expect(dts).toMatch(/@maxLength 20/);
  });

  // "no-op when jsdoc is off" lives in its own file (apply-jsdoc-off.test.ts)
  // — `getConfig()`'s process-wide singleton is populated at most once
  // (by design, `project-config`), so it can't be flipped back to
  // "unset" within a file that already triggered discovery with
  // `jsdoc: true` in an earlier test. Vitest isolates module registries
  // PER FILE, which is the only way to get a fresh singleton here.

  it("skips fields with no matching PropertyDeclaration without throwing", async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "morphz-jsdoc-partial-"));
    writeFileSync(join(tmpDir, "morphz.config.cjs"), "module.exports = { jsdoc: true };\n");

    writeFileSync(
      join(tmpDir, "fixture.mjs"),
      `
import { Struct, Text } from "${CORE_DIST_INDEX}";
export class Partial2 extends Struct(
  { a: Text({ description: "A" }), b: Text({ description: "B" }) },
  {},
) {}
`,
    );
    // .d.ts only declares "a" — "b" has no PropertyDeclaration to patch.
    writeFileSync(join(tmpDir, "fixture.d.ts"), `export declare class Partial2 {\n  a: string;\n}\n`);

    process.chdir(tmpDir);

    await expect(
      applyJsDoc({ jsEntryPath: "./fixture.mjs", dtsPath: "./fixture.d.ts" }),
    ).resolves.not.toThrow();

    const dts = readFileSync(join(tmpDir, "fixture.d.ts"), "utf-8");
    expect(dts).toMatch(/A[\s\S]*?a: string/);
  });
});
