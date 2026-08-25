# Tasks: Monorepo Architecture

**Status: DONE (2026-08-25).** T-001..T-003 executed. `git mv`-based
history-preserving move to `packages/core/`; `packages/ts-plugin/` (typed
stub against `tsserverlibrary`) and `packages/vscode/` (manifest
placeholder) scaffolded; `pnpm-workspace.yaml` + `turbo.json` (`tasks`
schema, turbo 2.10.11) + thin root `package.json`; npm→pnpm switch clean
(`onlyBuiltDependencies` handles esbuild's postinstall). **Gate personally
re-verified by coordinator** (not just trusted from DEV's report): 99/99
tests (`packages/core`, direct `vitest run`), typecheck clean across all 3
packages via `turbo run typecheck`, `oxlint` clean from root (reaches
`packages/*/src`), build clean (known `import.meta`-in-CJS warning,
harmless, already documented in v1's STATE.md).

## T-001: Move `core` into `packages/core/`, scaffold `ts-plugin`/`vscode`

- **REQ**: REQ-001..REQ-004
- **What**: `git mv` src/tests/package.json/tsconfig.json/tsup.config.ts
  into `packages/core/`. Scaffold `packages/ts-plugin/` (no-op plugin
  stub) and `packages/vscode/` (empty manifest placeholder).
- **Where**: whole repo
- **Depends on**: none
- **Done when**: `packages/core/` contains the full prior package
  unchanged; `git log --follow` on a moved file still shows history.
- **Gate**: `git status` clean after move (nothing left behind at old paths)

## T-002: Workspace config (pnpm + turbo) + root package.json

- **REQ**: REQ-001, REQ-005, REQ-006, REQ-007
- **What**: `pnpm-workspace.yaml`, `turbo.json`, root `package.json`
  (thin `turbo run` scripts, shared devDependencies), `.oxlintrc.json`/
  `.oxfmtrc.json` stay at root, confirmed reaching `packages/*/src`.
- **Where**: root
- **Depends on**: T-001
- **Done when**: `pnpm -w run lint`/`format:check` actually scan
  `packages/core/src`.
- **Gate**: manual check of oxlint output file count

## T-003: Switch npm -> pnpm, verify full gate

- **REQ**: (design.md step 8-9)
- **What**: remove `package-lock.json` + root `node_modules`, `pnpm
install`, run full build/test/typecheck/lint across the workspace.
- **Where**: root
- **Depends on**: T-002
- **Done when**: 99/99 tests pass, build/typecheck/lint all clean, exactly
  matching pre-move state.
- **Gate**: `pnpm -w run test && pnpm -w run typecheck && pnpm -w run lint && pnpm -w run build`

**Total**: 3 tasks, strictly sequential.
