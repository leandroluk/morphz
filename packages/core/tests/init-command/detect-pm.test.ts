import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectPackageManager, pmAddCommand } from "../../src/cli.js";

describe("detectPackageManager", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "morphz-pm-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("reads the lockfile in cwd", () => {
    writeFileSync(join(dir, "pnpm-lock.yaml"), "");
    expect(detectPackageManager(dir)).toBe("pnpm");
  });

  it("yarn.lock → yarn, bun.lockb → bun", () => {
    writeFileSync(join(dir, "yarn.lock"), "");
    expect(detectPackageManager(dir)).toBe("yarn");
    rmSync(join(dir, "yarn.lock"));
    writeFileSync(join(dir, "bun.lockb"), "");
    expect(detectPackageManager(dir)).toBe("bun");
  });

  it("walks up to a parent lockfile", () => {
    writeFileSync(join(dir, "pnpm-lock.yaml"), "");
    const nested = join(dir, "packages", "api");
    mkdirSync(nested, { recursive: true });
    expect(detectPackageManager(nested)).toBe("pnpm");
  });

  it("falls back to the packageManager field (corepack)", () => {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ packageManager: "yarn@4.1.0" }));
    expect(detectPackageManager(dir)).toBe("yarn");
  });

  it("defaults to npm when nothing is found", () => {
    expect(detectPackageManager(dir)).toBe("npm");
  });
});

describe("pmAddCommand", () => {
  it("maps each manager to its add command", () => {
    expect(pmAddCommand("npm")).toBe("npm i");
    expect(pmAddCommand("pnpm")).toBe("pnpm add");
    expect(pmAddCommand("yarn")).toBe("yarn add");
    expect(pmAddCommand("bun")).toBe("bun add");
  });
});
