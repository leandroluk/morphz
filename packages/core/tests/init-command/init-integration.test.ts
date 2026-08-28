import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runInit } from "../../src/cli.js";

describe("runInit (integration)", () => {
  let dir: string;
  let out: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "morphz-init-"));
    out = "";
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      out += String(chunk);
      return true;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(dir, { recursive: true, force: true });
  });

  const flags = (o: Partial<Parameters<typeof runInit>[1]> = {}) => ({
    force: false,
    tsconfig: true,
    configExt: "ts" as const,
    ...o,
  });

  it("zod warning uses the detected package manager", () => {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "app" }));
    writeFileSync(join(dir, "pnpm-lock.yaml"), "");
    runInit(dir, flags());
    expect(out).toMatch(/run: pnpm add zod/);
  });

  it("--pm overrides detection", () => {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "app" }));
    writeFileSync(join(dir, "yarn.lock"), "");
    runInit(dir, flags({ pm: "bun" }));
    expect(out).toMatch(/run: bun add zod/);
  });

  it("clean dir: writes config, patches tsconfig, warns on missing zod", () => {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "app" }));
    writeFileSync(join(dir, "tsconfig.json"), `{\n  "compilerOptions": { "strict": true }\n}\n`);

    runInit(dir, flags());

    expect(existsSync(join(dir, "morphz.config.ts"))).toBe(true);
    expect(readFileSync(join(dir, "tsconfig.json"), "utf8")).toMatch(/morphz\/ts-plugin/);
    expect(out).toMatch(/created {2}morphz\.config\.ts/);
    expect(out).toMatch(/updated {2}tsconfig\.json/);
    expect(out).toMatch(/warn {5}zod/);
  });

  it("existing config is skipped without --force, overwritten with it", () => {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ dependencies: { zod: "^4" } }));
    writeFileSync(join(dir, "morphz.config.ts"), "// mine\n");

    runInit(dir, flags());
    expect(readFileSync(join(dir, "morphz.config.ts"), "utf8")).toBe("// mine\n");
    expect(out).toMatch(/skipped {2}morphz\.config\.ts/);
    expect(out).toMatch(/ok {7}zod/);

    out = "";
    runInit(dir, flags({ force: true }));
    expect(readFileSync(join(dir, "morphz.config.ts"), "utf8")).toMatch(/defineConfig/);
  });

  it("tsconfig already wired → 'already'", () => {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ devDependencies: { zod: "4.0.1" } }));
    writeFileSync(
      join(dir, "tsconfig.json"),
      `{ "compilerOptions": { "plugins": [{ "name": "morphz/ts-plugin" }] } }`,
    );
    runInit(dir, flags());
    expect(out).toMatch(/already {2}tsconfig\.json/);
  });

  it("no tsconfig → skipped (not found)", () => {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ dependencies: { zod: "^4" } }));
    runInit(dir, flags());
    expect(out).toMatch(/skipped {2}tsconfig\.json {2}\(not found\)/);
  });

  it("--no-tsconfig → skipped (flag)", () => {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ dependencies: { zod: "^4" } }));
    writeFileSync(join(dir, "tsconfig.json"), `{}`);
    runInit(dir, flags({ tsconfig: false }));
    expect(out).toMatch(/skipped {2}tsconfig\.json {2}\(--no-tsconfig\)/);
    expect(readFileSync(join(dir, "tsconfig.json"), "utf8")).toBe("{}");
  });

  it("--config-ext js writes morphz.config.js", () => {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ dependencies: { zod: "^4" } }));
    runInit(dir, flags({ configExt: "js" }));
    expect(existsSync(join(dir, "morphz.config.js"))).toBe(true);
    expect(existsSync(join(dir, "morphz.config.ts"))).toBe(false);
  });

  it("broken tsconfig → snippet printed, file untouched", () => {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ dependencies: { zod: "^4" } }));
    writeFileSync(join(dir, "tsconfig.json"), `{ "compilerOptions": `);
    runInit(dir, flags());
    expect(out).toMatch(/could not parse/);
    expect(out).toMatch(/add this to tsconfig\.json manually/);
    expect(readFileSync(join(dir, "tsconfig.json"), "utf8")).toBe(`{ "compilerOptions": `);
  });
});
