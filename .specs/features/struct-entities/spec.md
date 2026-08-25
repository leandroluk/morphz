# Spec: Struct Entities & Embedded Value Objects

## Summary
`Struct(fields, options)` is the core class-factory: a plain object of field
descriptors (built via core primitives / `Define`) plus an `options` object
(`labels`, `description`, `pre`, `post`) produces a base class. Extending that
base class with `class X extends Struct({...}, {...}) {}` yields a domain
entity that carries both schema-driven validation and hand-written methods.
`Embed(Struct)` allows nesting one `Struct` inside another as a value object
(no identity/relationship semantics — pure composition), as shown by `Address`
nested inside `User`.

## Requirements
- REQ-001: `Struct(fields, options)` returns a base class. `fields` is a
  record of field-descriptor factories (`Text()`, `PrimaryKey()`, etc.).
  `options.labels` is a record (e.g. `{ entityName, module }`) propagated to
  every field's template interpolation (see `define-metatypes` REQ-004) —
  scoped strictly to THIS `Struct(...)` call's own `fields` record.
  **Correction (design phase):** labels do NOT cascade into nested
  `Embed`/`Ref` targets — `Address` (embedded in `User`) declares its own
  `labels: { entityName: 'Endereço' }` independently in INSIGHT.md §2, it
  never inherits `User`'s `entityName: 'Usuário'`. Each `Struct` call is a
  fully independent template-resolution scope.
- REQ-002: `options.description` documents the entity itself (distinct from
  per-field `description`) — surfaces in generated JSON Schema `description`
  at the object level.
- REQ-003: `options.pre: (val) => val` runs before field-level parsing
  (equivalent to `z.preprocess`) — used for normalization (e.g. lowercasing
  `username`). Runs on the raw input object, returns a (possibly mutated)
  raw object.
- REQ-004: `options.post: (val, ctx) => void` runs after field-level parsing
  succeeds (equivalent to `z.superRefine`) — used for cross-field validation.
  `ctx.addIssue({ code, path, message })` adds a validation issue in Zod's
  issue-tree shape. This is the ONLY sanctioned place for comparing two
  fields of the same `Struct` (e.g. `startDate < endDate`) — `Define`'s
  `refine` must never receive the full object (see `define-metatypes`
  REQ-003).
- REQ-005: `Embed(Struct)` wraps another `Struct` class for use as a field
  value (typically inside `Optional(Embed(X))` or bare). Parsing an embedded
  field produces a real instance of the embedded `Struct` (not a plain
  object) nested inside the parent instance — `user.address instanceof
  Address` must hold.
- REQ-006: A `Struct`-derived class may declare plain class members (getters,
  methods) that are NOT part of `fields` — these are pure behavior, excluded
  from parse/serialize/JSON-Schema generation entirely (see INSIGHT.md
  "Fronteira do design").
- REQ-007: No multi-inheritance / mixins. Field reuse across entities happens
  exclusively via shared `Define`d field factories (`PrimaryKey()`,
  `CreatedAt()`, etc.) repeated in each `Struct`'s field record — there is no
  `Timestamped`/`SoftDeletable` base class to extend or compose.
- REQ-008: `List(ItemType, options?)` wraps a field as an array of `ItemType`,
  with its own `default` (e.g. `List(Text(), { default: () => [] })`).
- REQ-009: `Optional(Type)` and `Nullable(Type)` are distinct primitives (Zod
  `.optional()` and `.nullable()` semantics respectively) and compose with
  any other primitive/`Embed`/`Ref`/`List`.

## Affected Components (from graph)
N/A — greenfield. Depends on `define-metatypes` (field descriptors, template
labels) and `datetime-codec` (for `CreatedAt`/`UpdatedAt`/`DeletedAt` fields
used in the `User`/`Post` examples). `entity-relationships` depends on this
feature for `Struct` class identity (`Ref`/`FieldOf` both need a resolvable
`Struct` class).

## Out of Scope
- `Ref` (entity relationship) and `FieldOf` (field-type reuse) — separate
  feature (`entity-relationships`), even though both appear inside `Struct`
  field records in examples.
- `Union`/`Literal` discriminated-union resolution — separate feature
  (`entity-relationships`), grouped there since `Post.status` in INSIGHT.md
  §4 is the driving example.
- `.extend()`/`.omit()`/`.pick()`/`.partial()` — separate feature
  (`class-extensibility`).
- `.parse()`/`.safeParse()`/`.toJSON()` runtime mechanics — separate feature
  (`lifecycle-serialization`); this spec only requires that the resulting
  class SUPPORTS those calls, not their internal behavior.

## Resolved (design phase)
- `post` hook signature: public shape stays `ctx.addIssue({ code, path,
  message })` matching INSIGHT.md §3 exactly. Internally implemented via
  Zod v4's `.check()` (Context7 confirms `.superRefine()` is deprecated in
  v4 in favor of `.check()`, though still functional) — implementation
  detail, doesn't change the public `post(val, ctx)` contract.
- `Embed`'s nested `Struct` does NOT inherit the parent's `pre`/`post` —
  each `Struct` is a fully self-contained pipeline with its own hooks
  already baked into its schema before it's ever embedded. `Embed` reuses
  the target's complete, already-built pipeline (hooks included) rather
  than merging/inheriting anything across the `Struct` boundary.

## Open Questions
- Field-level `description` (e.g. `Text({ description: 'Logradouro' })`) vs.
  entity-level `options.description` — do both appear in JSON Schema output
  simultaneously, and at what precedence if a `Define` template also sets a
  description for the same field?
