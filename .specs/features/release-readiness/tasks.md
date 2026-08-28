# Tasks: Release Readiness

Scope: Medium/Complex. 10 tasks, 2 dependency levels. No application code
touched — all root files + `.github/workflows/`. Gates are local
verification (no secrets needed) per REQ-011.

Waves:

- **Wave A** (`[PA]`) — independent static files: T-001, T-002, T-003
- **Wave B** (`[PB]`) — changelog toolchain, needs nothing from A: T-004
  then T-005 (T-005 depends on T-004)
- **Wave C** — `release.yml`, best done after A+B so the `npm pack`
  assertion has real files to find: T-006, T-007, T-008, T-009
- **T-010** — final full-repo verification, depends on everything

---

## T-001: MIT LICENSE files ✅

- **REQ**: REQ-002
- **What**: Create MIT license text, `Copyright (c) 2026 Leandro Santiago
Gomes`. Place byte-identical copies at repo root, `packages/core/`,
  `packages/vscode/`.
- **Where**: `LICENSE`, `packages/core/LICENSE`, `packages/vscode/LICENSE`
- **Depends on**: none
- **[PA]**
- **Done when**: 3 files exist; `diff LICENSE packages/core/LICENSE` and
  `diff LICENSE packages/vscode/LICENSE` both empty; first line is
  `MIT License`, contains `2026 Leandro Santiago Gomes`.
- **Gate**: `diff LICENSE packages/core/LICENSE && diff LICENSE packages/vscode/LICENSE && head -1 LICENSE`

## T-002: packages/core/README.md ✅

- **REQ**: REQ-001
- **What**: npm-page README for `morphz`. Sections: one-line pitch;
  Install (`pnpm add morphz zod`, note `zod@^4` peer); "Quick example"
  — a `Define`d meta-type + a `Struct` entity + `.parse()` returning a
  real class instance, taken/adapted from `INSIGHT.md` §1–3 and §7 (do
  not invent API — read those sections first); "Editor support" pointing
  at the `morphz-vscode` extension + `morphz/ts-plugin`; "Subpath
  exports" table (`.`, `./register`, `./recipes`, `./ts-plugin`); links
  to repo + CHANGELOG. Keep under ~120 lines.
- **Where**: `packages/core/README.md`
- **Depends on**: none
- **[PA]**
- **Done when**: file exists; every code fence uses only identifiers that
  actually exist in `packages/core/src/index.ts` (grep-verify each
  exported name used); no TODO/placeholder text.
- **Gate**: `node -e "const s=require('fs').readFileSync('packages/core/README.md','utf8'); if(/TODO|FIXME|xxx/i.test(s))process.exit(1)" && grep -c '```' packages/core/README.md`

## T-003: repo-root README.md ✅

- **REQ**: REQ-003
- **What**: GitHub landing page. Sections: pitch paragraph; "Packages"
  table — `morphz` (npm, the library), `morphz-vscode` (Marketplace +
  Open VSX), `@internal ts-plugin` (bundled into `morphz/ts-plugin`, not
  separately published); "Monorepo layout" tree; "Develop" (`pnpm
install`, `pnpm build`, `pnpm test`, `pnpm typecheck`, `pnpm lint`);
  "Releasing" — push a `v*` tag, link to `.github/workflows/README.md`;
  License line.
- **Where**: `README.md` (root)
- **Depends on**: none
- **[PA]**
- **Done when**: file exists; package table has all 3 rows; "Releasing"
  section names the `v*` tag trigger; no placeholder text.
- **Gate**: `grep -q 'v\*' README.md && grep -q 'morphz-vscode' README.md && grep -q 'Releasing' README.md`

## T-004: git-cliff config + tooling ✅

- **REQ**: REQ-004
- **What**: Add `git-cliff` as a root devDependency (`pnpm add -Dw
git-cliff`). Add root `package.json` scripts: `"changelog": "git-cliff
-o CHANGELOG.md"`, `"changelog:latest": "git-cliff --latest --strip
header"`. Create `cliff.toml` per design "cliff.toml shape":
  conventional commits on, `protect_breaking_commits`, parsers mapping
  feat/fix/docs/perf/refactor to sections and skipping
  style/chore/ci/build/test (and `chore(release)`), `tag_pattern =
"v[0-9]*"`.
- **Where**: `package.json` (root), `cliff.toml`, `pnpm-lock.yaml`
- **Depends on**: none
- **[PB]**
- **Done when**: `pnpm changelog:latest` exits 0 and prints grouped
  output (or "no unreleased" cleanly); `cliff.toml` parses.
- **Gate**: `pnpm changelog:latest`

## T-005: generate CHANGELOG.md (0.1.0) ✅

- **REQ**: REQ-005
- **What**: Run `pnpm exec git-cliff --tag v0.1.0 -o CHANGELOG.md` to
  render one `## [0.1.0]` section from the entire history. Eyeball it:
  the v1–v4 feature work should surface under Features/Bug Fixes; pure
  style/chore commits should be absent. Fix `cliff.toml` parsers and
  re-run if grouping is wrong. Commit the file.
- **Where**: `CHANGELOG.md`
- **Depends on**: T-004
- **Done when**: `CHANGELOG.md` exists with exactly one version section
  headed `0.1.0`; contains a "Features" group; contains no lines from
  `style:`/`chore:` commits.
- **Gate**: `grep -qE '^\#\#? \[?0\.1\.0' CHANGELOG.md && ! grep -qiE 'apply oxfmt|line wrap' CHANGELOG.md`

## T-006: build-test — npm pack + vsix assertions  ✅

- **REQ**: REQ-008, REQ-010
- **What**: In `release.yml` `build-test`, after `pnpm run build`: add a
  step that runs `npm pack --dry-run --json` in `packages/core`, parses
  the JSON file list, and fails with `::error::` unless it contains
  `README.md`, `LICENSE`, `dist/ts-plugin/index.cjs`,
  `dist/ts-plugin/index.d.ts`. After the existing `vsce package` step:
  add a step that lists the `.vsix` (`unzip -l` or `npx vsce ls`) and
  fails unless it has `README.md` + `LICENSE` and has NO `src/` entry and
  NO `.map` entry.
- **Where**: `.github/workflows/release.yml`
- **Depends on**: T-001, T-002 (files must exist for the assertion to
  pass locally too)
- **Done when**: workflow YAML still parses; the two new steps exist with
  `::error::` messages; running the pack assertion logic locally against
  a fresh `pnpm build` passes.
- **Gate**: `pnpm run build && cd packages/core && npm pack --dry-run --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const f=JSON.parse(s)[0].files.map(x=>x.path);for(const n of ['README.md','LICENSE','dist/ts-plugin/index.cjs','dist/ts-plugin/index.d.ts'])if(!f.includes(n)){console.error('MISSING',n);process.exit(1)}console.log('ok')})"`

## T-007: publish-npm — provenance  ✅

- **REQ**: REQ-007
- **What**: In `release.yml` `publish-npm` job: add `permissions:
{ id-token: write, contents: read }`; change the publish command to
  `npm publish --provenance`.
- **Where**: `.github/workflows/release.yml`
- **Depends on**: none (independent YAML edit)
- **[PB]** — parallel with T-006 is fine, different job blocks; but keep
  in Wave C for a single workflow-review pass
- **Done when**: `publish-npm` has the `permissions` block with
  `id-token: write`; publish line ends `--provenance`; YAML parses;
  `actionlint` clean (or structural parse if unavailable).
- **Gate**: `node -e "const y=require('yaml').parse(require('fs').readFileSync('.github/workflows/release.yml','utf8'));const j=y.jobs['publish-npm'];if(j.permissions['id-token']!=='write')process.exit(1);console.log('ok')"`

## T-008: github-release job  ✅

- **REQ**: REQ-009, REQ-006 (render half)
- **What**: New job `github-release`, `needs: [publish-npm, publish-vsce,
publish-ovsx]`, `permissions: { contents: write }`. Steps: checkout
  `fetch-depth: 0`; `orhun/git-cliff-action@v4` with `args: --latest
--strip all` writing to a file; `download-artifact` `vscode-vsix`;
  `softprops/action-gh-release@v2` with `tag_name: ${{ github.ref_name
}}`, `name:` the derived version, `body_path:` the rendered file,
  `files: vsix/*.vsix`.
- **Where**: `.github/workflows/release.yml`
- **Depends on**: T-007 (same file, sequence the edits)
- **Done when**: job exists with correct `needs`; `contents: write`
  present; references the `vscode-vsix` artifact; YAML parses;
  `git-cliff --latest --strip all` renders non-empty locally.
- **Gate**: `pnpm exec git-cliff --latest --strip all | head -5 && node -e "const y=require('yaml').parse(require('fs').readFileSync('.github/workflows/release.yml','utf8'));const j=y.jobs['github-release'];if(!j||j.permissions.contents!=='write')process.exit(1);console.log('ok')"`

## T-009: changelog-commit job + workflows/README update  ✅

- **REQ**: REQ-006 (write-back half)
- **What**: New job `changelog-commit`, `needs: [github-release]`,
  `permissions: { contents: write }`. Steps: checkout `ref: main`,
  `fetch-depth: 0`; `orhun/git-cliff-action@v4` `args: --tag <version> -o
CHANGELOG.md`; configure `git` user to the actions bot; if
  `CHANGELOG.md` changed, commit `chore(release): update CHANGELOG for
<version> [skip ci]` and `git push origin main`. Then update
  `.github/workflows/README.md`: document (a) `--provenance`, (b) the
  post-publish GitHub Release with `.vsix` asset, (c) the CHANGELOG
  write-back landing one commit after the tag on `main`.
- **Where**: `.github/workflows/release.yml`, `.github/workflows/README.md`
- **Depends on**: T-008
- **Done when**: job exists with `needs: [github-release]` and
  `contents: write`; commit message contains `[skip ci]`; pushes to
  `main`; `workflows/README.md` mentions all 3 new behaviors; full YAML
  parses; `actionlint` clean or structural parse clean.
- **Gate**: `node -e "const y=require('yaml').parse(require('fs').readFileSync('.github/workflows/release.yml','utf8'));const j=y.jobs['changelog-commit'];if(!j||j.needs.indexOf('github-release')<0)process.exit(1);console.log('ok')" && grep -q 'provenance' .github/workflows/README.md`

## T-010: full local release-readiness verification

- **REQ**: REQ-011 (+ REQ-001/002/003 shipped-artifact check)
- **What**: End-to-end dry check, no secrets: `pnpm install` clean; `pnpm
run build && pnpm test && pnpm typecheck` all green; `npm pack` in
  `packages/core` → inspect real tarball (`tar tzf`) for `README.md`,
  `LICENSE`, `dist/ts-plugin/*`; `npx vsce package` in `packages/vscode`
  → inspect `.vsix` for `README.md` + `LICENSE`, absence of `src/` /
  `.map`; `pnpm changelog` reproduces `CHANGELOG.md` with no diff;
  `actionlint .github/workflows/release.yml` (or Node `yaml` structural
  parse if actionlint unavailable — note which was used). Record every
  command + result in `SUMMARY`-style notes for the commit body.
- **Where**: no file changes (verification only); may fix fallout in
  earlier tasks' files
- **Depends on**: T-001..T-009
- **Done when**: every listed command run and passed; results captured;
  known limitation stated explicitly (no end-to-end tag publish — the 3
  secrets `NPM_TOKEN`/`VSCE_PAT`/`OVSX_PAT` still don't exist).
- **Gate**: `pnpm run build && pnpm test && pnpm typecheck && pnpm changelog && git diff --exit-code CHANGELOG.md`

---

## Not done by these tasks (carried limitations)

- Actual `v0.1.0` tag push + end-to-end pipeline run — needs the 3 repo
  secrets (user action). After T-010, the remaining step is literally
  `git tag v0.1.0 && git push origin v0.1.0` once secrets are in place.
- `npm` provenance attestation can only be confirmed on a real publish
  from `main`.
- VSCode Extension Development Host load test — unchanged limitation from
  `[[vscode-extension]]`.
