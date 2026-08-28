#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { applyEdits, modify, parse, parseTree } from "jsonc-parser";
import type { Node, ParseError } from "jsonc-parser";
import { CONFIG_FILENAMES } from "./core/config.js";

// `__dirname` is provided by tsup's CJS shim; the CLI is only shipped as
// `dist/cli.cjs`, so this is always the CJS bundle's own directory (`dist/`).
declare const __dirname: string;

const PLUGIN_NAME = "morphz/ts-plugin";
const DOCS_URL = "https://leandroluk.github.io/morphz";
const CONFIG_EXTS = ["ts", "js", "mjs", "cjs"] as const;
type ConfigExt = (typeof CONFIG_EXTS)[number];

const PACKAGE_MANAGERS = ["npm", "pnpm", "yarn", "bun"] as const;
type PackageManager = (typeof PACKAGE_MANAGERS)[number];

class UsageError extends Error {}

// ── arg parsing ──────────────────────────────────────────────────────────

interface InitFlags {
  force: boolean;
  tsconfig: boolean;
  deps: boolean;
  configExt: ConfigExt;
  pm?: PackageManager;
}

type ParsedArgs =
  | { command: "help" }
  | { command: "version" }
  | { command: "init"; flags: InitFlags };

export function parseArgs(argv: string[]): ParsedArgs {
  if (argv.length === 0) return { command: "help" };

  const [first, ...rest] = argv;
  if (first === "--help" || first === "-h") return { command: "help" };
  if (first === "--version" || first === "-v") return { command: "version" };

  if (first !== "init") {
    throw new UsageError(`unknown command: ${first}`);
  }

  const flags: InitFlags = { force: false, tsconfig: true, deps: true, configExt: "ts" };
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    switch (arg) {
      case "--help":
      case "-h":
        return { command: "help" };
      case "--force":
        flags.force = true;
        break;
      case "--no-tsconfig":
        flags.tsconfig = false;
        break;
      case "--no-deps":
        flags.deps = false;
        break;
      case "--config-ext": {
        const val = rest[++i];
        if (!val || !CONFIG_EXTS.includes(val as ConfigExt)) {
          throw new UsageError(`--config-ext must be one of: ${CONFIG_EXTS.join(", ")}`);
        }
        flags.configExt = val as ConfigExt;
        break;
      }
      case "--pm": {
        const val = rest[++i];
        if (!val || !PACKAGE_MANAGERS.includes(val as PackageManager)) {
          throw new UsageError(`--pm must be one of: ${PACKAGE_MANAGERS.join(", ")}`);
        }
        flags.pm = val as PackageManager;
        break;
      }
      default:
        throw new UsageError(`unknown flag: ${arg}`);
    }
  }
  return { command: "init", flags };
}

// ── help / version ───────────────────────────────────────────────────────

function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8")) as {
      version?: string;
    };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const USAGE = `morphz — Zod v4 + a class-based, type-safe OO layer

Usage
  npx morphz <command> [flags]

Commands
  init                     Scaffold morphz in the current project

Flags (init)
  --force                  Overwrite an existing morphz.config.*
  --no-tsconfig            Don't touch tsconfig.json
  --no-deps                Don't add morphz / zod to package.json
  --config-ext <ext>       Config file extension: ts (default), js, mjs, cjs
  --pm <name>              Package manager for hints: npm, pnpm, yarn, bun
                           (auto-detected from the lockfile by default)

  -h, --help               Show this help
  -v, --version            Print the morphz version

Examples
  npx morphz init
  npx morphz init --config-ext mjs --no-tsconfig
`;

// ── config file ──────────────────────────────────────────────────────────

const CONFIG_BODY = `  // \`entityName\` already falls back to the class name — uncomment only to
  // reshape it (e.g. strip an \`Entity\` / \`Model\` suffix):
  // labels: { entityName: (ctx) => ctx.className.replace(/(Entity|Model)$/, "") },

  // Template delimiter for \`#placeholder\` references in descriptions:
  // template: { delimiter: "#" },

  // Active locale for i18n error messages / tooling:
  locale: { default: "en-US", fallback: "en-US" },

  // Propagate field metadata into generated .d.ts as JSDoc:
  jsdoc: true,`;

export function renderConfigTemplate(ext: ConfigExt): string {
  if (ext === "cjs") {
    return `const { defineConfig } = require("morphz");\n\nmodule.exports = defineConfig({\n${CONFIG_BODY}\n});\n`;
  }
  return `import { defineConfig } from "morphz";\n\nexport default defineConfig({\n${CONFIG_BODY}\n});\n`;
}

type Action = "created" | "updated" | "skipped" | "already" | "ok" | "warn";
interface Outcome {
  target: string;
  action: Action;
  reason?: string;
}

export function writeConfig(cwd: string, ext: ConfigExt, force: boolean): Outcome {
  const existing = CONFIG_FILENAMES.find((name) => existsSync(join(cwd, name)));
  if (existing && !force) {
    return { target: existing, action: "skipped", reason: "already exists (use --force)" };
  }
  const name = `morphz.config.${ext}`;
  writeFileSync(join(cwd, name), renderConfigTemplate(ext), "utf8");
  return { target: name, action: existing ? "updated" : "created" };
}

// ── tsconfig.json ────────────────────────────────────────────────────────

function findArrayChild(node: Node | undefined, key: string): Node | undefined {
  if (!node || node.type !== "object") return undefined;
  const prop = node.children?.find((c) => c.type === "property" && c.children?.[0]?.value === key);
  return prop?.children?.[1];
}

type MergeResult =
  | { action: "updated"; text: string }
  | { action: "already"; text: string }
  | { action: "print" };

export function mergePluginEntry(text: string): MergeResult {
  // `parseTree` is tolerant (returns partial trees for broken input); use a
  // strict `parse` pass purely as the validity gate, JSONC features allowed.
  const errors: ParseError[] = [];
  parse(text, errors, { allowTrailingComma: true, allowEmptyContent: false });
  if (errors.length > 0) return { action: "print" };

  const root = parseTree(text);
  if (!root || root.type !== "object") return { action: "print" };

  const compilerOptions = findArrayChild(root, "compilerOptions");
  const plugins = findArrayChild(compilerOptions, "plugins");

  if (plugins) {
    if (plugins.type !== "array") return { action: "print" };
    const already = plugins.children?.some((el) => {
      if (el.type !== "object") return false;
      const nameProp = el.children?.find(
        (c) => c.type === "property" && c.children?.[0]?.value === "name",
      );
      return nameProp?.children?.[1]?.value === PLUGIN_NAME;
    });
    if (already) return { action: "already", text };
  }

  const edits = modify(
    text,
    ["compilerOptions", "plugins", -1],
    { name: PLUGIN_NAME },
    {
      formattingOptions: { insertSpaces: true, tabSize: 2 },
    },
  );
  if (edits.length === 0) return { action: "print" };
  return { action: "updated", text: applyEdits(text, edits) };
}

export function patchTsconfig(cwd: string, enabled: boolean): Outcome & { printSnippet?: boolean } {
  if (!enabled) return { target: "tsconfig.json", action: "skipped", reason: "--no-tsconfig" };
  const path = join(cwd, "tsconfig.json");
  if (!existsSync(path)) {
    return { target: "tsconfig.json", action: "skipped", reason: "not found" };
  }
  const text = readFileSync(path, "utf8");
  const result = mergePluginEntry(text);
  if (result.action === "print") {
    return {
      target: "tsconfig.json",
      action: "skipped",
      reason: "could not parse — add the plugin manually",
      printSnippet: true,
    };
  }
  if (result.action === "already") {
    return { target: "tsconfig.json", action: "already", reason: PLUGIN_NAME };
  }
  writeFileSync(path, result.text, "utf8");
  return { target: "tsconfig.json", action: "updated", reason: `added ${PLUGIN_NAME}` };
}

// ── package manager detection ────────────────────────────────────────────

const LOCKFILES: Record<string, PackageManager> = {
  "pnpm-lock.yaml": "pnpm",
  "yarn.lock": "yarn",
  "bun.lockb": "bun",
  "bun.lock": "bun",
  "package-lock.json": "npm",
  "npm-shrinkwrap.json": "npm",
};

/**
 * Walk up from `cwd` looking for a lockfile, then fall back to the
 * `packageManager` field (corepack) of the nearest `package.json`.
 * Defaults to `npm` when nothing is found.
 */
export function detectPackageManager(cwd: string): PackageManager {
  let dir = cwd;
  for (;;) {
    for (const [file, pm] of Object.entries(LOCKFILES)) {
      if (existsSync(join(dir, file))) return pm;
    }
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { packageManager?: string };
        const name = pkg.packageManager?.split("@")[0];
        if (name && PACKAGE_MANAGERS.includes(name as PackageManager)) {
          return name as PackageManager;
        }
      } catch {
        /* ignore a malformed package.json here — the zod check reports it */
      }
    }
    const parent = dirname(dir);
    if (parent === dir) return "npm";
    dir = parent;
  }
}

/** `pnpm add` / `yarn add` / `bun add` / `npm i` */
export function pmAddCommand(pm: PackageManager): string {
  return pm === "npm" ? "npm i" : `${pm} add`;
}

// ── zod check ────────────────────────────────────────────────────────────

export function zodRangeSatisfiesV4(range: string): boolean {
  const trimmed = range
    .trim()
    .replace(/^[\^~>=<\s]+/, "")
    .replace(/^v/, "");
  if (["*", "latest", "next"].includes(trimmed)) return true;
  if (trimmed.startsWith("workspace:")) return true;
  return trimmed === "4" || trimmed.startsWith("4.");
}

// ── dependencies ─────────────────────────────────────────────────────────

/** All declared deps across the three fields, name → range. */
function collectDeps(pkg: Record<string, unknown>): Record<string, string> {
  return {
    ...(pkg.dependencies as Record<string, string> | undefined),
    ...(pkg.devDependencies as Record<string, string> | undefined),
    ...(pkg.peerDependencies as Record<string, string> | undefined),
  };
}

/**
 * `1.2.3` → `^1.2.3`. `0.0.0` is `readVersion`'s "couldn't read" sentinel,
 * and anything non-semver falls back to `latest`.
 */
function selfRange(version: string): string {
  return version !== "0.0.0" && /^\d+\.\d+\.\d+/.test(version) ? `^${version}` : "latest";
}

export interface EnsureDepsResult {
  outcome: Outcome;
  changed: boolean;
}

/**
 * Guarantees `morphz` and `zod` are in the project's `package.json`
 * `dependencies` — a plain JSON edit, no package manager is ever run
 * (spec REQ-005). Operates on `cwd` only (never walks up: adding deps to a
 * parent/root `package.json` in a monorepo would be surprising).
 */
export function ensureDeps(cwd: string, selfVersion: string, pm: PackageManager): EnsureDepsResult {
  const path = join(cwd, "package.json");
  if (!existsSync(path)) {
    return {
      changed: false,
      outcome: {
        target: "package.json",
        action: "warn",
        reason: `not found in ${cwd} — run \`${pm} init\` first`,
      },
    };
  }

  let text = readFileSync(path, "utf8");
  const errors: ParseError[] = [];
  const pkg = parse(text, errors, { allowEmptyContent: false }) as
    | Record<string, unknown>
    | undefined;
  if (errors.length > 0 || !pkg) {
    return {
      changed: false,
      outcome: { target: "package.json", action: "warn", reason: "could not parse" },
    };
  }

  const declared = collectDeps(pkg);
  const wanted: Array<[string, string]> = [
    ["morphz", selfRange(selfVersion)],
    ["zod", "^4"],
  ];
  const added: string[] = [];
  let zodMismatch = false;

  for (const [name, range] of wanted) {
    const existing = declared[name];
    if (existing) {
      if (name === "zod" && !zodRangeSatisfiesV4(existing)) zodMismatch = true;
      continue;
    }
    const edits = modify(text, ["dependencies", name], range, {
      formattingOptions: { insertSpaces: true, tabSize: 2 },
    });
    text = applyEdits(text, edits);
    added.push(`${name}@${range}`);
  }

  if (added.length > 0) writeFileSync(path, text, "utf8");

  if (added.length > 0) {
    const note = zodMismatch ? " — existing zod is not v4" : "";
    return {
      changed: true,
      outcome: {
        target: "package.json",
        action: "updated",
        reason: `added ${added.join(", ")}${note}`,
      },
    };
  }
  if (zodMismatch) {
    return {
      changed: false,
      outcome: {
        target: "package.json",
        action: "warn",
        reason: `zod is present but not ^4 — run: ${pmAddCommand(pm)} zod@^4`,
      },
    };
  }
  return {
    changed: false,
    outcome: { target: "package.json", action: "ok", reason: "morphz, zod present" },
  };
}

// ── summary ──────────────────────────────────────────────────────────────

const SNIPPET = `  {
    "compilerOptions": {
      "plugins": [{ "name": "${PLUGIN_NAME}" }]
    }
  }`;

interface SummaryOpts {
  printSnippet: boolean;
  installHint?: string;
}

function printSummary(outcomes: Outcome[], opts: SummaryOpts): void {
  const lines = ["", "morphz init", ""];
  for (const o of outcomes) {
    lines.push(`  ${o.action.padEnd(8)} ${o.target}${o.reason ? `  (${o.reason})` : ""}`);
  }
  if (opts.printSnippet) {
    lines.push("", "  add this to tsconfig.json manually:", SNIPPET);
  }
  lines.push("", "next steps");
  if (opts.installHint) lines.push(`  • run: ${opts.installHint}`);
  lines.push(
    "  • install the morphz editor extension (VS Marketplace / Open VSX),",
    "    or rely on the tsconfig.json plugin",
    `  • docs: ${DOCS_URL}`,
    "",
  );
  process.stdout.write(lines.join("\n") + "\n");
}

// ── init command ─────────────────────────────────────────────────────────

export function runInit(cwd: string, flags: InitFlags): void {
  const pm = flags.pm ?? detectPackageManager(cwd);
  const config = writeConfig(cwd, flags.configExt, flags.force);
  const tsconfig = patchTsconfig(cwd, flags.tsconfig);

  const outcomes: Outcome[] = [config, tsconfig];
  let installHint: string | undefined;

  if (flags.deps) {
    const deps = ensureDeps(cwd, readVersion(), pm);
    outcomes.push(deps.outcome);
    if (deps.changed) installHint = `${pm} install`;
  } else {
    outcomes.push({ target: "package.json", action: "skipped", reason: "--no-deps" });
  }

  printSummary(outcomes, { printSnippet: Boolean(tsconfig.printSnippet), installHint });
}

// ── entrypoint ───────────────────────────────────────────────────────────

export function main(argv: string[]): number {
  let parsed: ParsedArgs;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n\n${USAGE}`);
    return 2;
  }

  switch (parsed.command) {
    case "help":
      process.stdout.write(USAGE);
      return 0;
    case "version":
      process.stdout.write(`${readVersion()}\n`);
      return 0;
    case "init":
      try {
        runInit(process.cwd(), parsed.flags);
        return 0;
      } catch (err) {
        process.stderr.write(`morphz init failed: ${(err as Error).message}\n`);
        return 1;
      }
  }
}

// `import.meta.url` is unavailable in the CJS bundle; the shebang guarantees
// this file is only ever the process entrypoint when run as the bin.
if (typeof require !== "undefined" && require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
