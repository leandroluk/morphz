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
  knowledge. *(Refined during `i18n-error-messages` design — supersedes an
  earlier, too-broad version of this note.)*

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
