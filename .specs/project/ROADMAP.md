# Roadmap: morphz

Greenfield library. No graph exists yet (no source code committed) — specs
below are derived directly from `INSIGHT.md` instead of graph-guided discovery.

## Feature breakdown (in build order — later features depend on earlier ones)

1. **define-metatypes** — `Define()`, template interpolation (`#entityName`),
   core primitives (`Struct`, `Uuid`, `Text`, `Number`, `Email`, `Ip`, ...),
   `FromZodType`. Foundation everything else builds on.
2. **datetime-codec** — `DateTime`/`Timestamp` as `z.codec`, not `z.date()`.
   Independent of Struct but required before any entity uses date fields.
3. **struct-entities** — `Struct(fields, options)`, label propagation,
   `pre`/`post` hooks, `Embed` (value objects).
4. **entity-relationships** — `Ref` (lazy entity reference) vs `FieldOf`
   (field-type reuse), `Union`/`Literal` discriminated-union resolution.
5. **i18n-error-messages** — `message` override on `Define`, locale
   resolution, `(path, code)` issue-tree walking, `FromZodType` compatibility.
6. **lifecycle-serialization** — `.parse()`/`.safeParse()`/`new`, real class
   instances, `.toJSON()` with `writeOnly` masking.
7. **class-extensibility** — `.extend()`, `.omit()`, `.pick()`, `.partial()`,
   polymorphism (`instanceof` across extension chain).
8. **project-config** — `morphz.config.ts` / `defineConfig()`, global label
   defaults, template delimiter config.

## v2 batch — INSIGHT.md §9-14 (2026-08-25)

v1 (features 1-8 above) is code-complete: 99/99 tests, build/lint/typecheck
clean, all committed. `INSIGHT.md` grew 6 new sections (§9-14) — new
features, build order below (each depends on `monorepo-architecture` for
its package location; deeper deps noted per item):

9. **monorepo-architecture** — restructures repo into pnpm workspaces +
   Turborepo (`packages/core` = current package unchanged, `packages/
ts-plugin` + `packages/vscode` = new empty scaffolds). PREREQUISITE for
   `ts-language-service-plugin`; everything else just needs to land inside
   `packages/core` post-move. Also switches `npm` → `pnpm` (INSIGHT.md is
   explicit about this).
10. **config-jsdoc-flag** — tiny: `MorphzConfig.jsdoc?: boolean`. Split
    from `jsdoc-generation` so the config surface can land independently.
11. **data-masking** — `mask` on `FieldDescriptor.meta` +
    `.toMaskedJSON()`, directly parallels `.toJSON()`'s existing traversal.
    Small, mechanical, no new external dependency.
12. **mock-fixtures** — `.mock()`/`.mockMany()`. Self-contained within
    `packages/core`, no monorepo cross-package dependency.
13. **jsdoc-generation** — build-time `.d.ts` JSDoc injection from
    `STRUCT_META` metadata. Real engineering (AST/declaration rewriting).
14. **ts-language-service-plugin** — LAST, by far the largest/most novel
    item (a real `tsserver` plugin). Recommend treating as its own
    multi-session effort, not a single DEV/QA fork pass like the rest.

v2 batch progress (2026-08-25): 5/6 done (`monorepo-architecture`,
`config-jsdoc-flag`, `data-masking`, `mock-fixtures`, `jsdoc-generation`).
`ts-language-service-plugin` deliberately paused (too large for a single
DEV/QA pass) — `jsdoc-generation`'s DEV found a CRITICAL cross-cutting gap
along the way: `Struct()` isn't generic over `fields`, so no `morphz`
consumer gets ANY field-level TS type inference today. Flagged to user,
not yet scheduled as its own feature — see `STATE.md`.

`docs/` root directory: explicitly deferred per user request ("no futuro
incluir") — noted here as a planned future addition, no feature spec
written, no placeholder created. Revisit once there's real content
(generated API docs? hand-written guides?) to decide its actual shape.

## v3 batch — INSIGHT.md §15-17 (2026-08-25)

`INSIGHT.md` grew further while v2 was in progress — 3 more features,
independent of each other (build order below is a recommendation, not a
hard dependency chain):

15. **additional-primitives** — 15 new core primitives across 5 groups
    (fundamental scalars, specialized dates, modern IDs, web, flexible/
    binary structures). Mechanical (`FieldDescriptorFactory` pattern
    already established) but real new dependencies: `decimal.js`
    (resolved — precision/robustness over lighter alternatives), `ulid`,
    `@paralleldrive/cuid2`, `nanoid` (finally shipped for real, previously
    only a documented v1 recipe). `DateOnly`/`TimeOnly` get custom
    lightweight `PlainDate`/`PlainTime` wrapper classes (resolved — not a
    bare string, not a full `Temporal` polyfill).
16. **property-interceptors** — `get`/`set` accessors on `Define` (wire ↔
    domain value separation, e.g. MongoDB `ObjectId`). Cross-cuts already-
    shipped `struct-entities`/`lifecycle-serialization` internals
    (`to-json.ts`/`to-masked-json.ts` must read the wire slot, not trigger
    the `get` accessor). Resolved: `set()` throws on an `immutable`
    field after first assignment — write-once holds through direct
    mutation too, not just `.parse()`.
17. **debug-observability** — `DEBUG=morphz:*` namespaced logging (the
    `debug` npm package, 5 namespaces). Recommend doing this FIRST among
    the three — lowest risk, purely additive log calls sprinkled through
    already-shipped files, good low-stakes practice for touching shared
    internals before `property-interceptors`'s riskier `to-json.ts` change.

Recommended execution order: `debug-observability` → `additional-
primitives` → `property-interceptors` (increasing risk/invasiveness).

v3 batch: 100% complete (2026-08-25). All 3 shipped, 219/219 tests.

## v4 batch — INSIGHT.md coverage audit gaps (2026-08-25)

User asked "what's missing to fully satisfy INSIGHT.md" — audited the
real `src/index.ts`/`struct.ts`/`config.ts` against every section (not
guessed). Found 5 real gaps:

1. **`recipes-package`** (`morphz/recipes` subpath) — §1's `PrimaryKey`/
   `CreatedAt`/`Cep`/etc. recipes never shipped. **Correction made during
   this audit**: these are NOT actually required by INSIGHT.md's own
   import block (§1's recipes are demonstrated as userland code the
   consumer writes with `Define`, not a `morphz` export) — resolved with
   user to ship anyway as an opt-in convenience subpath, not because
   INSIGHT.md strictly requires it.
2. **`config-gaps`** — `labels.entityName` auto-derivation (`project-
config` REQ-002) is typed but never wired into `struct.ts`; `deprecated`
   → `@deprecated` JSDoc tag (§10's table) never implemented. Resolved a
   real timing problem for the first one: `Struct()` resolves templates
   EAGERLY, before a `class X extends Struct(...) {}` subclass's name
   exists — fix is LAZY resolution on first construction (`new.target
.name` is guaranteed available by then), memoized once, only for
   Structs that omit `labels.entityName` explicitly (zero cost for the
   common case).
3. **`ts-language-service-plugin`** (still pending from v2, not started —
   only a no-op stub exists in `packages/ts-plugin`).
4. **`packages/vscode`** — user explicitly said this is NOT optional
   (despite INSIGHT.md marking it "(Opcional)") — wants a real extension,
   Tailwind-CSS-IntelliSense-style. Paired with #3 (the extension wraps/
   packages the `tsserver` plugin) — not started yet, noted as committed
   future scope, not attempted in this batch.
5. **CRITICAL FINDING** (carried over, still open) — `Struct()` not
   generic over fields, zero consumer-side TS inference. Not literally an
   `INSIGHT.md` numbered item but implicitly assumed by nearly every code
   example in the doc.

This batch tackles #1 and #2 (small/medium, both resolved and ready for
Execute). #3/#4 (the real TS tooling) and #5 (generics retrofit) remain
explicitly deferred — large, separate efforts, user to prioritize
separately.

## Resolved decisions

- `Timestamp` = `DateTime` + `default: () => new Date()` baked in. Same
  wire/domain codec, just a `define-metatypes` recipe over `DateTime`.
- `immutable: true` = write-once-at-creation. Base `Struct.parse()`/`new`
  always accepts a value (or its `default`) for the field. Any class derived
  via `.omit()`/`.pick()`/`.partial()` (update/patch DTOs) that still
  retains the field REJECTS with a `ValidationError` if the field is present
  in the input — never silently dropped.
- `morphz.config.ts` loading = two-layer: lazy sync auto-discovery on first
  config-needing API call (default, cosmiconfig-style upward search,
  `.ts` via `jiti` sync) + optional `morphz/register` side-effect import for
  eager/deterministic load. Single process-wide singleton, no per-scope
  config. Rejected: piggybacking on `tsconfig.json`'s `"ts-node"` field —
  not a real config-loading mechanism, no precedent for it.
- `.extend()` field redeclaration = silent override (child wins), same as
  standard single-parent OOP field override. NOT the same problem as
  INSIGHT.md's mixin-collision warning (that's about sibling mixins with no
  hierarchy to resolve precedence — `.extend()` has exactly one parent).
- `Union` mixed members = mirrors Zod's OWN `discriminatedUnion`
  applicability rule, not a `morphz` heuristic. All members `Struct`
  (object) + shared literal discriminator key → discriminated; anything
  that doesn't structurally qualify (bare `Literal`, missing key, etc.) →
  plain `z.union`, same call Zod itself would make. Reflects the guiding
  principle: `morphz` = Zod + OO/class type-safety layer, never invents
  behavior Zod wouldn't already produce for the same schema shape.
- `message`/i18n override matcher = exact `(path, code[, format])` per
  field, but RECURSES through `Embed`/`Ref` targets (own `STRUCT_META`,
  their own registered messages apply) — only stops at `List` items /
  `FromZodType` internals, where `morphz` genuinely has no structural
  knowledge. _(Refined during `i18n-error-messages` design — supersedes an
  earlier, too-broad version of this note.)_

## Design phase — complete (2026-08-25)

All 8 features have `spec.md` + `design.md`. Headline architectural
decisions that cut across multiple features:

- One uniform `FieldDescriptor` shape (Zod schema + `meta`) flows through
  every primitive, `Define`, `Struct` field, `Embed`, `Ref`, `FieldOf`.
- `STRUCT_META` (symbol-keyed, per-class registry: `fields`,
  `rawObjectSchema`, `schema`, `hooks`, `labels`, `description`) is the
  cross-feature contract — effectively this codebase's God Node once code
  exists.
- **Instantiation is deliberately kept OUT of `STRUCT_META.schema`** —
  discovered during `lifecycle-serialization` design and retrofitted into
  `struct-entities`/`entity-relationships`. `.parse()`/`.safeParse()` use
  `new.target`/`this` for subclass polymorphism; `Embed`/`Ref` bind their
  own concrete-class transform. Without this, `class-extensibility`'s
  `instanceof` promise would silently break.
- `.extend()` = real `class extends` (superset, `instanceof` holds);
  `.omit()`/`.pick()`/`.partial()` = independent class (subset/reshape,
  `instanceof` source does NOT hold) — a deliberate, non-obvious split.
- Every Zod-facing design decision (issue codes, `.refine()` chaining,
  `z.lazy()`, `z.discriminatedUnion`, `z.iso.datetime()` timezone strictness)
  was verified against Context7 (`/colinhacks/zod` v4.0.1), not assumed —
  caught and fixed one real INSIGHT.md inaccuracy (`regex` isn't a real v4
  issue code; it's `invalid_format` + `format`).

Next phase: Tasks (breaking each feature into atomic implementable steps),
per `.specs/project/STATE.md`'s Todos.

## Open questions carried at roadmap level (not blocking spec writing)

- Package manager / monorepo tooling — not specified in INSIGHT.md.
- Test framework — not specified in INSIGHT.md.
- Publishing target (npm scope/name `morphz`) — assumed but not confirmed.
- Repo is not yet a git repository — init deferred until user confirms.
