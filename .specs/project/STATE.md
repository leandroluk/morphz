## Degraded Mode

- graphify not run — greenfield repo (only `INSIGHT.md` existed, no source
  code, not yet a git repository). Graph build deferred until source exists.
- Token budget: load only the active feature's spec.md + this STATE.md per
  session until code/graph exist.

## Decisions

- [2026-08-25] 8 features specified from `INSIGHT.md`, no graph-guided
  discovery (nothing to discover yet): `define-metatypes`, `datetime-codec`,
  `struct-entities`, `entity-relationships`, `i18n-error-messages`,
  `lifecycle-serialization`, `class-extensibility`, `project-config`.
  REQ count: 6-9 per feature. Build order recorded in
  `.specs/project/ROADMAP.md`.
- [2026-08-25] Split by INSIGHT.md section rather than one monolithic spec —
  each feature has independent, non-trivial open questions that would
  otherwise block the whole Design phase at once.

- [2026-08-25] Resolved: `Timestamp` = `DateTime` + `default: () => new
Date()`. Resolved: `immutable` = write-once-at-creation, enforced by
  rejecting (not dropping) any presence of the field in input on
  `.omit()`/`.pick()`/`.partial()`-derived classes. Updated
  `datetime-codec`, `define-metatypes`, `class-extensibility` spec.md.
- [2026-08-25] Resolved: `morphz.config.ts` loading = lazy sync
  auto-discovery on first config-needing call (default) + optional
  `morphz/register` side-effect module for eager load. `.ts` config parsed
  via `jiti` sync (hard dependency, not peer). Single process-wide
  singleton. Updated `project-config` spec.md REQ-005.
- [2026-08-25] Resolved: `.extend()` field redeclaration = silent override
  (not the mixin-collision problem — single parent, unambiguous). Resolved:
  `Union` mixed members = mirrors Zod's own `discriminatedUnion`
  applicability rule exactly (no `morphz`-specific heuristic). Resolved:
  `message`/i18n `(path, code)` matcher = exact match only, no per-field-type
  special-casing (List item paths behave like FromZodType composite paths).
  Guiding principle confirmed by user: `morphz` = Zod + OO/class-based
  type-safety layer — never invents behavior Zod itself wouldn't produce.
  Updated `class-extensibility`, `entity-relationships`,
  `i18n-error-messages` spec.md.

- [2026-08-25] Design complete for `define-metatypes`. Core shape:
  `FieldDescriptor` (Zod schema + meta). `Define()` normalizes BaseType via
  one rule (call if function, else use as-is) covering every INSIGHT.md §1
  example. Verified via Context7 (`/colinhacks/zod` v4.0.1): `.refine()`
  clones-and-appends (safe to chain), and corrected the real issue-code
  taxonomy — `regex` isn't a code, it's `invalid_format` + `format` sub-key
  (fixed in `i18n-error-messages` spec too). No God Nodes/graph — greenfield,
  every component here is net-new.

- [2026-08-25] Design complete for `struct-entities`. Pipeline:
  `pre → z.object(fields) → post → .transform(instantiate)`, built once at
  `Struct()` call time. `FieldDescriptor` shape from `define-metatypes`
  confirmed to fit unchanged — no revision needed. New symbol-keyed
  `STRUCT_META` registry flagged as this codebase's future God Node (read by
  `entity-relationships`, `class-extensibility`, `lifecycle-serialization`).
  **Correction to spec.md**: labels do NOT cascade into `Embed`/`Ref`
  targets (each `Struct` call is an independent template scope); embedded
  `Struct`s keep their own `pre`/`post`, never inherit the parent's.

- [2026-08-25] Design complete for `entity-relationships`. `Ref` = `z.lazy()`
  over `STRUCT_META.schema` (self-reference confirmed safe). `FieldOf` =
  eager clone of source's FULL descriptor minus `default`/`immutable`,
  merged with own `options` via `define-metatypes`'s `mergeDescriptor`.
  `Union` = structural check on `STRUCT_META.rawObjectSchema` (pre-
  transform) for a shared literal-valued key across all members; found →
  explicit-key `z.discriminatedUnion`, else → plain `z.union` — confirmed
  this single rule also resolves the mixed-member case with no special
  logic. `STRUCT_META` reconfirmed as cross-feature God Node (3 of its 4
  fields now load-bearing here too).

- [2026-08-25] Design complete for `i18n-error-messages`.
  `resolveIssueMessages()` recurses `STRUCT_META.fields` per path segment,
  descending into `Embed`/`Ref` targets (own `STRUCT_META`) but stopping at
  `List` items / `FromZodType` internals (no structural knowledge there).
  **Correction to earlier session note**: "List/Embed/FromZodType all
  behave identically" was wrong — `Embed`/`Ref` DO resolve recursively,
  only `List` items and `FromZodType` internals fall back to raw Zod.
  Locale resolution: `AsyncLocalStorage → config.locale.default →
'en-US'` hard fallback. **Follow-up applied**: `Embed()`/`Ref()`
  descriptors now also carry `targetStruct` (thunk to the pointed-at
  `Struct` class) — small additive edit made to already-completed
  `struct-entities/design.md` and `entity-relationships/design.md`.

- [2026-08-25] Design complete for `lifecycle-serialization`. **Important
  correction applied retroactively to `struct-entities/design.md` and
  `entity-relationships/design.md`**: `STRUCT_META.schema` must NOT bake in
  a final instantiation `.transform()` — it was built before any subclass
  exists, so it could only ever construct the base class, breaking
  `class-extensibility`'s `admin instanceof AdminUser` promise. Fix:
  `STRUCT_META.schema` is validation-only; `.parse()`/`.safeParse()` use
  `new.target`/`this` for polymorphic instantiation; `Embed()`/`Ref()` each
  append their OWN `.transform(data => new ConcreteClass(data))` since they
  always know their concrete target. `safeParse()` avoids double-validation
  via `Object.create(this.prototype)` internally (not a public API). Public
  constructor always validates (`.parse()` = `new this(input)`, no trusted
  fast-path). Resolved: `writeOnly` lives on `FieldDescriptor.meta`
  (`define-metatypes`). Three small additive follow-ups landed on
  `define-metatypes/design.md`'s `FieldDescriptor`: `meta.writeOnly`,
  `meta.encode` (owed by not-yet-designed `datetime-codec`),
  `itemDescriptor` (for `List`).

- [2026-08-25] Design complete for `datetime-codec`. `DateTime` = bare
  `z.iso.datetime()` (strict UTC `Z`-only, confirmed via Context7 — no
  `offset`/`local` options) codec to `z.date()`; sets `meta.encode` directly,
  closing that follow-up owed to `lifecycle-serialization`. `Timestamp` =
  `Define(DateTime, { default: () => new Date() })`, one line. No open
  questions remain on this feature.

- [2026-08-25] Design complete for `class-extensibility`. Key finding:
  `.extend()` uses REAL JS `class extends` (parent subclassing —
  `instanceof` holds transitively through the whole chain);
  `.omit()`/`.pick()`/`.partial()` build a fully INDEPENDENT class instead
  (no `instanceof` source — a `CreatePostDto` missing `id` isn't
  semantically a `Post`). `immutable` enforcement uses
  `z.undefined().optional()` patched onto derived variants (native Zod
  rejection, no custom refine). `.omit()`/`.pick()` support both variadic
  and single-array-argument forms. **Follow-up applied**: `STRUCT_META`
  gained a `hooks: { pre?, post? }` field (small additive edit to
  `struct-entities/design.md`) so derived classes can re-wrap with the
  same hooks.

- [2026-08-25] Design complete for `project-config` — the 8th and final
  feature. `getConfig()` singleton + `discoverConfig()` (cosmiconfig-style
  sync search, `jiti` for all config extensions) + inert `defineConfig()` +
  `morphz/register` eager-populate side effect. No new follow-ups onto any
  other feature — confirmed final. **All 8 features now have both spec.md
  AND design.md complete.**

- [2026-08-25] Tasks phase done for all 8 features — `tasks.md` written per
  feature (PO). Tooling decided (Execute phase, no INSIGHT.md guidance):
  npm, TypeScript 5.6, `tsup` (build), `vitest` (test), `zod` v4.4.3 +
  `jiti` v2 installed. `git init` done — repo now tracked.
- [2026-08-25] User grew `INSIGHT.md` with §9-14 (v2 batch): jsdoc config
  flag, JSDoc `.d.ts` generation, TS Language Service Plugin, mock/fixture
  generation, data masking/LGPD, monorepo restructure (pnpm + Turborepo).
  Specified as 6 new features under `.specs/features/`:
  `monorepo-architecture`, `config-jsdoc-flag`, `data-masking`,
  `mock-fixtures`, `jsdoc-generation`, `ts-language-service-plugin` — build
  order recorded in `ROADMAP.md`'s new "v2 batch" section.
  `monorepo-architecture` resolved two real open questions itself (pnpm
  migration confirmed per INSIGHT.md's explicit wording; `ts-plugin`
  distributes as a subpath export bundled into `core`'s dist, not a
  separately-published package, reconciling INSIGHT.md's "either/or"
  wording with its own "zero-friction" recommendation).
  `ts-language-service-plugin` flagged as needing its own dedicated Design
  pass (Context7 against the `typescript` LS plugin API) before Execute —
  by far the largest, most novel item in the batch. `docs/` root directory
  explicitly deferred per user request, no spec/placeholder created yet.

## Progress

- [2026-08-25] `additional-primitives` Pass 1 QA (integration coverage)
  complete: `.mock()`/`.toJSON()`/round-trip tested against a real
  multi-primitive `Struct`. **4 more real bugs found in shared `mock.ts`**
  (affects every feature declaring codec-based `examples`/`default`, not
  just this one) — see `tasks.md` for full detail: (1) `mock.ts`'s pipe
  handling confused real `z.codec` with `z.preprocess` (`Boolean` uses
  the latter); (2) `mock.ts` fed DOMAIN-typed `meta.examples`/`meta.default`
  straight in as raw WIRE input, breaking `BigInt`/`Decimal`/`DateOnly`/
  `TimeOnly`/`Duration`/v1's `Timestamp` — now applies `meta.encode`
  first; (3) `BigInt`/`Decimal` switched `refine`→`.regex()` so the mock
  synthesizer has a pattern to generate from; (4) `decimal.js`'s
  scientific-notation `.toString()` default broke round-trip for large
  synthesized values — isolated `Decimal.clone()` override fixes it
  without affecting other consumers. Gate: 183/183 pass (cumulative).
- [2026-08-25] `additional-primitives` Pass 1 (v3 batch) complete: Boolean,
  BigInt, Decimal, DateOnly/TimeOnly (+ `PlainDate`/`PlainTime` wrapper
  classes), Duration, Ulid, Nanoid, Cuid2. New deps: `decimal.js`, `ulid`,
  `@paralleldrive/cuid2`, `nanoid`, `ms`. 2 real bugs found+fixed: `z.codec`
  decode doesn't catch thrown exceptions (verified empirically — breaks
  `safeParse`'s never-throws contract) — `BigInt`'s native `BigInt(str)`
  now caught and converted to a proper issue. `PlainDate.addMonths`
  produced invalid dates on day-overflow (e.g. "Feb 31") — fixed via
  `Date.UTC`'s own rollover, matching `addDays`. `Boolean` deliberately
  does NOT use `z.coerce.boolean()` (that's raw JS truthiness — `"false"`
  would coerce to `true`) — hand-rolled string-value mapping instead.
  Gate: 177/177 pass (cumulative), `tsc`/`lint` clean. Pass 2 (Url, Json,
  Record, Binary, Tuple, SetOf) still pending.
- [2026-08-25] `debug-observability` (v3 batch) complete. `debug.ts` (5
  loggers: `logStruct`/`logParse`/`logCodec`/`logI18n`/`logLifecycle`)
  wired into `struct.ts`, `template.ts`, `resolve-locale.ts`,
  `resolve-issues.ts`, `date-time.ts`. First feature to modify several
  already-shipped files as its PRIMARY deliverable (not just new files).
  Confirmed zero-overhead when `DEBUG` unset via both a real manual smoke
  test (built package) and automated enable/disable tests. New deps:
  `debug`, `@types/debug`. Gate: 142/142 pass (cumulative), `tsc`/`lint`
  clean. Next in recommended order: `additional-primitives`.
- [2026-08-25] `INSIGHT.md` grew further while v2 was in progress — §15-17
  (v3 batch): `additional-primitives`, `property-interceptors`,
  `debug-observability` specified. Resolved with user: `Decimal` uses
  `decimal.js` (precision/robustness prioritized over lighter
  alternatives); `DateOnly`/`TimeOnly` get custom lightweight
  `PlainDate`/`PlainTime` wrapper classes (not bare string, not a full
  `Temporal` polyfill); `property-interceptors`'s `set()` throws on an
  `immutable` field after first assignment (write-once holds through
  direct mutation, not just `.parse()`). Fixed `pnpm-workspace.yaml`
  (removed a stray placeholder, added `lefthook` to
  `onlyBuiltDependencies` alongside `esbuild` — user is concurrently
  setting up `lefthook`/`commitlint`/GitHub workflows, pre-commit hook now
  runs format/lint/typecheck, commit-msg runs `commitlint`). Recommended
  order: `debug-observability` → `additional-primitives` →
  `property-interceptors` (increasing risk).
- [2026-08-25] `jsdoc-generation` (v2 batch) complete. `extractFieldConstraints`
  (`_zod.def` introspection, unwraps `optional`/`nullable`/`pipe`/
  `default`/`prefault`), `sanitizeExample`, `buildFieldTags`, `applyJsDoc`
  (gated on `getConfig().jsdoc`, dynamic-imports the built JS, patches
  `.d.ts` via `ts-morph`). Fixed 2 Windows `file://` URL bugs. Gate:
  137/137 pass (cumulative), `tsc`/`lint` clean.

  **CRITICAL FINDING — flagged to user, NOT fixed yet**: `Struct()`'s
  return type (`StructConstructor`) is not generic over `fields` —
  constructor is `new (input: unknown): object`. NO field-level TS type
  inference reaches any `morphz` consumer today (`user.name` isn't a
  recognized property on `class User extends Struct({name: Text()}, ...)
{}`). Undermines the "type-safe classes" core value prop. Never caught
  because `tsconfig.json` only includes `src/` (tests untypechecked) and
  every test so far only asserts runtime behavior. This is a large,
  cross-cutting retrofit (`Struct`/`Define`/every primitive need proper
  generics + mapped-type field inference, similar to Zod's own
  `z.object()`) — needs its own dedicated feature, scope/priority to be
  decided by the user, not assumed. `jsdoc-generation`'s own integration
  test worked around it with a hand-written `.d.ts` fixture (still
  correctly validates `applyJsDoc`'s own mechanism).

- [2026-08-25] `mock-fixtures` (v2 batch) complete. `.mock()`/
  `.mockMany()` on every `Struct`-produced class. Synthesis priority:
  overrides → examples → default → `Embed`/`Ref` recursive → `List` via
  itemDescriptor → primitive introspection (canonical format values,
  `randexp` for regex-only fields, min/max-bounded numbers). New
  dependency: `randexp` (packages/core). Cycle guard for circular `Ref`
  chains: `Optional` resolves to `undefined`, required throws a clear
  error — confirmed via a real mutual-reference test, no stack overflow.
  `immutable` fields synthesize normally (mock = creation). Gate: 121/121
  pass (cumulative), `tsc`/`lint` clean.
- [2026-08-25] `data-masking` (v2 batch) complete. `meta.mask` on
  `FieldDescriptor`, `toMaskedJSON()` (mirrors `to-json.ts`'s traversal,
  applies `mask` before `encode`, recurses via child's own
  `.toMaskedJSON()` for `Embed`/`Ref`, masks `List` items individually,
  `writeOnly` still omitted, `.toJSON()` unaffected). Gate: 106/106 pass
  (cumulative), `tsc`/`lint` clean.
- [2026-08-25] `monorepo-architecture` (v2 batch, T-001..T-003) complete —
  repo restructured into pnpm+Turborepo. `packages/core` (history
  preserved via `git mv`), `packages/ts-plugin` (typed stub scaffold),
  `packages/vscode` (manifest placeholder). npm→pnpm switch clean. Gate
  personally re-verified by coordinator (not just trusted from the DEV
  fork's report): 99/99 tests, typecheck clean across all 3 packages,
  root `oxlint` clean, build clean. 1 commit
  (`feat: restructure into pnpm+Turborepo monorepo (INSIGHT.md §14)`).
- [2026-08-25] Post-completion fix: `discoverConfig()`'s
  `createJiti(import.meta.url)` broke the CJS build (esbuild empties
  `import.meta.url` for that output format — a real bug, not cosmetic,
  since `require('morphz')` consumers would get broken config discovery).
  Fixed with a `typeof __filename !== "undefined"` guard, falling back to
  `import.meta.url` for ESM. Verified with a REAL `dist/index.cjs`
  `require()` + a real `morphz.config.cjs` fixture (discovery works), and
  the ESM + `.ts` config path too. `npm run build` still emits a static
  esbuild warning (it can't prove the CJS branch is dead code) — harmless,
  confirmed at runtime.
- [2026-08-25] `project-config` T-001..T-003 complete — **the last of the
  8 features.** `discoverConfig()`/`getConfig()`/`defineConfig()`/
  `morphz/register` all implemented. `i18n-error-messages`'s locale reader
  already defaulted to reading `getConfig()` directly (import, not the
  injectable hook) when that feature was built — confirmed sufficient,
  no further wiring needed. (A follow-up attempt to ALSO call
  `setConfigLocaleReader()` from `config.ts` was tried and reverted — real
  circular import between `config.ts`/`resolve-locale.ts`, broke module
  init under Vitest; the existing direct-import wiring was already
  correct.) Gate: 99/99 pass (cumulative), `tsc`/`lint` clean.
  **All 8 features of morphz now implemented, tested, and committed.**
- [2026-08-25] `class-extensibility` T-001..T-003 complete. `struct.ts`
  refactored: `buildStructClass()` extracted as the shared internal
  builder (optional `extendsClass`), `Struct()` now a thin wrapper over it.
  `.extend()` = real `class extends` — constructor/`parse`/`safeParse`/
  `toJSON` all inherited and stay polymorphic for free (already used
  `new.target`/`this` internally, no extra code needed for this to work).
  `.omit()`/`.pick()`/`.partial()` = independent class via the same
  builder with no `extendsClass`. All four methods attached to every
  generated class, chainable across the whole family. QA found and fixed a
  real bug: `.extend()` wasn't applying `meta.default` to new fields.
  Gate: 90/90 pass (cumulative), `tsc`/`lint` clean.
- [2026-08-25] `lifecycle-serialization` T-001..T-003 complete.
  `ValidationError`, constructor (now catches `z.ZodError` and re-throws
  `ValidationError` with i18n-resolved `.issues`), `static parse`/
  `safeParse` (safeParse bypasses the constructor entirely — validates via
  `schema.safeParse` then `Object.create(this.prototype)` — confirmed no
  double-validation via a pre-hook side-effect counter), `.toJSON()`
  (writeOnly masking, `Embed`/`Ref` recursion, codec `encode`, `List` via
  `itemDescriptor`) all implemented + tested. One prior test (i18n
  feature's `resolve-issues.test.ts`) adjusted for the new contract
  (constructor throws `ValidationError` now, not raw `ZodError`) — expected
  breaking change from this feature, not a regression. Gate: 80/80 pass
  (cumulative), `tsc`/`lint` clean.
- [2026-08-25] `i18n-error-messages` T-001..T-003 complete.
  `resolveLocale`, `lookupMessage`, `descendPath`/`resolveIssueMessages`
  all implemented + tested. `project-config` dependency (not yet built) is
  an injectable hook (`setConfigLocaleReader`), not a direct import —
  avoids forward coupling. Confirmed end-to-end: custom `message` overrides
  apply on parse failure; `Embed` recursion applies the CHILD's own
  registered override; `List` item paths correctly stop at the raw Zod
  message even when the item type itself has an override (design.md's
  "field as a unit, never per-item" rule holds). Gate: 70/70 pass
  (cumulative), `tsc`/`lint` clean.
- [2026-08-25] `entity-relationships` T-001..T-004 complete. `Literal`,
  `Ref` (`z.lazy` + self-reference confirmed), `FieldOf` (clones full
  descriptor minus `default`/`immutable`, throws sync on bad field name),
  `Union` all implemented + tested. **Refinement over design.md**: `Union`'s
  discriminator detection reads `member.targetStruct?.()[STRUCT_META]
.rawObjectSchema` for `Embed`/`Ref` members (their `zodSchema` is a
  `.transform()`-wrapped pipe, not a plain `ZodObject`) — but still builds
  the final `z.discriminatedUnion()` from the ORIGINAL `zodSchema`s
  (transform included), confirmed via real zod v4 internals (`$ZodPipe`
  propagates `propValues` from its `in` side). Real `Struct` instances
  come out of a discriminated `Union` of `Embed`/`Ref` members. Gate:
  57/57 pass (cumulative), `tsc`/`lint` clean. Tooling added (oxlint/oxfmt)
  and whole repo formatted in the same window.
- [2026-08-25] `struct-entities` T-001..T-004 complete. `STRUCT_META`,
  template resolver, `Struct()` (pipeline `pre→z.object→post`, no baked
  transform, `new.target`-based constructor, `meta.default` applied via
  zod's own `.default()` at assembly time), `Embed()` all implemented.
  Gate: 47/47 pass (cumulative), `tsc --noEmit` clean. This is the
  cross-feature God Node — confirmed working: polymorphic `new.target`
  through pure JS subclass inheritance (no re-`Struct()` needed), `Embed`
  error cascade into parent parse.
- [2026-08-25] `datetime-codec` T-001, T-002 complete. `src/primitives/
{date-time,timestamp}.ts`. QA note (design nuance, not a bug):
  `meta.default` is metadata-only — `struct-entities`'s field assembly is
  responsible for applying it to the built `z.object()`, not the primitive
  itself. DEV also fixed a real type-variance bug in `define-metatypes`'s
  `src/core/define.ts` (`BaseTypeArg`'s bare-factory case needed `() =>
FieldDescriptor<T>`, not `FieldDescriptorFactory<T, unknown>` — TS strict
  contravariance). Gate: 32/32 pass (cumulative), `tsc --noEmit` clean.
- [2026-08-25] `define-metatypes` T-001..T-006 complete. DEV wrote
  `src/core/{field-descriptor,merge-descriptor,refine-adapter,define,
from-zod-type}.ts` + `src/primitives/{text,number,uuid,email,password,ip,
enum,version,nullable,optional,list}.ts` + `src/index.ts`. QA wrote
  `tests/define-metatypes/*.test.ts`, 25/25 pass, `tsc --noEmit` clean, and
  fixed a real bug in the refine-to-Zod adapter (zod v4's actual `.refine()`
  params shape is `{ error: (issue) => string }`, receiving the issue not
  the raw value — v3-era docs would've shipped broken custom messages).
  Gate: 25/25 pass. Not yet committed (pending: `datetime-codec` next, will
  commit both together or separately depending on how it goes).

## Todos

- [ ] `npm run build` still shows a harmless static esbuild warning about
      `import.meta` in the CJS output for `config.ts` — confirmed correct
      at runtime (see Progress entry above), not worth further chasing.
- [ ] Remaining low-priority open question per spec.md (description
      precedence between field-level/entity-level/Define-template on
      `struct-entities`) — never surfaced as a real issue during
      implementation, safe to leave as a documentation-only gap.
- [ ] Not yet done: npm publish (package name `morphz` availability
      unconfirmed), README, CHANGELOG, CI config — v1 is code-complete
      (8/8 features, 99 tests, build/lint/typecheck all clean) but not yet
      packaged for release.
- [ ] `.specs/graph/` was never built (greenfield → code now exists) —
      consider running `graph-spec-design .` to build the graph now that
      there's a real codebase, so future sessions' Rule #1 has something
      to use instead of Degraded Mode.
