# Tasks: Release Pipeline

Medium scope — inline design (see spec.md's Requirements for the
architectural decisions: tag-triggered, gate-before-publish, one job per
target, tag is the version source of truth).

## T-001: `packages/core/package.json` publish readiness

- **What**: confirm/add `"publishConfig": { "access": "public" }`
  (package name `morphz` is unscoped so this is likely a no-op, but
  explicit is safer than assuming npm's default).
- **Gate**: `npm publish --dry-run` in `packages/core` succeeds with no
  errors (does not actually publish).

## T-002: `packages/vscode/package.json` publish readiness

- **What**: `publisher: "leandroluk"` (placeholder, per user decision —
  same value used in `vscode-extension`'s T-002), `repository` field.
- **Depends on**: `vscode-extension` T-002 (same file, avoid conflicting
  edits — land after that manifest rewrite lands).
- **Gate**: `npx vsce ls` dry-listing shows no missing-field errors.

## T-003: workflow file

- **What**: `.github/workflows/release.yml` — triggers on `push: tags:
["v*"]`. Jobs: `build-test` (turbo build/test/typecheck, blocking for
  everything else via `needs:`), `publish-npm` (npm publish, `NPM_TOKEN`),
  `publish-vsce` (vsce package + publish, `VSCE_PAT`), `publish-ovsx`
  (ovsx publish using the SAME `.vsix` artifact from `publish-vsce` via
  `actions/upload-artifact`/`download-artifact` — not a second build,
  per spec.md REQ-004). Version derived from `github.ref_name` (strips
  the `v` prefix), written into both `package.json`s via `npm version
--no-git-tag-version` before their respective publish step.
- **Depends on**: T-001, T-002.
- **Gate**: `actionlint` (or `yamllint` if `actionlint` unavailable)
  clean; cannot gate an actual publish run without real secrets/tags —
  documented as a known manual-verification gap, same class as
  `vscode-extension` T-002's extension-host limitation.

## T-004: document required secrets

- **What**: short section in root `README.md` (or a
  `.github/workflows/README.md` if one doesn't already exist from the
  user's own concurrent CI setup — check first, don't clobber) listing
  the 3 required secrets (`NPM_TOKEN`, `VSCE_PAT`, `OVSX_PAT`) and where
  to generate each (npmjs.com access tokens, Marketplace publisher PAT,
  open-vsx.org access token).
- **Depends on**: T-003.
- **Gate**: file exists, accurately matches the secret names actually
  referenced in `release.yml`.

**Total**: 4 tasks, all DONE (2026-08-26). No `vitest` gate possible for
the workflow itself (GitHub Actions YAML isn't unit-testable) —
`actionlint`/manual review is the real gate here, called out explicitly
rather than skipped.

**Completion note**: `packages/core/package.json` gained `publishConfig:
{access: "public"}`. `packages/vscode/package.json` already had
`publisher`/`repository` from the earlier `vscode-extension` feature, no
edit needed. `.github/workflows/release.yml` — `build-test` job (gates
everything via `needs:`) builds/tests/typechecks, derives version from
`GITHUB_REF_NAME`, bumps both `package.json`s, packages the `.vsix`, and
uploads 2 artifacts (`core-package`, `vscode-vsix`) shared by the 3
publish jobs so the `.vsix` is only built once. Each `publish-*` job
fails loudly with an explicit `::error::` if its secret
(`NPM_TOKEN`/`VSCE_PAT`/`OVSX_PAT`) is missing, before attempting
anything. `.github/workflows/README.md` documents all 3 secrets and
where to generate each (root `README.md` doesn't exist yet — deferred
per STATE.md's own Todos, not this feature's concern).

`actionlint` wasn't installable via `npx` in this environment
(`could not determine executable to run`) — validated the YAML's
structure with Node's `yaml` package instead (temporarily added as a
root devDependency, then removed — a first attempt left a dangling
`yaml@2.9.0` peer resolution in `pnpm-lock.yaml` that I caught and fixed
via a full `node_modules` wipe + `git checkout -- pnpm-lock.yaml` +
reinstall, restoring a clean lockfile with zero trace of the temp dep).

**Independently re-verified by me** (not just trusted from the DEV
fork's report): `npm publish --dry-run` in `packages/core` → real dry-run
output confirms `public access` (from the new `publishConfig`), `morphz@
0.1.0`, 25 files, 136.4 kB tarball. `npx vsce ls` in `packages/vscode` →
clean, 4 files, no missing-field errors. `npx turbo run test typecheck`
across the whole monorepo → 7/7 green, 282 tests (core 254 + ts-plugin
22 + vscode 6).

**Not verified** (documented limitation, same class as
`vscode-extension`'s manual-only gate): an actual end-to-end tag-push
publish run — `NPM_TOKEN`/`VSCE_PAT`/`OVSX_PAT` don't exist as real repo
secrets yet, and the workflow is intentionally structured to fail loudly
rather than silently skip when they're absent.
