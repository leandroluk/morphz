# Conventions: morphz

- TypeScript, ESM-first (`type: module` in package.json), dual ESM/CJS build via `tsup`.
- Zod v4 (peer dependency) — never re-implement what Zod already does; `morphz` composes Zod schemas + attaches metadata, per the guiding principle: "morphz = Zod + OO/class type-safety layer, never invents behavior Zod itself wouldn't produce."
- No default exports — named exports only, re-exported from `src/index.ts`.
- Internal-only symbols/helpers live under `src/core/`; public primitives live under `src/primitives/`.
- `STRUCT_META` (symbol-keyed) is the cross-feature contract — never read/write it via string keys, always via the exported symbol.
- No comments explaining WHAT code does — only WHY, when non-obvious (a Zod API quirk, a deliberate deviation from a naive implementation).
- Test files colocated as `*.test.ts` next to the source file they cover, run via `vitest`.
- Every DEV task must run `npx tsc --noEmit` clean before considering the task done; QA re-verifies with `npm test`.
