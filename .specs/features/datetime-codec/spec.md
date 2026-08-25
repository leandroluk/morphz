# Spec: DateTime/Timestamp as Codec

## Summary
`DateTime` and `Timestamp` must never be backed by `z.date()` internally,
because `z.toJSONSchema()` (Zod v4) treats `z.date()` as unrepresentable
(throws or emits an empty `{}` schema), which breaks OpenAPI/Swagger
generation for any date field. Instead, both are implemented with Zod v4's
`z.codec(wireSchema, domainSchema, {decode, encode})`: the wire side is a
representable string schema (`z.iso.datetime()`), the domain side is a real
`Date` for in-memory comparisons (`TimeAgo`, `TimeBefore`, `TimeAfter`, etc.).

## Requirements
- REQ-001: `DateTime` (and `Timestamp`) are defined as
  `z.codec(z.iso.datetime(), z.date(), { decode, encode })`. `decode` parses
  wire string → `Date`; `encode` serializes `Date` → ISO string.
- REQ-002: `z.toJSONSchema()` over any `Struct` containing a `DateTime`/
  `Timestamp` field must emit `{ type: 'string', format: 'date-time' }` for
  that field, with no manual override/patch step required by the consumer.
- REQ-003: Parsing (`.parse()`/`.safeParse()`) accepts wire-format ISO strings
  as input and yields real `Date` instances on the resulting class instance —
  domain code (`Define`-based refinements like `TimeAgo`) operates on `Date`,
  comparing with `new Date()` etc.
- REQ-004: Serialization (`.toJSON()` / DTO codec-mode `encode`) converts
  `Date` back to ISO string. Must integrate with `nestjs-zod`'s
  `createZodDto(schema, { codec: true })` pattern with no `morphz`-side
  adapter needed beyond exposing a schema that is itself a valid Zod codec.
- REQ-005: `Timestamp` is `DateTime` with `default: () => new Date()` baked
  in — same wire schema (`z.iso.datetime()`), same domain schema (`z.date()`),
  same codec `decode`/`encode`. It is effectively
  `Define(DateTime, { default: () => new Date() })` (a `define-metatypes`
  recipe), not a separate primitive with different wire/domain shapes. Kept
  as its own export because it's common enough to want a "just stamp now"
  primitive without writing the `Define` wrapper by hand every time.
- REQ-006: `examples[]` vs `example` (OpenAPI 3.0 vs 3.1/JSON Schema
  2020-12) is explicitly NOT this feature's concern — already solved by
  `nestjs-zod`'s `cleanupOpenApiDoc({ version: '3.0' })`. No `morphz`-side
  patch needed.

## Affected Components (from graph)
N/A — greenfield. Depends on nothing else in `morphz`; other features
(`define-metatypes`'s `TimeAgo`/`TimeBefore`/`TimeAfter`, `struct-entities`'s
`CreatedAt`/`UpdatedAt`/`DeletedAt`) depend on this feature's `DateTime`
export existing and behaving as a real `Date` on the domain side.

## Out of Scope
- `Define`-based date refinements (`TimeAgo`, `TimeBefore`, `TimeAfter`,
  `RowVersion`) — those live in `define-metatypes`, built on top of this
  feature's `DateTime` export.
- General OpenAPI document cleanup beyond the date-field type/format —
  delegated to `nestjs-zod`.

## Resolved (design phase)
- Timezone handling: `z.iso.datetime()` (no options) is strict UTC-only —
  requires the `Z` suffix, rejects both numeric offsets and local/
  timezone-less strings (confirmed via Context7 against `/colinhacks/zod`
  v4.0.1). `decode`'s `new Date(s)` needs no manual normalization — a
  `Z`-suffixed string always parses to the correct UTC instant.
