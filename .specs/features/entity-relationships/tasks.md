# Tasks: Entity Relationships (`Ref`, `FieldOf`, `Union`)

_(PO breakdown, from spec.md + design.md)_

## T-001: `Literal()`

- **REQ**: REQ-006
- **What**: thin `z.literal(value)` wrapper, `FieldDescriptor { zodSchema, meta: {} }`.
- **Where**: `src/core/literal.ts`
- **Depends on**: `define-metatypes` (`FieldDescriptor`)
- **Done when**: `Literal('DRAFT')` validates only `'DRAFT'`.
- **Gate**: `npm run test -- literal`

## T-002: `Ref()`

- **REQ**: REQ-001, REQ-002
- **What**: `z.lazy(() => { const S = thunk(); return S[STRUCT_META].schema.transform(d => new S(d)) })`
  - `targetStruct: thunk`.
- **Where**: `src/core/ref.ts`
- **Depends on**: `struct-entities` (`STRUCT_META`, T-003 there)
- **Done when**: self-referencing `Ref(() => SameStruct)` works (declare a
  `Category` with `parent: Optional(Ref(() => Category))` and parse a
  2-level-deep payload).
- **Gate**: `npm run test -- ref`

## T-003: `FieldOf()`

- **REQ**: REQ-003, REQ-004
- **What**: eager clone of `Struct[STRUCT_META].fields['name']`'s FULL
  descriptor (zodSchema + meta) MINUS `default`/`immutable`, merged with
  own `options` via `mergeDescriptor`. Throws synchronously at call site if
  `'name'` isn't a key.
- **Where**: `src/core/field-of.ts`
- **Depends on**: `struct-entities` (`STRUCT_META`)
- **Done when**: `FieldOf(User, 'id')` reuses `User.id`'s exact validation
  (regex/refine included) but not its `default`; `FieldOf(User, 'bogus')`
  throws immediately.
- **Gate**: `npm run test -- field-of`

## T-004: `Union()` with discriminator detection

- **REQ**: REQ-005
- **What**: `isZodObject` check on `STRUCT_META.rawObjectSchema` (pre-
  transform) for each member; `detectDiscriminatorKey` finds a shared key
  with distinct `z.literal` values across all object members; dispatch to
  `z.discriminatedUnion(key, ...)` (explicit key) or plain `z.union(...)`.
- **Where**: `src/core/union.ts`
- **Depends on**: T-001, `struct-entities` (`STRUCT_META.rawObjectSchema`)
- **Done when**: `Union([Struct1, Struct2])` sharing a discriminator
  resolves discriminated (verify via better/faster error on wrong
  discriminator value); `Union([Literal(...), StructWithDiscriminator])`
  falls back to plain union with no special-case code needed.
- **Gate**: `npm run test -- union`

**Total**: 4 tasks. T-001 parallelizable `[P]` with nothing (no deps);
T-002/T-003 both depend only on `struct-entities`, parallelizable `[P]`
with each other; T-004 depends on T-001.
