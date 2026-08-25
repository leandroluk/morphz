# Spec: Monorepo Architecture

## Summary

Restructures the repo from a single package into a pnpm-workspaces +
Turborepo monorepo, per `INSIGHT.md` §14. `packages/core` becomes the
current `morphz` package (all existing `src/`, `tests/` move there
unchanged). `packages/ts-plugin` and `packages/vscode` are new, empty
scaffolds for `ts-language-service-plugin` and a future editor extension.
This is a **prerequisite** for `ts-language-service-plugin` (needs its own
publishable package importing `core` as `workspace:*`) — nothing else in
the new item set strictly requires it, but doing it first avoids a second
disruptive move later.

## Requirements

- REQ-001: Root becomes a pnpm workspace: `pnpm-workspace.yaml` listing
  `packages/*`. Root `package.json` becomes workspace-root-only (no
  `dependencies`/`build` output of its own — scripts delegate to
  `turbo run <script>`).
- REQ-002: `packages/core/` receives the ENTIRE current package unchanged
  in behavior: `src/`, `tests/`, `package.json` (renamed/scoped as
  needed — keep publishing as `morphz`, not `@morphz/core`, per
  INSIGHT.md §14's package.json snippet), `tsconfig.json`, `tsup.config.ts`.
  All 99 existing tests must pass identically after the move — pure
  relocation, zero behavior change.
- REQ-003: `packages/ts-plugin/` — empty scaffold only (package.json,
  tsconfig.json, minimal `src/index.ts` placeholder). Real implementation
  is `ts-language-service-plugin` feature's job, not this one's.
- REQ-004: `packages/vscode/` — empty scaffold only, same treatment.
  INSIGHT.md marks this "(Opcional)" — scaffold it anyway since it costs
  nothing and matches the documented structure, but no feature in this
  batch implements it.
- REQ-005: `turbo.json` configures `build`/`test`/`typecheck`/`lint`
  pipelines across packages, with `core` built before `ts-plugin` (task
  dependency `^build`).
- REQ-006: Root `package.json` scripts become thin `turbo run <x>`
  delegates (`build`, `test`, `lint`, `format`, `typecheck`) so the
  existing developer muscle-memory (`npm run test` from root) keeps
  working across the whole workspace.
- REQ-007: `oxlint`/`oxfmt` configs stay at the ROOT (single shared config
  for the whole workspace, not per-package) — no reason to fragment lint
  rules per package for a monorepo this size.
- REQ-008: `.gitignore` updated for `packages/*/dist`, `packages/*/node_modules`.

## Affected Components

Every existing file under `src/`, `tests/`, plus root `package.json`,
`tsconfig.json`, `tsup.config.ts`, `.oxlintrc.json`, `.oxfmtrc.json`,
`.gitignore` — all relocate or get rewritten. This is the highest-blast-
-radius change made to the repo since its creation; treat as a single,
atomic commit (`git mv`-based, preserving history) with a full green
test/lint/build run as the gate before merging.

## Out of Scope

- Actual `ts-plugin`/`vscode` package implementations — separate features.
- A root `docs/` directory — explicitly deferred per user request ("no
  futuro incluir um diretório de docs no root"). Noted in `ROADMAP.md` as
  a planned-but-not-yet-scoped future addition; no feature spec written
  for it yet, no placeholder directory created now (an empty scaffold
  would just be noise until there's real content to put in it).
- npm publish / CI changes — this restructures local layout only.

## Resolved

- `ts-plugin` distribution: INSIGHT.md §14 explicitly offers BOTH options
  ("pacote separado... quanto empacotado via subpath export") and then
  shows the subpath-export form as the "zero-friction" recommended
  consumer experience. Resolution: `packages/ts-plugin` stays a real
  workspace package at DEV time (its own `tsconfig`, testable in
  isolation, imports `core` as `workspace:*`) — but its BUILD output gets
  bundled into `packages/core`'s own `dist/ts-plugin/`, and `core`'s
  `package.json` `exports` maps `"./ts-plugin"` to that bundled output
  (matching INSIGHT.md's exact snippet). `ts-plugin` is never published as
  its own npm package. This is REQ-005's `^build` task dependency's actual
  purpose: `core`'s build step needs `ts-plugin`'s compiled output before
  it can bundle it in.

- Package manager: repo currently uses `npm` (`package-lock.json`
  committed). `INSIGHT.md` §14 explicitly specifies pnpm workspaces —
  unambiguous, not left open. Migrating: remove `package-lock.json`,
  `node_modules`, add `pnpm-workspace.yaml`, reinstall via `pnpm install`,
  commit `pnpm-lock.yaml`. This is the one genuinely irreversible-feeling
  step (lockfile history reset) — flagged for the user's awareness in
  STATE.md, not blocking execution (INSIGHT.md already settled it).
- `packages/core` keeps publishing as bare `morphz` (no `@scope`), matching
  INSIGHT.md's `package.json` snippet exactly — not `@morphz/core`.

## Open Questions

- None blocking — both prior open items resolved above.
