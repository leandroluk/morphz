# Spec: Mock/Fixture Generation (`.mock()` / `.mockMany()`)

## Summary

Per `INSIGHT.md` §12: every `Struct`-produced class gets static
`.mock(overrides?)`/`.mockMany(count, factory?)` methods that synthesize a
valid instance from each field's own metadata (`examples`, `default`,
regex/min/max constraints) — real instances (`instanceof` holds, domain
methods work), not plain objects.

## Requirements

- REQ-001: `StructClass.mock(overrides?: Partial<Shape>)` synthesizes a
  value for every field NOT present in `overrides`, then constructs via
  the SAME validating path as `.parse()` (never bypasses validation — a
  bad mock generator producing an invalid instance is a bug to catch
  immediately, not silently allow).
- REQ-002: Value synthesis priority per field: (a) `overrides[field]` if
  present, wins outright; (b) `meta.examples[0]` if the `Define` declared
  any; (c) `meta.default` (value or thunk) if present; (d) synthesized
  from the field's Zod constraints — regex-driven synthesis for
  `Text`-based fields is the hard case (see Open Questions), numeric
  fields synthesize within `min`/`max`, `Email`/`Uuid`/other format
  primitives use a valid canonical example for that format.
- REQ-003: `immutable` fields still get synthesized/included normally in
  `.mock()` — mocking always represents CREATION (matches the base
  `Struct` class's own always-allow-immutable-on-create semantics from
  `define-metatypes` REQ-005), never an update-DTO shape.
- REQ-004: `Embed`-ed fields recursively call the embedded `Struct`'s own
  `.mock()`. `Ref`-ed fields — see Open Questions (mocking a relationship
  to another entity is ambiguous: synthesize a full related instance? A
  bare valid ID-shaped stand-in? Must decide before Execute).
- REQ-005: `StructClass.mockMany(count, factory?: (index: number) =>
Partial<Shape>)` calls `.mock(factory?.(i))` `count` times, returns an
  array — per INSIGHT.md §12's example (`user-${index}@example.com`
  pattern for uniqueness across the batch).

## Affected Components

Depends on `define-metatypes` (`FieldDescriptor.meta` — `examples`,
`default`), `struct-entities` (`STRUCT_META.fields`), `entity-relationships`
(`Embed`/`Ref` recursive mocking), `lifecycle-serialization` (constructs via
the real validating constructor). Lives in `packages/core`.

## Out of Scope

- Deterministic/seeded randomness for reproducible test runs — not
  mentioned in INSIGHT.md; if regex-driven synthesis ends up using any
  randomness (see Open Questions), a seed option may be worth adding but
  isn't specified, don't invent it unprompted.
- Database seeding orchestration (batching inserts, foreign-key ordering
  across mocked entities) — `.mockMany()` only produces in-memory
  instances; wiring them into a real seed script is the consumer's job.

## Open Questions

- Regex-driven synthesis for a `Text`-based `Define` with a `regex` but no
  `examples` (e.g. `Cep` has an `examples: ['01001-000']` so REQ-002(b)
  covers it — but a hypothetical custom `Define(Text, { regex: /.../ })`
  with NEITHER `examples` NOR an obvious canonical value) — needs either a
  regex-to-string generator dependency (real, non-trivial engineering:
  `randexp` or similar) or a hard requirement that mockable fields SHOULD
  declare `examples` (falling back to a generation ERROR/warning rather
  than guessing, if no `examples` and no synthesizable primitive shape
  exists). Recommend the latter (fail loud, don't guess) unless the user
  wants randexp-style generation — flagging for confirmation.
- `Ref(() => Target)` mocking: synthesize a full nested `Target.mock()`
  instance, or just a scalar matching `Target`'s primary key's shape
  (avoiding potentially-recursive/expensive full-entity generation for
  every relationship touched by a mock chain)? INSIGHT.md doesn't cover
  this case at all — needs a decision before Execute.
