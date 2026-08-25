# Tasks: Project Configuration (`morphz.config.ts`)

_(PO breakdown, from spec.md + design.md)_

## T-001: `defineConfig()`

- **REQ**: REQ-001
- **What**: type-only identity function.
- **Where**: `src/core/define-config.ts`
- **Depends on**: none
- **Done when**: `defineConfig({...})` returns its input unchanged, typed.
- **Gate**: `npx tsc --noEmit`

## T-002: `discoverConfig()` + `getConfig()` singleton

- **REQ**: REQ-002, REQ-003, REQ-004, REQ-005
- **What**: cosmiconfig-style sync upward search for
  `morphz.config.{ts,js,mjs,cjs}` from `process.cwd()`, loaded via `jiti`
  (uniform for all extensions). `getConfig()` caches the result (or `{}`)
  in a module-level singleton, populated at most once.
- **Where**: `src/core/config.ts`
- **Depends on**: T-001, `jiti` (already a dependency)
- **Done when**: a `morphz.config.ts` in a temp fixture dir is discovered
  and its `locale.default`/`template.delimiter` read back via
  `getConfig()`; no file present → `getConfig()` returns `{}` without
  throwing.
- **Gate**: `npm run test -- config`

## T-003: `morphz/register`

- **REQ**: REQ-005
- **What**: side-effect module calling the same discovery eagerly; no-op if
  `getConfig()` already populated the singleton.
- **Where**: `src/register.ts`
- **Depends on**: T-002
- **Done when**: importing `morphz/register` populates config before any
  other `morphz` API call needs it; importing it twice is a no-op (single
  discovery run, verified via a call-count spy on the discovery function).
- **Gate**: `npm run test -- register`

**Total**: 3 tasks, sequential.
