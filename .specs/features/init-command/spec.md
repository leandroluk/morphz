# Spec: `morphz init` — Project Scaffolding Command

**Status: DONE (2026-08-28).** Implemented + tested — 26 new `init-command`
tests, 314 monorepo-wide green, `turbo run typecheck` 4/4. All 4 open
questions resolved in `design.md` (jsonc-parser bundled into `cli.cjs`
only — verified zero leak into `index.cjs`).

## Summary

Ship a CLI with the `morphz` npm package so `npx morphz init` scaffolds a
project in one step — the same affordance `eslint --init` / `tailwindcss
init` give. It:

1. writes a `morphz.config.ts` at the project root with commented defaults,
2. adds `{ "name": "morphz/ts-plugin" }` to the project's
   `tsconfig.json` `compilerOptions.plugins`,
3. checks that `zod@^4` is installed and warns (never installs) if not,
4. prints a short "next steps" summary — install the editor extension, docs
   link.

Non-interactive (flags only), zero new runtime dependencies, CJS bin.

## Motivation

- The shipped `morphz.config.ts` shape (`labels` / `template` / `locale` /
  `jsdoc`) is small but not obvious — new users copy it from the docs.
- `morphz/ts-plugin` in `tsconfig.json` is the one manual step for non-VS
  Code editors, and easy to forget.
- `default-entity-name` made the config file fully optional, so `init` is
  about _good defaults + tooling wiring_, not _required setup_ — it should
  feel like a shortcut, never a gate.

## Requirements

- REQ-001: `packages/core/package.json` gains `"bin": { "morphz":
"./dist/cli.cjs" }`. `dist/cli.cjs` is a new tsup entry built from
  `src/cli.ts`, CJS, with a `#!/usr/bin/env node` shebang preserved in the
  output. Runnable as `npx morphz <cmd>` and, once `morphz` is a project
  dep, as `morphz <cmd>` / `pnpm morphz <cmd>`.
- REQ-002: `morphz init` with no flags, run in a directory with no
  `morphz.config.*`:
  - creates `morphz.config.ts` at `process.cwd()` with the template below,
  - patches `./tsconfig.json` if present (REQ-004),
  - runs the `zod` check (REQ-005),
  - prints the summary (REQ-006),
  - exits `0`.
- REQ-003: `morphz.config.ts` template — valid TypeScript, matches the
  current `MorphzConfig` interface exactly, defaults commented so the file
  is a no-op until edited:

  ```ts
  import { defineConfig } from "morphz";

  export default defineConfig({
    // `entityName` already falls back to the class name — uncomment only to
    // reshape it (e.g. strip an `Entity` / `Model` suffix):
    // labels: { entityName: (ctx) => ctx.className.replace(/(Entity|Model)$/, "") },

    // Template delimiter for `#placeholder` references in descriptions:
    // template: { delimiter: "#" },

    // Active locale for i18n error messages / tooling:
    locale: { default: "en-US", fallback: "en-US" },

    // Propagate field metadata into generated .d.ts as JSDoc:
    jsdoc: true,
  });
  ```

  - If `morphz.config.{ts,js,mjs,cjs}` already exists: do NOT overwrite,
    print `morphz.config.* already exists — skipping (use --force to
overwrite)`, still run REQ-004/005/006, exit `0`.
  - `--force` overwrites the existing config file.
  - `--config-ext <ts|js|mjs|cjs>` picks the extension (default `ts`). The
    `js`/`mjs` template uses `export default` unchanged; the `cjs` template
    uses `module.exports =` and `require("morphz")`.

- REQ-004: `tsconfig.json` patch.
  - Look for `./tsconfig.json` at `process.cwd()`. Absent → skip silently
    (note it in the summary).
  - If `compilerOptions.plugins` already contains an entry with `name ===
"morphz/ts-plugin"` → no-op, note "already configured".
  - Otherwise add `{ "name": "morphz/ts-plugin" }` to that array (creating
    `compilerOptions` / `plugins` as needed) and rewrite the file.
  - The file is JSONC (comments, trailing commas). The parse/serialize
    approach and the exact conditions under which the command declines to
    mutate and instead PRINTS the snippet for manual paste are a **Design
    open question** (Q1). Baseline guarantee: the command MUST NOT produce
    an invalid `tsconfig.json`; when in doubt it prints instead of writes.
  - `--no-tsconfig` skips this step entirely.
- REQ-005: `zod` check. Read the nearest `package.json` (cwd upward),
  inspect `dependencies` + `devDependencies` + `peerDependencies` for
  `zod`. Missing, or a range that cannot satisfy `^4` → print a warning
  line (`zod@^4 is a required peer dependency — run: <pm> zod`). Never runs
  a package manager. Not finding a `package.json` at all → warn once,
  continue. This check never changes the exit code.
- REQ-005a: Package-manager detection (added post-spec, 2026-08-28). The
  install command in REQ-005's warning is tailored to the project's PM,
  detected by walking up from `cwd` for a lockfile (`pnpm-lock.yaml`→pnpm,
  `yarn.lock`→yarn, `bun.lock[b]`→bun,
  `package-lock.json`/`npm-shrinkwrap.json`→npm), then the `packageManager`
  field (corepack) of the nearest `package.json`, else `npm`.
  `--pm <npm|pnpm|yarn|bun>` overrides. Command mapping: `npm i`,
  everything else `<pm> add`. Detection only, no prompt — matches the
  flags-only design.
- REQ-006: Summary output — one block, plain text, listing exactly what was
  created / changed / skipped, then 2-3 next steps: (a) install the **morphz**
  editor extension (VS Marketplace / Open VSX) or rely on the `tsconfig.json`
  plugin just added, (b) docs URL `https://leandroluk.github.io/morphz`.
- REQ-007: `morphz --help` / `morphz init --help` prints usage (commands,
  flags). `morphz --version` prints the package version (read from the
  package's own `package.json`). An unknown command or flag prints usage to
  stderr and exits `2`.
- REQ-008: Exit codes — `0` success (including "nothing to do"), `1` on a
  real I/O failure (unwritable path, malformed existing `package.json`),
  `2` on a CLI usage error. The `zod` warning (REQ-005) and the "config
  already exists" notice (REQ-003) are `0`.
- REQ-009: `release.yml`'s "Assert npm tarball contents" step
  (`release-readiness` REQ-006) adds `dist/cli.cjs` to its required-entries
  list so a broken bin build fails the release.
- REQ-010: Cross-platform — all path handling via `node:path`, no shell
  assumptions. Verified on the repo's Windows dev environment and Linux CI.
- REQ-011: `npx tsc --noEmit` clean, `npm test` green. `src/cli.ts` gets
  unit tests (pure helpers: template render, JSONC plugin-array merge, zod
  range check) plus an integration test that runs `init` against a temp
  dir and asserts the created files.
- REQ-012: No new entries in `dependencies`. `src/cli.ts` uses only
  `node:*` built-ins and the package's own exports.

## Affected Components (from graph)

- `packages/core/src/cli.ts` — NEW. Arg parse, the `init` command, helper
  functions.
- `packages/core/tsup.config.ts` — add the `cli` entry; ensure the shebang
  survives (esbuild preserves a leading `#!` on an entry) and the output is
  `.cjs`.
- `packages/core/package.json` — `"bin"` field.
- `packages/core/tests/init-command/*.test.ts` — NEW.
- `.github/workflows/release.yml` — tarball assertion list (+`dist/cli.cjs`).
- Docs — `docs/README.md` "Get started" (`npx morphz init` as the fast
  path), `docs/guides/editor-tooling.md` (note `init` wires the plugin),
  `packages/core/README.md`.

Depends on `project-config` (the `MorphzConfig` shape + config filename
list the template and the "already exists" check mirror) and
`monorepo-architecture` / `release-readiness` (package layout, build, the
tarball guard).

## Out of Scope

- Interactive prompts / TUI (inquirer, @clack/prompts, …). Flags only.
- Framework detection or generating an example `Struct` / entity file — that
  is a scaffolder, not `init`.
- Editing `package.json` `scripts`, installing `zod` / the extension, or
  running any package manager.
- Monorepo-aware init (per-workspace config). `init` operates on
  `process.cwd()` only.
- Other subcommands (`morphz add`, codegen, migration). This spec is
  `init` + `--help` / `--version` only; the arg parser should leave room
  for more without over-building now.
- Preserving exact `tsconfig.json` formatting / comment positions through
  the patch — best effort; the fallback is printing the snippet.

## Open Questions (for Design phase)

- Q1: `tsconfig.json` JSONC handling. Options: (a) a minimal in-repo
  comment/trailing-comma stripper + `JSON.parse` + `JSON.stringify(_, null,
2)` rewrite (normalizes formatting, drops comments — loud warning), (b)
  pull `jsonc-parser` as a **devDependency-of-core that gets bundled** by
  tsup so it's not a runtime dep (verify tsup bundles it into `cli.cjs`),
  (c) never mutate — always print the snippet and let the user paste.
  Recommendation leans (b) if bundling is clean, else (c) as the safe
  default with (a) behind an explicit `--rewrite-tsconfig` flag. Decide at
  Design.
- Q2: `--version` / `--help` output detail level, and whether to alias
  `morphz` with no args to `morphz --help` vs. an error.
- Q3: Does `init` also detect an existing `plugins` entry for a DIFFERENT
  plugin and append, or bail to printing? (Leaning: append — it's a JSON
  array, low risk once parsed.)
- Q4: Should the `zod` check also look at an actually-installed version in
  `node_modules/zod/package.json` (more accurate than the range string), or
  is the declared range enough? (Leaning: range string only — no
  `node_modules` walk.)

## Rejected Alternatives

- **Interactive wizard.** Slower to run, more code, more deps; `eslint`
  moved toward flags/config presets for the same reasons. Flags compose
  with CI / dotfiles.
- **A separate `create-morphz` package (`npm create morphz`).** That
  pattern is for scaffolding a whole new project; `morphz init` augments an
  existing one, which is the actual need here.
- **Doing nothing / docs-only.** The `tsconfig.json` plugin line is the
  recurring friction point; a one-liner that wires it is worth the small
  surface.
