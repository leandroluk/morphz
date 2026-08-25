# Design: Monorepo Architecture

## Sequence (order matters — each step must leave the repo in a working,

## testable state before the next, so a bad step is easy to isolate)

1. **Scaffold `packages/core/` and move everything via `git mv`** (preserves
   history) — `src/`, `tests/`, `package.json`, `tsconfig.json`,
   `tsup.config.ts` all move from root into `packages/core/`. Root's
   `.oxlintrc.json`/`.oxfmtrc.json` STAY at root (REQ-007).
2. **Rewrite `packages/core/package.json`**: unchanged `name`
   (`"morphz"`), `exports`, `dependencies`. Only paths inside scripts that
   assumed root-relative execution need checking (should be none — tsup/
   vitest/tsc all run relative to their own `package.json`'s directory).
3. **Scaffold `packages/ts-plugin/`**: minimal `package.json` (private,
   `"name": "@morphz/ts-plugin-internal"` or similar — never published
   standalone per the spec's resolution), `tsconfig.json` extending a
   shared base, `src/index.ts` exporting a no-op
   `init(): ts.server.PluginModule` stub (just enough to typecheck and
   build — `ts-language-service-plugin` fills in real logic later).
4. **Scaffold `packages/vscode/`**: minimal `package.json` (`private:
true`, VSCode extension manifest fields as placeholders), no real
   source yet.
5. **Root `pnpm-workspace.yaml`**: `packages: ["packages/*"]`.
6. **Root `package.json`**: strip `dependencies`/`devDependencies` that
   belong to `core` specifically (zod, jiti move to `packages/core`;
   `typescript`/`tsup`/`vitest`/`oxlint`/`oxfmt` stay at root as SHARED
   devDependencies via pnpm's hoisting — workspace-wide tooling versions
   pinned once). Scripts become `turbo run build`, `turbo run test`, etc.
7. **`turbo.json`**: pipeline with `build` depending on `^build` (so
   `core` builds before `ts-plugin`, which imports `core` as
   `workspace:*`), `test`/`lint`/`typecheck` with no cross-package
   ordering requirement.
8. **Package manager switch**: remove `package-lock.json` + root
   `node_modules`, run `pnpm install` (creates `pnpm-lock.yaml` +
   per-package `node_modules` + root hoisted store).
9. **Verify**: `pnpm -w run build`, `pnpm -w run test`, `pnpm -w run
typecheck`, `pnpm -w run lint` — all must pass identically to the
   pre-move state (99/99 tests, clean build/lint/typecheck) before this is
   considered done.
10. **`.gitignore`**: add `packages/*/dist`, `packages/*/node_modules`
    (root-level `node_modules`/`dist` entries already cover the common
    pnpm hoisting layout, but per-package entries are explicit/safe).

## `packages/ts-plugin`'s bundling-into-core mechanism (deferred detail)

The spec resolved that `ts-plugin`'s BUILD output gets folded into
`core`'s `dist/ts-plugin/`. The EXACT mechanism (does `core`'s `tsup`
config add a second entry point pointing at
`../ts-plugin/dist/index.js`? does `core` re-export `@ts-plugin`'s build
via a workspace dependency + its own bundler step?) is `ts-language-
-service-plugin`'s concern once it has REAL logic to bundle — this
feature only needs `packages/core`'s `package.json` `exports` map to
ALREADY declare the `"./ts-plugin"` subpath (pointing at a location that
doesn't need to resolve correctly yet, since there's no real plugin logic
in this batch's scope) so the shape is right when the later feature fills
it in.

## Risks

- This is a pure mechanical move with a hard, objective gate (99/99 tests
  - clean build/lint/typecheck) — low risk of subtle behavior change as
    long as the gate is actually run and green before considering it done.
    The one real risk is the package-manager switch (npm → pnpm) silently
    changing dependency resolution (peer dep handling, hoisting) in a way
    that breaks something the npm install didn't catch — mitigated by
    running the FULL gate immediately after `pnpm install`, not assuming
    it's fine.
- `oxlint`/`oxfmt` configs at root scanning `packages/*/src` — confirm
  their default include globs actually reach into the new nested
  directory structure (may need an explicit `path`/glob update in
  `.oxlintrc.json`, currently likely defaults to scanning from CWD).

## Decision Log

- Chose `git mv` over recreate-from-scratch specifically to preserve file
  history through the restructure — `git log --follow` still works on
  moved files afterward.
- Root keeps shared devDependencies (build/test/lint tooling) rather than
  duplicating them per-package — standard monorepo practice, avoids
  version drift between `core` and future `ts-plugin` on shared tooling.
