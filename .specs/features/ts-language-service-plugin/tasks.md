# Tasks: TypeScript Language Service Plugin

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

**Total**: 6 tasks. T-001 unblocks everything — build order otherwise
mostly parallel (T-003/T-004/T-005 are independent of each other once
T-001/T-002 land).
