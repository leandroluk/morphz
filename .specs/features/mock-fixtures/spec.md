# Spec: Mock/Fixture Generation (`.mock()` / `.mockMany()`)

**Status: DONE (2026-08-25).** Implemented + tested (121/121 cumulative
pass, 15 tests for this feature). Value synthesis priority: overrides →
`examples[0]` → `default` → `Embed`/`Ref` recursive `.mock()` → `List` via
`itemDescriptor` → primitive introspection (`_zod.def`: canonical value
per format, `randexp` for regex-only `Text`, min/max-bounded for `Number`,
enum/literal/union handled, plain string fallback). Cycle guard (in-
-progress class `Set` + `MAX_MOCK_DEPTH = 5`): an `Optional` circular
`Ref` resolves to `undefined` once the cycle is detected; a REQUIRED
(non-`Optional`) circular `Ref` throws a clear error instead of
stack-overflowing or looping — confirmed via a real mutual-reference test
(`A.b: Ref(() => B)` / `B.a: Ref(() => A)`, no `Optional`). `immutable`
fields are synthesized normally (mocking always represents creation).
Every mock round-trips through the real `.parse()` validation path
(confirmed via an explicit test, not just "looks valid").

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

## Resolved

- Regex-driven synthesis: uses `randexp` (new dependency in `packages/
core`) when a `Text`-based field has a `regex` but no `examples`/
  `default` — REQ-002's priority order gets a step (e): `randexp(regex)
.gen()`. Only reached when (a)-(d) all miss. A field with neither
  `examples` nor a synthesizable regex/format (e.g. a bare `refine`-only
  custom validator with no `regex`) still fails loud — `randexp` covers
  the regex case specifically, not every possible custom validation.
- `Ref(() => Target)` mocking: always generates a FULL recursive
  `Target.mock()` instance (matches `Embed`'s existing recursive
  treatment, REQ-004's first half) — no scalar-stand-in mode. Recursion
  depth risk (cycles via mutually-referencing `Ref`s) needs a cycle guard
  in Design (e.g. a max-depth or in-progress-set check), since INSIGHT.md
  doesn't address self-referencing entities in a mock context at all.

## Open Questions

None blocking — both resolved above.
