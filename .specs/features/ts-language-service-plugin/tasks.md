# Tasks: TypeScript Language Service Plugin

**T-003/T-004/T-005 status: DONE (2026-08-25).** All 3 built in parallel
(independent files), 18/18 cumulative pass against the REAL `morphz`
package via `@typescript/vfs`. `features/hover.ts` (appends resolved
description/regex/examples/origin onto the prior hover, never replaces),
`features/completions.ts` (both `#label` and `FieldOf` second-arg
contexts, merges into prior entries), `features/diagnostics.ts` (broken-
-template + bad-post-hook-path checks, codes 900001/900002, appends to
prior diagnostics). Every wrapper degrades to the prior/unmodified result
on any internal error — confirmed via explicit "unrelated position"
negative tests in each suite. Remaining: T-006 (locale cascade + wire all
3 into the real `index.ts`, replacing the stub).

**T-001/T-002 status: DONE (2026-08-25).** Test harness uses a REAL
`node_modules/morphz` (pnpm workspace symlink), not a simplified virtual
`.d.ts` — tests exercise the actual `morphz` package, can't silently drift
from it. `ast-utils.ts`/`resolve-field-info.ts` implemented + tested
(7/7, real Struct/Define recognition against the real package). Fixed a
real bug in `findNodeAtPosition`: `forEachChild` was stopping at the
first child regardless of whether the position actually fell inside it —
fixed by validating the range inside the callback itself.

## T-001: Test harness + AST utilities

- **REQ**: (infrastructure)
- **What**: add `@typescript/vfs` (or equivalent) devDependency to
  `packages/ts-plugin`, build a small helper to create an in-memory
  virtual TS project + language service for tests. `ast-utils.ts`:
  `findNodeAtPosition`, `isStructCallExpression`, `isDefineCallExpression`,
  `getObjectLiteralProperty`.
- **Where**: `packages/ts-plugin/src/ast-utils.ts`, test harness
- **Gate**: `npx vitest run -- ast-utils` (real virtual-project-backed tests)

## T-002: `resolve-field-info.ts`

- **REQ**: REQ-002 (data layer)
- **What**: given a field-declaration `PropertyAssignment` inside a
  `Struct(...)` call, resolve description/regex/format/`Define` origin
  chain, merging inline overrides over the `Define`-level defaults.
- **Depends on**: T-001
- **Gate**: real virtual-project test with a `Define`+`Struct` fixture

## T-003: `getQuickInfoAtPosition` (hover)

- **REQ**: REQ-002
- **What**: `features/hover.ts`, wired into `index.ts`'s proxy.
- **Depends on**: T-002
- **Gate**: real hover test against the INSIGHT.md §11.A `Slug()`-style fixture

## T-004: `getCompletionsAtPosition`

- **REQ**: REQ-003
- **What**: `features/completions.ts` — both label-delimiter and
  `FieldOf` second-arg contexts.
- **Depends on**: T-001
- **Gate**: real completion tests for both contexts

## T-005: `getSemanticDiagnostics`

- **REQ**: REQ-004
- **What**: `features/diagnostics.ts` — broken-template + bad-post-path checks.
- **Depends on**: T-001
- **Gate**: real diagnostic tests, both positive (warning fires) and
  negative (no false positive on a valid Struct)

## T-006: `resolve-locale.ts` + wire everything into `index.ts`

- **REQ**: REQ-005, REQ-001
- **What**: locale cascade per design.md. Replace the current stub
  `index.ts` with the real `init`/`create`, all 3 overrides wired, every
  override wrapped in try/catch degrading to the prior result on error.
- **Depends on**: T-003, T-004, T-005
- **Gate**: full `packages/ts-plugin` test suite + `npx tsc --noEmit`
- **Status**: DONE (2026-08-25), with a packaging bug found and fixed
  after the DEV fork's own report (self-reported deviation from
  `export = init` per design.md, using `export default init` instead).

**Post-T-006 packaging bug (found by me, not a fork, 2026-08-25):**
`tsserver` loads plugins via Node's synchronous `require()` (CommonJS).
The package was building ESM-only (`tsup.config.ts` `format: ["esm"]`)
with `tsconfig.json` `module: "ESNext"` and `export default init` in
`src/index.ts`. In a real tsserver process this either throws
`ERR_REQUIRE_ESM` or, with the default export, hands `require()` an
object `{default: init}` instead of the callable `init` — silently
breaking plugin activation. Invisible to all 22 unit tests because they
call `create()` directly in-process, never exercising the actual
module-loading step. Fixed:
- `tsup.config.ts`: `format: ["cjs"]`, `outExtension: () => ({js: ".cjs"})`
  (tsup's default cjs extension is `.js`, not `.cjs` — needed explicit
  override to match `package.json`'s `main`).
- `src/index.ts`: `export default init` → `export = init` (matches the
  official TS wiki's plugin-loading contract exactly).
- `tsconfig.json`: `module: "ESNext"` → `"CommonJS"`, `moduleResolution:
  "Bundler"` → `"Node10"` (required for `export =` syntax to compile).
- `package.json`: removed `"type": "module"`, `main` → `./dist/index.cjs`,
  `types` → `./dist/index.d.ts` (tsup's dts emission ignored the
  `outExtension.dts` override, kept plain `.d.ts` — matched `types` to
  actual output rather than fighting the tool).
- Verified with a real `require()` smoke test (not just unit tests):
  `node -e "const p = require('./dist/index.cjs'); typeof p === 'function'"`
  confirmed, plus calling `p({typescript:{}})` returns the `{create}`
  module object as tsserver expects.

**Total**: 6 tasks, all DONE. T-001 unblocks everything — build order
otherwise mostly parallel (T-003/T-004/T-005 independent of each other
once T-001/T-002 land).
