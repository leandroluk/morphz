import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureDeps } from "../../src/cli.js";

describe("ensureDeps", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "morphz-deps-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const pkg = () => JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));

  it("adds morphz + zod to dependencies when both are missing", () => {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "app" }, null, 2) + "\n");
    const r = ensureDeps(dir, "0.4.0", "pnpm");
    expect(r.changed).toBe(true);
    expect(r.outcome.action).toBe("updated");
    expect(pkg().dependencies).toEqual({ morphz: "^0.4.0", zod: "^4" });
  });

  it("leaves an existing morphz / zod untouched (any dep field)", () => {
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify(
        { dependencies: { morphz: "^0.3.0" }, devDependencies: { zod: "4.1.0" } },
        null,
        2,
      ),
    );
    const r = ensureDeps(dir, "0.4.0", "npm");
    expect(r.changed).toBe(false);
    expect(r.outcome.action).toBe("ok");
    expect(pkg().dependencies.morphz).toBe("^0.3.0");
  });

  it("adds only the missing one", () => {
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ dependencies: { zod: "^4" } }, null, 2),
    );
    const r = ensureDeps(dir, "0.4.0", "yarn");
    expect(r.changed).toBe(true);
    expect(r.outcome.reason).toMatch(/added morphz@\^0\.4\.0$/);
    expect(pkg().dependencies).toEqual({ zod: "^4", morphz: "^0.4.0" });
  });

  it("warns when an existing zod is not v4", () => {
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ dependencies: { zod: "^3.22" } }, null, 2),
    );
    const r = ensureDeps(dir, "0.4.0", "npm");
    // morphz still added; zod left as-is with a note
    expect(pkg().dependencies.morphz).toBe("^0.4.0");
    expect(r.outcome.reason).toMatch(/not v4/);
  });

  it("no package.json in cwd → warn, no walk-up", () => {
    const r = ensureDeps(dir, "0.4.0", "pnpm");
    expect(r.changed).toBe(false);
    expect(r.outcome.action).toBe("warn");
    expect(r.outcome.reason).toMatch(/pnpm init/);
  });

  it("unreadable CLI version → falls back to 'latest' for morphz", () => {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "app" }, null, 2));
    ensureDeps(dir, "0.0.0", "npm");
    expect(pkg().dependencies.morphz).toBe("latest");
  });

  it("preserves formatting / key order (jsonc modify)", () => {
    const src = `{
  "name": "app",
  "scripts": { "build": "tsc" },
  "dependencies": {
    "express": "^4"
  }
}
`;
    writeFileSync(join(dir, "package.json"), src);
    ensureDeps(dir, "0.4.0", "pnpm");
    const out = readFileSync(join(dir, "package.json"), "utf8");
    expect(out).toMatch(/"express": "\^4"/);
    expect(out).toMatch(/"morphz": "\^0\.4\.0"/);
    expect(out.indexOf('"name"')).toBeLessThan(out.indexOf('"scripts"'));
  });
});
