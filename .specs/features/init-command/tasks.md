# Tasks: `morphz init`

Feature: `.specs/features/init-command/`. Design resolved all 4 QQs.
**All tasks DONE 2026-08-28.** T-001..T-007 complete; gate green.

## T-009 — ensure morphz + zod in package.json (follow-up, 2026-08-28)

- [x] `ensureDeps(cwd, selfVersion, pm)` — cwd-only `package.json`, adds
      `morphz` (`^<version>` / `latest`) + `zod` (`^4`) to `dependencies` via
      jsonc `modify`/`applyEdits` if absent from any dep field; leaves
      existing entries; warns on a non-v4 `zod`; `warn` + `<pm> init` hint
      when no `package.json`. Never runs a PM. `selfRange()` maps the
      `0.0.0` sentinel + non-semver to `latest`.
- [x] `--no-deps` flag; `runInit` leads next-steps with `run: <pm>
install` when `ensureDeps` changed the file. Dropped the standalone
      `checkZod` / `readNearestPackageJson` (folded in).
- [x] Tests: `tests/init-command/ensure-deps.test.ts` (7) + integration
      rewritten (12). 45 init-command, 333 monorepo-wide.
- [x] Docs: `docs/README.md` Get started (`npx morphz init` first, then
      install; `--no-deps`) + monorepo section (`--no-deps` at root);
      `packages/core/README.md`.

## T-008 — package-manager detection (follow-up, 2026-08-28)

- [x] `detectPackageManager(cwd)` — lockfile walk-up
      (pnpm/yarn/bun/npm) → corepack `packageManager` field → `npm`.
      `pmAddCommand(pm)` → `npm i` / `<pm> add`.
- [x] `--pm <npm|pnpm|yarn|bun>` flag; `checkZod(cwd, pm)` uses the mapped
      install command in its warning.
- [x] Tests: `tests/init-command/detect-pm.test.ts` (6) + 2 integration
      cases (detected vs `--pm` override). 35 init-command tests, 323
      monorepo-wide.
- [x] Docs: `--pm` in `docs/README.md` flag list + `--help` text.

## T-001 — config filename export + tsup/bin wiring

- `packages/core/src/core/config.ts`: `export const CONFIG_FILENAMES`
  (currently module-private).
- `packages/core/tsup.config.ts`: add `cli: "src/cli.ts"` to `entry`.
- `packages/core/package.json`: add `"bin": { "morphz": "./dist/cli.cjs" }`;
  add `jsonc-parser` to `devDependencies` (latest 3.x).
- `pnpm install`.
- Gate: `pnpm --filter morphz build` emits `dist/cli.cjs` +
  `dist/cli.js`; `head -1 dist/cli.cjs` is `#!/usr/bin/env node` (once
  T-002 lands the shebang).

## T-002 — `src/cli.ts` skeleton + arg parser + help/version

- Shebang first line.
- `parseArgs(argv: string[]): { command: "init" | "help" | "version"; flags }`
  — pure. Flags for `init`: `--force`, `--no-tsconfig`,
  `--config-ext <ts|js|mjs|cjs>` (default `ts`), `--help` / `-h`.
  Top-level `--help`/`-h`, `--version`/`-v`. No args → `help`. Unknown
  command/flag → throw a `UsageError` (caught in `main`, printed to stderr,
  exit 2).
- `printUsage()` — the ~18-line block from design.
- `readVersion()` — `JSON.parse(readFileSync(join(__dirname,"..","package.json"))).version`.
- `main()`: dispatch; map outcomes to exit codes (0 / 1 / 2 per spec
  REQ-008); `process.exitCode = n` (don't hard `process.exit` mid-write).
- Tests: `tests/init-command/parse-args.test.ts` — every flag combo, the
  no-args→help case, unknown-flag→UsageError.

## T-003 — `renderConfigTemplate` + `writeConfig`

- `renderConfigTemplate(ext): string` — one shared commented body, `ts/js/mjs`
  wrapper vs `cjs` wrapper (design "Config template rendering").
- `writeConfig(cwd, ext, force)`:
  - if any `CONFIG_FILENAMES` entry exists in `cwd` and not `force` →
    return `{ action: "skipped", reason: "already exists" }`.
  - else write `morphz.config.<ext>` → `{ action: "created" }` (or
    `"updated"` semantics not needed — always "created" once we write).
- Tests: `tests/init-command/render-template.test.ts` — the 4 exts render
  valid, parseable source; the `ts` output, when written and `tsc`-checked
  in isolation, has no type error against the real `MorphzConfig` (a
  lightweight check: string contains `defineConfig(` and the known keys).

## T-004 — `mergePluginEntry` (jsonc-parser) + `patchTsconfig`

- `mergePluginEntry(text: string): { text: string; action } | { action: "print" }`
  — pure over the file text:
  - `parseTree(text)`; if `undefined` or root is an error node →
    `{ action: "print" }`.
  - locate `compilerOptions.plugins`; if it's a non-array node →
    `{ action: "print" }`.
  - if an element already has `name === "morphz/ts-plugin"` →
    `{ text, action: "already" }`.
  - else `applyEdits(text, modify(text, ["compilerOptions","plugins",-1],
{ name: "morphz/ts-plugin" }, { formattingOptions: { insertSpaces:
true, tabSize: 2 } }))` → `{ text: next, action: "updated" }`.
- `patchTsconfig(cwd, noTsconfig)`:
  - `noTsconfig` → `{ action: "skipped", reason: "--no-tsconfig" }`.
  - no `tsconfig.json` in `cwd` → `{ action: "skipped", reason: "not found" }`.
  - else read, `mergePluginEntry`, on `"updated"` write the file back; on
    `"print"` set a flag so `printSummary` emits the manual snippet.
- Tests: `tests/init-command/merge-plugin.test.ts` — fixtures: no
  `compilerOptions`; empty `plugins`; `plugins` with another entry (append,
  siblings kept); already has `morphz/ts-plugin` (no-op); file with
  `// comments` + trailing commas (comments survive); broken JSON (→
  `print`); `plugins` is a string (→ `print`).

## T-005 — `zodRangeSatisfiesV4` + `checkZod`

- `readNearestPackageJson(cwd): { path, json } | undefined` — walk up.
- `zodRangeSatisfiesV4(range: string): boolean` per design Q4.
- `checkZod(cwd): { action: "ok" | "warn"; reason }` — never affects exit
  code.
- Tests: `tests/init-command/zod-range.test.ts` — `^4`, `4.0.1`, `~4.2`,
  `>=4`, `*`, `workspace:*` → ok; `^3`, `3.x`, `` (absent) → warn.

## T-006 — `runInit` + `printSummary` wiring

- `runInit(cwd, flags)` — call `writeConfig`, `patchTsconfig`, `checkZod`;
  collect the three outcome lines; `printSummary(outcomes, { printSnippet })`.
- `printSummary` — the exact block from design (action verbs, `next steps`,
  docs URL; manual snippet appended when `patchTsconfig` returned `print`).
- Test: `tests/init-command/init-integration.test.ts` — `mkdtemp`, seed a
  `package.json` (+ optional `tsconfig.json`), `runInit(tmp, {...})`,
  assert files on disk + returned/printed summary. Cases: clean dir; dir
  with existing config (+`--force`); dir with tsconfig already wired; dir
  with no tsconfig; `--no-tsconfig`; `--config-ext js`.

## T-007 — release assertion + docs

- `.github/workflows/release.yml`: add `dist/cli.cjs` to the
  "Assert npm tarball contents" required list. Verify YAML parses.
- `docs/README.md` "Get started": lead with
  ```bash
  npm i morphz zod
  npx morphz init
  ```
  then keep the manual `tsconfig.json` block as "what `init` does for you".
- `docs/guides/editor-tooling.md`: note `npx morphz init` wires the
  `tsconfig.json` plugin.
- `packages/core/README.md`: one line under Install.

## Gate (whole feature) — all met 2026-08-28

- [x] `pnpm --filter morphz build` — `dist/cli.cjs` shebang present
      (`head -1` = `#!/usr/bin/env node`), `node dist/cli.cjs --version`
      and `--help` work.
- [x] **Bundle-leak check**: `grep -c "parseTree|jsonc" dist/index.cjs` ==
      0, == 10 in `dist/cli.cjs`. `index.cjs` size unchanged.
- [x] `npx tsc --noEmit` clean (core).
- [x] `npx turbo run typecheck` — 4/4.
- [x] `npx vitest run` (core) — 286 green (260 + 26 new).
- [x] `npx turbo run test` — 314 monorepo-wide (286 + 22 + 6). (One flaky
      jsdoc-generation file-collision under parallel load on first run;
      green on `--force` re-run — unrelated to this feature.)
- [x] Manual smoke in a fresh `npm init -y` temp dir — config written,
      `tsconfig.json (not found)` + `zod` warning shown correctly.
- [ ] Commit as `feat(cli): ...` (not breaking).
