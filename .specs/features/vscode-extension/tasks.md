# Tasks: VSCode Extension

## T-001: `./ts-plugin` export subpath (prerequisite, blocks everything else)

**Status: DONE (2026-08-26).** `packages/core/package.json` exports
`./ts-plugin` → `dist/ts-plugin/index.cjs`/`index.d.ts`. Root `package.json`
`build` script chains `turbo run build && node packages/core/scripts/
copy-ts-plugin.mjs` (copies `packages/ts-plugin/dist` into `packages/core/
dist/ts-plugin` after the whole-monorepo build — no `turbo.json`
`dependsOn` edit needed, since a scopeless `turbo run build` already
builds every package, ts-plugin included, before the copy step runs).
Verified: `require('./dist/ts-plugin/index.cjs')` from `packages/core`
AND `require('morphz/ts-plugin')` from `packages/ts-plugin` (real
workspace resolution) both return `typeof === "function"`. `npx turbo
run typecheck` clean across the monorepo.

- **REQ**: (prerequisite — see spec.md's Affected Components, design.md's
  Decision Log)
- **What**: `packages/core/package.json` gains `"./ts-plugin"` in
  `exports`, pointing at `dist/ts-plugin/index.cjs` (+ `.d.ts`). Add a
  `postbuild` script (or `tsup` `onSuccess` hook) that copies
  `packages/ts-plugin/dist/*` into `packages/core/dist/ts-plugin/` after
  `packages/core`'s own build. Root `turbo.json`'s `build` pipeline needs
  `packages/core`'s build to `dependsOn` `packages/ts-plugin`'s build (so
  Turborepo builds ts-plugin first).
- **Where**: `packages/core/package.json`, `packages/core/tsup.config.ts`
  (or a small copy script), root `turbo.json`.
- **Gate**: real smoke test — `node -e "const p = require('morphz/ts-plugin'); console.log(typeof p)"`
  from a location that resolves the workspace's `morphz` package, must
  print `function`. Also `npx tsc --noEmit` clean across the monorepo.

## T-002: Extension manifest

- **REQ**: REQ-001, REQ-002, REQ-005
- **What**: rewrite `packages/vscode/package.json` — real
  `contributes.typescriptServerPlugins` entry (`name: "morphz"`,
  `enableForWorkspaceTypeScriptVersions: true`), `publisher: "leandroluk"`
  (placeholder, per user decision), `activationEvents:
["onLanguage:typescript", "onLanguage:typescriptreact"]`, `categories`,
  `engines.vscode`, devDependencies (`@types/vscode`, `@vscode/vsce`,
  `esbuild`).
- **Depends on**: T-001 (manifest references the now-real export path
  conceptually, though the `name` field is just `"morphz"` — still
  correct to land after T-001 confirms that name resolves to something).
- **Gate**: `code --install-extension` (or manual load via Extension
  Development Host, `F5`) against a scratch workspace with `morphz`
  installed — hover/completions/diagnostics from `ts-language-service-plugin`
  visibly appear. This is the one gate in this whole session that
  genuinely cannot be verified by an automated test — VSCode's extension
  host isn't scriptable from Vitest. Document the manual verification
  steps taken, don't skip verification just because it's manual.

## T-003: `extension.ts` + `status-bar.ts`

- **REQ**: REQ-003, REQ-004, REQ-005
- **What**: `activate(context)` registers the status bar item + a
  `vscode.window.onDidChangeActiveTextEditor` listener; `status-bar.ts`
  reads the open workspace's nearest `package.json` (via
  `vscode.workspace.findFiles('**/package.json', '**/node_modules/**', 1)`
  relative to the active file) and shows "morphz: active" vs "morphz: not
  a dependency" vs hidden entirely for non-TS files. `deactivate()`
  disposes the status bar item.
- **Depends on**: T-002 (needs the manifest's `main` entry point to exist)
- **Gate**: unit-testable logic (the package.json-detection function)
  extracted into a pure function, tested with `vitest` + a fixture
  `package.json`; the `vscode` module itself is mocked (standard pattern
  — `vscode` isn't resolvable outside the extension host).

## T-004: Build + package

- **REQ**: (packaging, not a numbered REQ — infrastructure)
- **What**: `esbuild` bundle (`extension.ts` → `dist/extension.js`,
  `platform: "node"`, `external: ["vscode"]`, `format: "cjs"` — VSCode
  extensions load via `require()`, same constraint class as the
  ts-plugin's own packaging fix this session). `vsce package` produces a
  real `.vsix`.
- **Depends on**: T-002, T-003
- **Gate**: `npx vsce package` succeeds, produces a non-empty `.vsix`
  file; `npx vsce ls` (dry listing) shows no missing-field errors
  (missing `publisher`, `README.md`, etc.).

## T-005: `README.md`

- **REQ**: REQ-006
- **What**: Marketplace listing copy — what the extension does, that it
  requires `morphz` as a project dependency, how activation works (no
  config needed), link to `ts-language-service-plugin`'s feature set
  (hover/completions/diagnostics).
- **Depends on**: none (can run parallel to T-003/T-004)
- **Gate**: file exists, non-empty, matches what T-002's manifest
  actually declares (no aspirational features not yet built).

**Total**: 5 tasks, all DONE (2026-08-26). T-001 unblocks everything (real
prerequisite, not busywork — nothing else can be genuinely verified
without it). T-004 is the final integration gate. T-005 independent, done
in parallel with T-003/T-004.

**T-002..T-005 completion note**: manifest (`contributes.
typescriptServerPlugins` → `name: "morphz"`, `publisher: "leandroluk"`
placeholder), `detect-morphz-dependency.ts` (pure, `vscode`-free, 6
vitest cases) + `status-bar.ts` (real `vscode` APIs, honest "best-effort
proxy" tooltip per design.md's Risks) + `extension.ts`
(`activate`/`deactivate`), `esbuild.config.mjs` (CJS bundle, `external:
["vscode"]` — confirmed via a real `require()` smoke test that throws
`Cannot find module 'vscode'`, proving the bundle stays a genuine
extension-host-only CJS module, same packaging discipline as this
session's earlier ts-plugin fix), `README.md`. Deviation from the task
list: `pnpm-workspace.yaml` needed `@vscode/vsce-sign`/`keytar` added to
`allowBuilds`/`onlyBuiltDependencies` (pnpm blocks their postinstall
scripts by default) — required for `vsce package` to run at all, not
optional polish. `.vscodeignore` added (excludes `src/`/`tests/`/config
from the shipped `.vsix`), `*.vsix` added to root `.gitignore`.

**Independently re-verified by me** (not just trusted from the DEV
fork's report — its first run died mid-T-001 to a session-limit reset,
so every claim was re-checked): `npx tsc --noEmit` clean, `npx vitest
run` 6/6, `npx vsce package` → real non-empty `.vsix` (7.31 KB, 6 files,
only a pre-existing missing-LICENSE warning, out of scope), `npx turbo
run test typecheck` clean across the whole monorepo (7/7 tasks — core
254 tests, ts-plugin 22, vscode 6). One false alarm during my
re-verification: `tsc` initially failed with `Cannot find module
'vscode'` — turned out to be a stale `node_modules` link state (fixed by
`pnpm install` after a full `node_modules` wipe), not a real bug; the
DEV fork's original "clean" claim was accurate for the state it built
in, just not the state left on disk afterward.

**Not verified** (documented limitation per design.md's Risks and T-002's
own gate description): loading the extension in a real VSCode Extension
Development Host and visually confirming hover/completions/diagnostics —
no automatable path from a terminal-only environment. Manifest
correctness substituted via `vsce package`/`vsce ls` instead.
