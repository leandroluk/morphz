# Spec: Entity Relationships (`Ref`, `FieldOf`, `Union`)

## Summary
Two distinct, non-interchangeable primitives model relationships between
entities: `Ref(() => Struct)` for lazy entity-to-entity relations (1:1, 1:N),
and `FieldOf(Struct, 'fieldName')` for reusing the *type* of a single already
declared field (typically a scalar FK) without pulling in the whole related
entity. `Union`/`Literal` provide Zod-mirrored union resolution (discriminated
when members share a discriminator key, plain union otherwise), used e.g. for
`Post.status`.

## Requirements
- REQ-001: `Ref(() => Struct)` takes a thunk (not the class directly) so two
  `Struct`s can reference each other circularly (e.g. mutual `User.posts` /
  `Post.author` if that were declared) without a temporal-dead-zone error at
  module load. Resolution happens lazily, at schema-build/first-use time.
- REQ-002: `Ref` is used standalone or wrapped in `List`/`Optional`
  (`Optional(List(Ref(() => Post)))` for 1:N, bare `Ref(() => X)` for 1:1)
  — `morphz` does not need a separate `HasMany`/`BelongsTo` API; composition
  with `List`/`Optional` expresses cardinality.
- REQ-003: `FieldOf(Struct, 'fieldName', options?)` reads the *shape* (type +
  base validation) of `Struct`'s already-declared field named `'fieldName'`
  and produces a new field descriptor with that same base type. It is NOT
  lazy — `Struct` must already be fully declared (its field record populated)
  at the time `FieldOf` is called, since it reads the shape synchronously.
  Passing a `Struct` not yet fully declared (e.g. via forward reference) is a
  usage error to be caught at development/type-check time if possible, or at
  runtime otherwise.
- REQ-004: `FieldOf` clones the source field's FULL descriptor — Zod schema
  (`regex`/`refine` included, not just the bare type) AND `meta` — except
  `default` and `immutable`, which are explicitly dropped (a FK reusing a
  PK's type shouldn't silently inherit the PK's self-generation or
  write-once semantics). `options` passed to `FieldOf` then merge on top via
  the same `mergeDescriptor()` used by `Define` (shallow overwrite, deep
  merge for `message`).
- REQ-005: `Union([...members], options?)` mirrors Zod's OWN applicability
  rule for `discriminatedUnion` exactly — not a `morphz`-specific heuristic.
  `z.discriminatedUnion` only applies when every member is an object schema
  sharing one common key whose value is a distinct literal per member.
  `Union` inspects members at construction time against that same criterion:
  all members are `Struct`s (object schemas) with a shared literal
  discriminator key → resolves as `z.discriminatedUnion`. Any member that
  doesn't structurally qualify (a bare `Literal`, a non-`Struct` type, a
  `Struct` missing the shared key) means the set doesn't satisfy Zod's own
  criterion → resolves as a plain `z.union`, same as calling Zod directly
  with the same member set. No separate `DiscriminatedUnion` export needed —
  one `Union` call, same decision Zod would make.
- REQ-006: `Literal(value)` wraps a single literal value (string/number/bool)
  as a field type, primarily for use as a `Union` member (e.g.
  `Union([Literal('DRAFT'), Literal('PUBLISHED'), Literal('ARCHIVED')])`).

## Affected Components (from graph)
N/A — greenfield. Depends on `struct-entities` (needs a `Struct` class to
reference/read fields from). `FieldOf` specifically depends on `Struct`'s
internal field-record representation being introspectable.

## Out of Scope
- ORM/repository-level relationship loading (eager/lazy DB fetch, joins) —
  explicitly out of scope per INSIGHT.md; `Ref` only models the schema-level
  relationship, not persistence.
- Soft-delete query filtering — explicitly out of scope; `deletedAt` is "just
  another field," filtering is a repository/ORM concern.

## Resolved (design phase)
- `FieldOf` throws synchronously at its OWN call site (module load time,
  fail-fast) when `'fieldName'` isn't in the source `Struct`'s field record
  — never deferred to first parse. TS-level `keyof`-based compile-time
  safety is achievable and planned as an Execute-phase typing task.
- `Ref` DOES support self-reference (`parent: Optional(Ref(() =>
  Category))` inside `Category`'s own declaration) with zero extra work —
  confirmed by how `z.lazy()` defers thunk evaluation past module load, past
  the referenced class's own temporal dead zone.
