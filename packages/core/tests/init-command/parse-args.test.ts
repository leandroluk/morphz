import { describe, expect, it } from "vitest";
import { parseArgs } from "../../src/cli.js";

describe("parseArgs", () => {
  it("no args → help", () => {
    expect(parseArgs([])).toEqual({ command: "help" });
  });

  it("--help / -h anywhere → help", () => {
    expect(parseArgs(["--help"])).toEqual({ command: "help" });
    expect(parseArgs(["-h"])).toEqual({ command: "help" });
    expect(parseArgs(["init", "--help"])).toEqual({ command: "help" });
  });

  it("--version / -v → version", () => {
    expect(parseArgs(["--version"])).toEqual({ command: "version" });
    expect(parseArgs(["-v"])).toEqual({ command: "version" });
  });

  it("bare init → default flags", () => {
    expect(parseArgs(["init"])).toEqual({
      command: "init",
      flags: { force: false, tsconfig: true, configExt: "ts" },
    });
  });

  it("init with every flag", () => {
    expect(
      parseArgs(["init", "--force", "--no-tsconfig", "--config-ext", "mjs", "--pm", "pnpm"]),
    ).toEqual({
      command: "init",
      flags: { force: true, tsconfig: false, configExt: "mjs", pm: "pnpm" },
    });
  });

  it("bad --pm value → throws", () => {
    expect(() => parseArgs(["init", "--pm", "cargo"])).toThrow(/--pm/);
    expect(() => parseArgs(["init", "--pm"])).toThrow(/--pm/);
  });

  it("unknown command → throws", () => {
    expect(() => parseArgs(["frobnicate"])).toThrow(/unknown command/);
  });

  it("unknown flag → throws", () => {
    expect(() => parseArgs(["init", "--wat"])).toThrow(/unknown flag/);
  });

  it("bad --config-ext value → throws", () => {
    expect(() => parseArgs(["init", "--config-ext", "toml"])).toThrow(/config-ext/);
    expect(() => parseArgs(["init", "--config-ext"])).toThrow(/config-ext/);
  });
});
