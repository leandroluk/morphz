## Degraded Mode

- graphify not run yet against the real codebase (was greenfield at spec
  time). Consider `graph-spec-design .` now that source exists (see Todos).

## Decisions (recent — older entries in STATE_ARCHIVE.md)

- [2026-08-25] `struct-type-inference` fully resolved the CRITICAL FINDING
  (`Struct()` not generic → zero consumer TS inference). See Progress.
- [2026-08-25] User confirmed `packages/vscode` is NOT optional — wants a
  REAL VSCode extension, Tailwind-CSS-IntelliSense style, not a stub.
- [2026-08-25] `packages/prepublish` explicitly out of scope — user's own
  external artifact, do not touch.
- User is concurrently setting up git/lefthook/commitlint/GitHub workflows
  themselves — do not interfere with that area unless explicitly asked
  (exception already made once: fixing a broken `pnpm-workspace.yaml`
  placeholder at explicit request).

**Full history** (all 8 v1 features' Design decisions, v2/v3/v4 batch
resolutions): see `STATE_ARCHIVE.md`.

- [2026-08-25] Specify + Design + Tasks complete for 2 new features:
  `vscode-extension` (real extension, thin `contributes.typescriptServerPlugins`
  activator + status bar — no reimplemented language logic, that's
  already `ts-language-service-plugin`'s job) and `release-pipeline`
  (GitHub Actions, tag-triggered, publishes `morphz` to npm +
  `packages/vscode` to BOTH VSCode Marketplace and Open VSX from the
  same `.vsix`). User resolved 2 blocking decisions: publisher ID/Open
  VSX namespace not yet registered → placeholder `leandroluk` used in
  both features' manifests/workflow until user registers the real one;
  publish target = real Marketplace + Open VSX via CI, not just local
  `.vsix`. **Real prerequisite gap found during Specify**: `monorepo-
architecture`'s original decision ("ts-plugin bundled into core's dist
  as a subpath export") was never actually implemented — `packages/core/
package.json`'s `exports` only has `.`/`./register`/`./recipes`, no
  `./ts-plugin`. Captured as `vscode-extension` T-001, blocking
  everything else in that feature (the extension's `contributes` entry
  is non-functional without it).

## Progress (recent — older entries in STATE_ARCHIVE.md)

- [2026-08-26] `release-pipeline` T-001..T-004 complete — **feature 100%
  done, all 4 tasks. Both new features from this batch (`vscode-
extension` + `release-pipeline`) are now fully shipped.** `packages/
core/package.json` gained `publishConfig: {access: "public"}`.
  `packages/vscode/package.json` already had `publisher`/`repository`
  from `vscode-extension`, no edit needed. New
  `.github/workflows/release.yml` — tag-triggered (`v*`), `build-test`
  job gates everything via `needs:` (build/test/typecheck the whole
  monorepo, derive version from `GITHUB_REF_NAME`, bump both
  `package.json`s, package the `.vsix` ONCE, upload as 2 shared
  artifacts), then `publish-npm`/`publish-vsce`/`publish-ovsx` each fail
  loudly (`::error::`) if their secret is missing rather than silently
  skipping. `.github/workflows/README.md` documents the 3 required
  secrets. `actionlint` wasn't available in this environment — validated
  the YAML structurally via Node's `yaml` package instead (temp
  devDependency, removed after). **Real cleanup needed during my
  independent re-verification**: the fork's removal of that temp `yaml`
  dependency left a dangling peer resolution in `pnpm-lock.yaml`
  (`tsup@8.5.1(...)(yaml@2.9.0)` — the package itself still physically
  present in the pnpm store even though `package.json` no longer listed
  it) — fixed via `git checkout -- pnpm-lock.yaml` + full `node_modules`
  wipe + reinstall, confirmed zero trace remains. Gate, all independently
  re-confirmed by me: `npm publish --dry-run` in `packages/core` → real
  dry-run output shows `public access`, `morphz@0.1.0`, 25 files, 136.4
  kB. `npx vsce ls` in `packages/vscode` → clean, 4 files. `npx turbo run
test typecheck` monorepo-wide → 7/7 green, 282 tests unchanged. **Not
  verified** (documented limitation): an actual end-to-end tag-push
  publish, since `NPM_TOKEN`/`VSCE_PAT`/`OVSX_PAT` don't exist as real
  repo secrets yet — user needs to register the real VSCode Marketplace
  publisher/Open VSX namespace (still placeholder `leandroluk`) and add
  the 3 secrets before this pipeline can actually run.
- [2026-08-26] `vscode-extension` T-001..T-005 complete — **feature 100%
  done, all 5 tasks.** T-001 (real prerequisite gap, not busywork): added
  `packages/core/package.json`'s missing `./ts-plugin` export subpath +
  `packages/core/scripts/copy-ts-plugin.mjs` (root `build` script chains
  `turbo run build && node .../copy-ts-plugin.mjs` — no `turbo.json`
  `dependsOn` edit needed since a scopeless `turbo run build` already
  builds every package first). T-002..T-005: real manifest
  (`contributes.typescriptServerPlugins`, `publisher: "leandroluk"`
  placeholder), `extension.ts`/`status-bar.ts` (honest "best-effort
  proxy" status bar — VSCode has no API to confirm a contributed TS
  plugin actually loaded), `detect-morphz-dependency.ts` (pure, tested,
  6/6), `esbuild.config.mjs` (CJS bundle, `vscode` external — confirmed
  via real `require()` throwing `Cannot find module 'vscode'`),
  `README.md`. **This was 2 forks**: the first died mid-T-001 to an
  Anthropic session-limit reset (not a real failure) — I personally
  re-verified its partial T-001 work before relaunching a second fork
  for T-002..T-005, then independently re-ran every gate myself rather
  than trusting the second fork's report (its first run died once
  already, raising the bar for trust). One false alarm during my
  re-verification: `tsc --noEmit` initially failed with `Cannot find
module 'vscode'` — a stale `node_modules` link state, fixed by a full
  `pnpm install` after wiping `node_modules`, not a real code bug. Final
  gate, all independently confirmed: `npx tsc --noEmit` clean, `npx
vitest run` 6/6, `npx vsce package` → real 7.31 KB `.vsix`, `npx turbo
run test typecheck` clean monorepo-wide (7/7 tasks, 282 tests total:
  core 254 + ts-plugin 22 + vscode 6). **Not verified** (no automatable
  path from a terminal-only environment): loading the extension in a
  real VSCode Extension Development Host — documented as a known
  limitation, not skipped silently. `release-pipeline` (T-001..T-004)
  still pending — depends on this feature's T-002 manifest, which is now
  done, so it's unblocked.
- [2026-08-25] `ts-language-service-plugin` T-006 complete — **feature
  100% done, all 6 tasks.** Wired `resolve-locale.ts` + hover/completions/
  diagnostics into a real `index.ts` proxy over `info.languageService`.
  **Real packaging bug found by me (not a fork) reviewing the DEV's own
  report**, which flagged its own deviation from design.md's `export =
init`: package built ESM-only (`format: ["esm"]`, `module: "ESNext"`,
  `export default init`) — `tsserver` loads plugins via Node's
  synchronous `require()`, so a real tsserver process would either throw
  `ERR_REQUIRE_ESM` or hand back `{default: init}` instead of the
  callable `init`, silently breaking activation. Invisible to all 22 unit
  tests (they call `create()` in-process, never exercise real module
  loading). Fixed: `tsup.config.ts` → `format: ["cjs"]` +
  `outExtension: () => ({js: ".cjs"})` (tsup's default cjs extension is
  `.js`, needed explicit override); `src/index.ts` → `export = init`;
  `tsconfig.json` → `module: "CommonJS"`, `moduleResolution: "Node10"`;
  `package.json` → dropped `"type": "module"`, `main`/`types` point at
  `dist/index.cjs`/`dist/index.d.ts` (tsup's dts emission ignores the
  `outExtension.dts` override — matched `types` to actual output rather
  than fighting the tool). Verified with a real `require()` smoke test,
  not just unit tests: `require('./dist/index.cjs')` returns the callable
  `init` directly, `init({typescript:{}})` returns the `{create}` object
  tsserver expects. Gate: 22/22 pass, `tsc --noEmit`/`oxlint` clean.
  **`ts-language-service-plugin` fully shipped** — only `packages/vscode`
  (real extension, user confirmed not optional) remains from the v4 audit
  gaps. **This fix + spec updates not yet committed to git.**
- [2026-08-25] `ts-language-service-plugin` T-001..T-005 complete (prior
  session window) — test harness against REAL `node_modules/morphz`,
  `ast-utils.ts`/`resolve-field-info.ts`, `features/{hover,completions,
diagnostics}.ts` all built + tested (18/18), every wrapper confirmed to
  degrade to prior result on error/unrelated position via real negative
  tests, not assumed. 1 real bug fixed in `findNodeAtPosition` (range
  check missing inside `forEachChild` callback).
- [2026-08-25] `struct-type-inference` COMPLETE (both passes) — **CRITICAL
  FINDING fully resolved.** Pass 2 found 3 more real pre-existing type
  bugs: `FieldOf<T>`/`Union<T>` had disconnected `T` (plus a genuine TS
  variance subtlety in `Union` fixed via mapped-type per-index
  extraction), `Nullable`/`Optional`/`List`/`SetOf` broke for wrapped
  factories with non-`unknown` `Opts` (e.g. `Nullable(DateTime)`, the
  `DeletedAt` recipe) — fixed to `Define`'s `BaseTypeArg<T>` pattern.
  Gate: 254/254 pass, full type-level verification clean, `oxlint` clean.
  `morphz` consumers now get real field-level TS inference throughout.

**Full history** (v1 8 features, v2/v3 batches, v4 items #1/#2,
`struct-type-inference` Pass 1): see `STATE_ARCHIVE.md`.

## Todos

- [ ] **Immediate**: nothing from `release-pipeline` committed to git yet
      — review is done (this session), just needs the commit.
- [ ] User action needed (not mine to do): register the real VSCode
      Marketplace publisher ID + Open VSX namespace, then add
      `NPM_TOKEN`/`VSCE_PAT`/`OVSX_PAT` as GitHub repo secrets — only
      then swap placeholder publisher `leandroluk` for the real one in
      `packages/vscode/package.json` and push a `v*` tag to actually
      exercise `release-pipeline` end-to-end for the first time.
- [ ] Both new features from this session's batch (`vscode-extension`,
      `release-pipeline`) are code-complete — the v4 audit's remaining
      gaps (`packages/vscode` real extension, CI publish) are now closed.
      No large outstanding feature work identified — remaining Todos
      below are all small/deferred items.
- [ ] `npm run build` shows a harmless static esbuild warning about
      `import.meta` in the CJS output for `config.ts` — confirmed correct
      at runtime, not worth further chasing.
- [ ] Remaining low-priority open question per spec.md (description
      precedence between field-level/entity-level/Define-template on
      `struct-entities`) — never surfaced as a real issue, safe to leave.
- [ ] Not yet done: npm publish (package name `morphz` availability
      unconfirmed), README, CHANGELOG, CI config, `docs/` root (explicitly
      deferred per user request) — code-complete but not "released".
- [ ] `.specs/graph/` never built (was greenfield at spec time, real
      codebase now exists) — consider `graph-spec-design .` so future
      sessions' Rule #1 has something to use instead of Degraded Mode.
