# Design: Release Readiness

## Architecture Overview

No application code changes. Everything lives at repo root or in
`.github/workflows/`. Graph not consulted — this is release
infrastructure, not code topology (per skill heuristic: `query` is for
structural questions like "what calls X").

Three independent workstreams:

```
A. Static files        B. Changelog toolchain      C. release.yml hardening
   README.md (root)        cliff.toml                  build-test:  + npm pack assert
   README.md (core)        git-cliff devDep            publish-npm: + --provenance / id-token
   LICENSE (root)          pnpm changelog script       + job: github-release  (.vsix asset)
   CHANGELOG.md (gen)      orhun/git-cliff-action      + job: changelog-commit (push to main)
                                                       vsce step: + .vsix content guard
```

A and B are prerequisites for the first `v0.1.0` tag. C only matters when
a tag is actually pushed (and fully exercised only once the 3 secrets
exist).

## Decisions resolved (OQ-1/2/3)

- **OQ-1 → CI regenerates + commits `CHANGELOG.md` back to `main`.** On a
  `v*` tag build, after the publish jobs, a `changelog-commit` job:
  checks out `main` (not the tag ref), runs git-cliff `--tag <version>`,
  commits `CHANGELOG.md` with message
  `chore(release): update CHANGELOG for <version> [skip ci]`, pushes to
  `main` using the default `GITHUB_TOKEN` (`permissions: contents:
write`). **No trigger loop**: the workflow's `on:` is `push.tags:
['v*']` only — a branch push to `main` cannot re-trigger it. `[skip
ci]` is belt-and-suspenders for any future `on: push` addition.
  Consequence: the tagged commit itself does NOT contain that tag's
  changelog entry; the entry lands one commit later on `main`. Acceptable
  for a solo linear repo — documented in `.github/workflows/README.md`.
- **OQ-2 → both.** `git-cliff` as a root `devDependency`, exposed as
  `pnpm changelog` (writes `CHANGELOG.md`) and `pnpm changelog:latest`
  (renders only the unreleased section to stdout, for local preview). CI
  uses `orhun/git-cliff-action@v4` pinned by major, reading the same
  `cliff.toml`. Local and CI parity guaranteed by the shared config.
- **OQ-3 → tag `main` HEAD directly.** After the `release-readiness`
  commits land on `main`: `git tag v0.1.0 && git push origin v0.1.0`. No
  release branch.

## New files

| File                      | Responsibility                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| `README.md` (root)        | GitHub landing: pitch, package table, monorepo layout, dev commands, "Releasing" section          |
| `packages/core/README.md` | npm page: what/why, install, minimal `Struct`+`Define` example (from INSIGHT.md §1–8), repo links |
| `LICENSE` (root)          | MIT, `Copyright (c) 2026 Leandro Santiago Gomes`                                                  |
| `CHANGELOG.md` (root)     | git-cliff output; first entry `0.1.0` covering all history                                        |
| `cliff.toml` (root)       | git-cliff config — commit grouping, filters, Keep-a-Changelog-ish template                        |

`LICENSE` shipping into artifacts:

- npm (`packages/core`): npm auto-includes a `LICENSE` file from the
  **package** directory, not the repo root. `files: ["dist"]` does not
  cover it, but npm's built-in LICENSE/README inclusion does — **only if
  the file sits in `packages/core/`**. → ship a `packages/core/LICENSE`.
  Options: (a) commit a real copy, (b) symlink (breaks on Windows
  checkouts / npm pack), (c) a `prepack` script that copies root →
  package. **Decision: commit a real copy in `packages/core/LICENSE` and
  `packages/vscode/LICENSE`.** MIT text is 11 lines and never changes;
  three identical files is less fragile than a copy script or symlink.
  A root `pnpm lint`-time check (optional, low priority) can assert the
  three are byte-identical.
- `.vsix` (`packages/vscode`): `vsce` includes `LICENSE`/`readme` from
  the package dir automatically; `.vscodeignore` does not exclude them. →
  `packages/vscode/LICENSE` + existing `packages/vscode/README.md` are
  enough.

## Modified files

| File                            | Change                                                                                   | Risk                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `package.json` (root)           | + `git-cliff` devDep; + `changelog` / `changelog:latest` scripts                         | none — additive                                                             |
| `.github/workflows/release.yml` | see "Workflow changes"                                                                   | medium — only path to prod publish; mitigated by REQ-011 local verification |
| `.github/workflows/README.md`   | document CHANGELOG write-back + GitHub Release + provenance                              | none                                                                        |
| `packages/core/package.json`    | none expected — confirm via `npm pack` that README/LICENSE appear without a `files` edit | low                                                                         |

`tsup.config.ts` (`clean: true`, `sourcemap: true`) — unchanged.
Sourcemaps stay in the tarball (standard for a debuggable lib).

## Workflow changes (`release.yml`)

Existing jobs: `build-test` → (`publish-npm`, `publish-vsce`,
`publish-ovsx`) each `needs: build-test`.

1. **`build-test`** — add, after `pnpm run build`:
   - `npm pack --dry-run --json` in `packages/core`; parse the file list;
     assert presence of `README.md`, `LICENSE`, `dist/ts-plugin/index.cjs`,
     `dist/ts-plugin/index.d.ts`. Fail with `::error::` naming the missing
     entry. (REQ-008)
   - after `vsce package`: `unzip -l *.vsix` (or `vsce ls`); assert
     `extension/README.md` + `extension/LICENSE` present, assert no
     `extension/src/` and no `*.map`. (REQ-010)
2. **`publish-npm`** — add `permissions: { id-token: write, contents:
read }`; change `npm publish` → `npm publish --provenance`. (REQ-007)
3. **new job `github-release`** — `needs: [publish-npm, publish-vsce,
publish-ovsx]`, `permissions: { contents: write }`:
   - `actions/checkout@v4` with `fetch-depth: 0` (git-cliff needs full
     history + tags)
   - `orhun/git-cliff-action@v4` with `args: --latest --strip header`,
     output captured to a file
   - `download-artifact` the `vscode-vsix`
   - `softprops/action-gh-release@v2` (or `gh release create`): `tag:
${{ github.ref_name }}`, `name: ${{ needs.build-test.outputs.version
}}`, `body_path:` the rendered file, `files: *.vsix`. (REQ-009)
4. **new job `changelog-commit`** — `needs: [github-release]`,
   `permissions: { contents: write }`:
   - `actions/checkout@v4` `ref: main`, `fetch-depth: 0`
   - `orhun/git-cliff-action@v4` `args: --tag ${{ ... version }} -o
CHANGELOG.md`
   - if `CHANGELOG.md` changed: `git commit -m "chore(release): update
CHANGELOG for <version> [skip ci]"` + `git push origin main`
   - uses default `GITHUB_TOKEN`; `git config user.name/email` to the
     github-actions bot.

Ordering rationale: publish first, then Release + changelog. A failed
publish must not leave a GitHub Release / changelog entry for bits that
never shipped.

## `cliff.toml` shape

- `[changelog]` — Keep-a-Changelog-ish header; `trim = true`.
- `[git]` — `conventional_commits = true`, `filter_unconventional =
false`, `protect_breaking_commits = true`.
- `commit_parsers` — map `feat`→"Features", `fix`→"Bug Fixes",
  `docs`→"Documentation", `perf`→"Performance", `refactor`→"Refactor";
  `style|chore|ci|build|test` → `skip = true` (except `chore(release)`
  which is skipped too). Scope shown in the entry.
- `tag_pattern = "v[0-9]*"`, `filter_commits = true`.
- First run: `git-cliff --tag v0.1.0 -o CHANGELOG.md` produces one
  `## [0.1.0]` section from the whole history.

## Risks

- **Only path to production publish.** Mitigation: REQ-011 — every step
  except the network `publish` / `gh release` calls is verified locally
  (`npm pack`, `vsce package`, `git-cliff`, `actionlint`) before the
  first tag. `actionlint` was unavailable in the `release-pipeline`
  session; fall back to a Node `yaml` structural parse if still missing.
- **`changelog-commit` pushes to `main` from CI.** Small blast radius
  (one generated file), no loop (tag-only trigger), `[skip ci]` marker.
  If branch protection on `main` blocks the bot push, the job fails
  loudly and the release is still complete (npm + stores + GitHub
  Release all done) — changelog can be pushed by hand. Documented.
- **`dist/ts-plugin/` depends on build order.** `copy-ts-plugin.mjs`
  runs only in the root `pnpm run build` chain, after `turbo run build`.
  REQ-008's `npm pack` assertion turns a silent broken subpath into a
  hard CI failure.
- **npm provenance requires the workflow to be on the default branch and
  public repo.** Repo is public; workflow will be on `main`. If
  provenance attestation fails, `npm publish --provenance` fails the job
  rather than publishing without it — acceptable (loud).

## Decision Log

- git-cliff over semantic-release (bad monorepo story, removes human
  control of version pre-1.0) and release-please (extra bot + manifest;
  the Release-PR gate is worth revisiting at 1.0).
- Three committed `LICENSE` copies over symlink/copy-script — MIT text is
  static and tiny; fewer moving parts.
- CHANGELOG entry for tag N lands on `main` one commit _after_ the tag
  (CI write-back). Accepted for a solo linear repo; the alternative
  (human runs `pnpm changelog` pre-tag) was rejected by the user in
  favour of zero manual steps.
- Sourcemaps stay in the npm tarball.
- GitHub Release created only after all 3 publishes succeed.
