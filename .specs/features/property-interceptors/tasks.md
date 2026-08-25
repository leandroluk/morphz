# Tasks: Property Interceptors

**Status: DONE (2026-08-25) — last of the v3 batch.** T-001..T-004
implemented + tested (219/219 cumulative pass, ZERO regression on the
most invasive change so far — edits `struct.ts`, `to-json.ts`,
`to-masked-json.ts`). Confirmed via real `FakeObjectId`-style integration
test: domain-object read, wire-only `.toJSON()`, mutable reassignment,
immutable throws post-construction. QA confirmed ALL remaining edge
cases with zero source bugs: `.mock()` works, `.toMaskedJSON()` masks the
WIRE value (not domain), `Embed` recursion composes correctly through
child's own `readWireValue()`, `safeParse` shares the same `assignFields()`
path as the constructor, non-immutable fields tolerate unlimited
reassignment.

## T-001: `FieldDescriptorMeta.get`/`.set` + core helpers
- **REQ**: REQ-001, REQ-002
- **What**: add `get?: (accessor: {value: WireT}) => DomainT` / `set?:
  (val: DomainT | WireT, accessor: {value: WireT}) => void` to
  `FieldDescriptorMeta`. `src/core/property-interceptor.ts`:
  `getWireSlot()`, `applyFieldValue()`, `readWireValue()`,
  `assignFields()` per design.md.
- **Where**: `src/core/field-descriptor.ts`, `src/core/property-interceptor.ts`
- **Gate**: `npx vitest run -- property-interceptor`

## T-002: Wire into `struct.ts`
- **REQ**: REQ-002, REQ-005
- **What**: constructor and `static safeParse()` both use `assignFields()`
  instead of bare `Object.assign`.
- **Where**: `src/core/struct.ts`
- **Depends on**: T-001
- **Gate**: `npx vitest run` (full suite, no regression)

## T-003: Wire into `to-json.ts`/`to-masked-json.ts`
- **REQ**: REQ-004
- **What**: both use `readWireValue()` instead of direct
  `instance[fieldName]` access.
- **Where**: `src/core/to-json.ts`, `src/core/to-masked-json.ts`
- **Depends on**: T-001
- **Gate**: `npx vitest run` (full suite, no regression)

## T-004: `Define(BaseType, { get, set })` integration test
- **REQ**: all
- **What**: end-to-end test mirroring INSIGHT.md §16's `MongoId`/`ObjectId`
  example (or a similar lightweight domain class, no real `mongodb`
  dependency needed) — parse produces domain object on read, `.toJSON()`
  returns wire string, mutation via `set` works, immutable field's `set`
  throws post-construction.
- **Where**: `tests/property-interceptors/integration.test.ts`
- **Depends on**: T-001, T-002, T-003
- **Gate**: full suite, no regression

**Total**: 4 tasks, sequential.
