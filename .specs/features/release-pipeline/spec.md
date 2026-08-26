# Spec: Release Pipeline

## Summary

GitHub Actions workflow publishing all 3 `morphz` release artifacts
together: `packages/core` to npm, `packages/vscode` to the VSCode
Marketplace, and `packages/vscode` to Open VSX (Cursor/VSCodium/Windsurf/
Theia read from Open VSX, not the Microsoft Marketplace — both needed for
real cross-editor reach). Resolves a standing `STATE.md` Todo ("npm
publish... never addressed") and closes out the `vscode-extension`
feature's deferred publishing concern in one place.

## Requirements

- REQ-001: Workflow triggers on pushing a version tag (`v*`) — not on
  every push to `main` — publishing is a deliberate, tagged action.
- REQ-002: Builds + tests + typechecks all 3 packages before any publish
  step runs (reuse existing `turbo run build/test/typecheck`) — a publish
  never ships un-gated code.
- REQ-003: `packages/core` → `npm publish` (public, package name `morphz`).
- REQ-004: `packages/vscode` → `vsce package` then `vsce publish` (VSCode
  Marketplace) AND `ovsx publish` (Open VSX), from the SAME built `.vsix`
  — not two separate builds, to guarantee both stores ship identical bits.
- REQ-005: Secrets consumed from GitHub repo secrets, never hardcoded:
  `NPM_TOKEN`, `VSCE_PAT`, `OVSX_PAT`. Workflow fails loudly (not
  silently skips) if a required secret is missing when its job runs.
- REQ-006: Version source of truth = the git tag itself (`v1.2.3` → publish
  `1.2.3`) — not 3 independently-maintained `package.json` versions drifting
  apart. `packages/core/package.json`, `packages/vscode/package.json` both
  read/write from the tag at publish time.
- REQ-007: A failed publish step for one target (e.g. Open VSX rejects)
  must not silently mask a success on another — job-level granularity, one
  job per publish target, so GitHub's UI shows exactly which succeeded.

## Affected Components (no graph — direct inspection)

- `.github/workflows/` — new workflow file. **Note**: user is concurrently
  setting up their own GitHub Actions/lefthook/commitlint tooling in this
  repo (per earlier session decision, `[[project-decisions]]` in
  STATE.md) — check for an existing `.github/workflows/` directory before
  writing, to avoid clobbering work already in progress there.
- `packages/core/package.json` — npm publish target, needs `publishConfig`
  confirmed (`access: public` — scoped-looking name but not npm-scoped).
- `packages/vscode/package.json` — needs `publisher` field (VSCode
  Marketplace requires a registered publisher ID) — **blocking, needs
  user's actual Marketplace publisher ID**, and an Open VSX namespace
  (usually same ID, needs separate registration at open-vsx.org).
- `packages/prepublish` — explicitly out of scope, user's own external
  artifact, not to be touched or referenced by this workflow.

## Out of Scope

- Actually creating the npm/VSCode Marketplace/Open VSX accounts or
  tokens — user's own action, outside what I can do.
- Auto-bumping versions / changelog generation (e.g. changesets) — not
  requested, would be new unrequested scope.
- Publishing on every merge to `main` (continuous deployment) — tag-gated
  only, per REQ-001.

## Open Questions

- **Resolved** (2026-08-25): publisher ID/Open VSX namespace not yet
  registered — user chose to proceed with placeholder `leandroluk` in
  `packages/vscode/package.json`'s `publisher` field and the workflow,
  to swap for the real value once registered at
  marketplace.visualstudio.com / open-vsx.org. Does not block writing
  the extension manifest or the workflow YAML.
- `NPM_TOKEN`/`VSCE_PAT`/`OVSX_PAT` must be added as GitHub repo secrets
  by the user before the workflow's publish jobs can ever succeed — the
  workflow file itself can be written and will fail loudly (not
  silently) until they exist, so this doesn't block writing the YAML,
  only actually running it end-to-end.
