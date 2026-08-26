# STATE Archive

Historical Decisions/Progress entries compacted out of `STATE.md` to keep it
under the 30 KB hot-state limit. Never auto-loaded — read on explicit request
only.

## Decisions (archived)

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

## Progress (archived — v1 through v3 batch + struct-type-inference Pass1 + v4 batch #1/#2)

- [2026-08-25] `struct-type-inference` Pass 1 (T-001/T-002) complete —
  **resolves the CRITICAL FINDING's core**: `Struct<Fields>(fields,
options): StructConstructor<InferShape<Fields>>`, polymorphic-`this`
  `parse`/`safeParse`/`mock`/`.extend()`, real `expectTypeOf` verification
  (not just "compiles") confirms `user.name` is genuinely typed `string`,
  subclass `.parse()` types as the subclass, `Embed`/`Ref` nested fields
  infer the target's real instance type. ZERO runtime behavior change —
  pure type-declaration retrofit, all 239 prior tests untouched.
- [2026-08-25] `recipes-package` + `config-gaps` (v4 batch) complete —
  v4 batch items #1/#2 done. `morphz/recipes` subpath ships all 15 §1
  recipes. Lazy `entityName` auto-derivation wired into `struct.ts`.
  `@deprecated` JSDoc tag wired. Fixed `.extend()` ignoring
  `parentMeta.templateDelimiter`. Gate: 239/239 pass.
- [2026-08-25] `property-interceptors` (v3 batch, last of v3) complete —
  `get`/`set` on `Define`, per-field Symbol backing slot, immutable-post-
  construction guard. Gate: 219/219 pass.
- [2026-08-25] `additional-primitives` Pass 2 (v3 batch) complete: Url,
  Json, Record, Binary, Tuple, SetOf — all 15 §15 primitives shipped.
  Gate: 208/208 pass.
- [2026-08-25] `additional-primitives` Pass 1 QA complete — 4 real bugs
  found in shared `mock.ts` (codec/preprocess confusion, wire vs domain
  input, missing regex on BigInt/Decimal, decimal.js scientific notation).
  Gate: 183/183 pass.
- [2026-08-25] `additional-primitives` Pass 1 (v3 batch) complete: Boolean,
  BigInt, Decimal, DateOnly/TimeOnly, Duration, Ulid, Nanoid, Cuid2. Gate:
  177/177 pass.
- [2026-08-25] `debug-observability` (v3 batch) complete — `debug.ts` (5
  loggers) wired into core files. Gate: 142/142 pass.
- [2026-08-25] `INSIGHT.md` grew §15-17 (v3 batch) specified. `Decimal`
  uses `decimal.js`; `DateOnly`/`TimeOnly` get `PlainDate`/`PlainTime`
  wrapper classes; `property-interceptors`'s `set()` throws on
  post-first-assignment `immutable` writes. Fixed `pnpm-workspace.yaml`.
- [2026-08-25] `jsdoc-generation` (v2 batch) complete. Fixed 2 Windows
  `file://` URL bugs. Gate: 137/137 pass. **CRITICAL FINDING flagged**:
  `Struct()` not generic, zero consumer TS field inference (later fully
  resolved by `struct-type-inference`).
- [2026-08-25] `mock-fixtures` (v2 batch) complete. `.mock()`/`.mockMany()`
  synthesis priority chain, cycle guard for circular `Ref`. Gate: 121/121.
- [2026-08-25] `data-masking` (v2 batch) complete. `meta.mask`,
  `toMaskedJSON()`. Gate: 106/106 pass.
- [2026-08-25] `monorepo-architecture` (v2 batch) complete — pnpm+Turborepo
  restructure, `packages/{core,ts-plugin,vscode}`. Gate: 99/99 pass.
- [2026-08-25] Post-completion fix: `discoverConfig()`'s
  `createJiti(import.meta.url)` broke CJS build — fixed with
  `typeof __filename !== "undefined"` guard.
- [2026-08-25] `project-config` T-001..T-003 complete — last of the
  original 8 features. Gate: 99/99 pass. **All 8 v1 features shipped.**
- [2026-08-25] `class-extensibility` T-001..T-003 complete.
  `buildStructClass()` extracted as shared builder. Gate: 90/90 pass.
- [2026-08-25] `lifecycle-serialization` T-001..T-003 complete.
  `ValidationError`, `parse`/`safeParse`, `.toJSON()`. Gate: 80/80 pass.
- [2026-08-25] `i18n-error-messages` T-001..T-003 complete. Gate: 70/70.
- [2026-08-25] `entity-relationships` T-001..T-004 complete. `Literal`,
  `Ref`, `FieldOf`, `Union`. Gate: 57/57 pass. oxlint/oxfmt added.
- [2026-08-25] `struct-entities` T-001..T-004 complete. `STRUCT_META`,
  template resolver, `Struct()`, `Embed()`. Gate: 47/47 pass.
- [2026-08-25] `datetime-codec` T-001, T-002 complete. Gate: 32/32 pass.
- [2026-08-25] `define-metatypes` T-001..T-006 complete — the foundation.
  25/25 pass, fixed real zod v4 `.refine()` error-shape bug.
