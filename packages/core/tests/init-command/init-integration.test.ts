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
    deps: true,
    configExt: "ts" as const,
    ...o,
  });

  const pkg = (o: object) =>
    writeFileSync(join(dir, "package.json"), JSON.stringify(o, null, 2) + "\n");
  const readPkg = () => JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));

  it("clean dir: config + tsconfig + adds morphz/zod + install hint", () => {
    pkg({ name: "app" });
    writeFileSync(join(dir, "tsconfig.json"), `{\n  "compilerOptions": { "strict": true }\n}\n`);
    writeFileSync(join(dir, "pnpm-lock.yaml"), "");

    runInit(dir, flags());

    expect(existsSync(join(dir, "morphz.config.ts"))).toBe(true);
    expect(readFileSync(join(dir, "tsconfig.json"), "utf8")).toMatch(/morphz\/ts-plugin/);
    expect(readPkg().dependencies).toMatchObject({ zod: "^4" });
    expect(readPkg().dependencies.morphz).toBeDefined();
    expect(out).toMatch(/created {2}morphz\.config\.ts/);
    expect(out).toMatch(/updated {2}tsconfig\.json/);
    expect(out).toMatch(/updated {2}package\.json {2}\(added .*zod@\^4/);
    expect(out).toMatch(/run: pnpm install/);
  });

  it("install hint uses the detected package manager", () => {
    pkg({ name: "app" });
    writeFileSync(join(dir, "yarn.lock"), "");
    runInit(dir, flags());
    expect(out).toMatch(/run: yarn install/);
  });

  it("--pm overrides detection", () => {
    pkg({ name: "app" });
    writeFileSync(join(dir, "pnpm-lock.yaml"), "");
    runInit(dir, flags({ pm: "bun" }));
    expect(out).toMatch(/run: bun install/);
  });

  it("morphz + zod already present → 'ok', no install hint", () => {
    pkg({ dependencies: { morphz: "^0.4.0", zod: "^4" } });
    runInit(dir, flags());
    expect(out).toMatch(/ok {7}package\.json {2}\(morphz, zod present\)/);
    expect(out).not.toMatch(/run: .* install/);
  });

  it("--no-deps → package.json untouched", () => {
    pkg({ name: "app" });
    runInit(dir, flags({ deps: false }));
    expect(out).toMatch(/skipped {2}package\.json {2}\(--no-deps\)/);
    expect(readPkg().dependencies).toBeUndefined();
  });

  it("no package.json → warn, config still written", () => {
    runInit(dir, flags());
    expect(out).toMatch(/warn {5}package\.json/);
    expect(existsSync(join(dir, "morphz.config.ts"))).toBe(true);
  });

  it("existing config skipped without --force, overwritten with it", () => {
    pkg({ dependencies: { morphz: "^0.4.0", zod: "^4" } });
    writeFileSync(join(dir, "morphz.config.ts"), "// mine\n");
    runInit(dir, flags());
    expect(readFileSync(join(dir, "morphz.config.ts"), "utf8")).toBe("// mine\n");
    expect(out).toMatch(/skipped {2}morphz\.config\.ts/);

    out = "";
    runInit(dir, flags({ force: true }));
    expect(readFileSync(join(dir, "morphz.config.ts"), "utf8")).toMatch(/defineConfig/);
  });

  it("tsconfig already wired → 'already'", () => {
    pkg({ dependencies: { morphz: "^0.4.0", zod: "^4" } });
    writeFileSync(
      join(dir, "tsconfig.json"),
      `{ "compilerOptions": { "plugins": [{ "name": "morphz/ts-plugin" }] } }`,
    );
    runInit(dir, flags());
    expect(out).toMatch(/already {2}tsconfig\.json/);
  });

  it("no tsconfig → skipped (not found)", () => {
    pkg({ dependencies: { morphz: "^0.4.0", zod: "^4" } });
    runInit(dir, flags());
    expect(out).toMatch(/skipped {2}tsconfig\.json {2}\(not found\)/);
  });

  it("--no-tsconfig → skipped (flag)", () => {
    pkg({ dependencies: { morphz: "^0.4.0", zod: "^4" } });
    writeFileSync(join(dir, "tsconfig.json"), `{}`);
    runInit(dir, flags({ tsconfig: false }));
    expect(out).toMatch(/skipped {2}tsconfig\.json {2}\(--no-tsconfig\)/);
    expect(readFileSync(join(dir, "tsconfig.json"), "utf8")).toBe("{}");
  });

  it("--config-ext js writes morphz.config.js", () => {
    pkg({ dependencies: { morphz: "^0.4.0", zod: "^4" } });
    runInit(dir, flags({ configExt: "js" }));
    expect(existsSync(join(dir, "morphz.config.js"))).toBe(true);
    expect(existsSync(join(dir, "morphz.config.ts"))).toBe(false);
  });

  it("broken tsconfig → snippet printed, file untouched", () => {
    pkg({ dependencies: { morphz: "^0.4.0", zod: "^4" } });
    writeFileSync(join(dir, "tsconfig.json"), `{ "compilerOptions": `);
    runInit(dir, flags());
    expect(out).toMatch(/could not parse/);
    expect(out).toMatch(/add this to tsconfig\.json manually/);
    expect(readFileSync(join(dir, "tsconfig.json"), "utf8")).toBe(`{ "compilerOptions": `);
  });
});
