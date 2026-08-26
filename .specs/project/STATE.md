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

## Progress (recent — older entries in STATE_ARCHIVE.md)

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

- [ ] **Immediate**: `git add -A && git commit` the ts-plugin ESM→CJS
      packaging fix + updated `tasks.md`/`STATE.md` — nothing from this
      session's last work is committed yet.
- [ ] `packages/vscode` — build a REAL extension (user confirmed not
      optional, wants Tailwind-CSS-IntelliSense style). Not yet specced —
      needs its own Design phase (Context7 against VSCode extension API).
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
