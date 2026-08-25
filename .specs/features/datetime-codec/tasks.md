# Tasks: DateTime/Timestamp as Codec

_(PO breakdown, from spec.md + design.md)_

**Status: DONE (2026-08-25).** T-001/T-002 implemented + tested (32/32
cumulative pass). Design nuance confirmed by QA: `meta.default` is applied
by `struct-entities`'s assembly step, not by the primitive itself.

## T-001: `DateTime` codec primitive

- **REQ**: REQ-001, REQ-002, REQ-003, REQ-004
- **What**: `z.codec(z.iso.datetime(), z.date(), { decode, encode })` wrapped
  as a zero-arg-callable `FieldDescriptorFactory`; `meta.encode` set to
  `(d: Date) => d.toISOString()`.
- **Where**: `src/primitives/date-time.ts`
- **Depends on**: `define-metatypes` (`FieldDescriptor`, `FieldDescriptorFactory` types)
- **Done when**: parsing a `Z`-suffixed ISO string yields a real `Date`;
  parsing an offset string (`+02:00`) or local string (no `Z`) is rejected;
  `z.toJSONSchema()` over a schema containing this field emits
  `{ type: 'string', format: 'date-time' }`.
- **Gate**: `npm run test -- date-time`

## T-002: `Timestamp` recipe

- **REQ**: REQ-005
- **What**: `Define(DateTime, { default: () => new Date() })`.
- **Where**: `src/primitives/timestamp.ts`
- **Depends on**: T-001, `define-metatypes`'s `Define()`
- **Done when**: `Timestamp()` with no input populates current time; still
  accepts an explicit ISO string overriding the default.
- **Gate**: `npm run test -- timestamp`

**Total**: 2 tasks, sequential.
