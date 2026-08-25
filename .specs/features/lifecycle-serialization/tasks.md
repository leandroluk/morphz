# Tasks: Lifecycle — Parsing, Instantiation, Serialization

_(PO breakdown, from spec.md + design.md)_

**Status: DONE (2026-08-25).** T-001..T-003 implemented + tested (80/80
cumulative pass). Confirmed: constructor always validates and throws
`ValidationError` (i18n-resolved), `parse`/`safeParse` both polymorphic via
`new.target`, `safeParse` does not re-run the constructor (no double
validation, verified via a pre-hook side-effect counter running exactly
once), `toJSON()` masks `writeOnly` and recurses correctly into `Embed`.

## T-001: `ValidationError`

- **REQ**: (lifecycle-serialization design)
- **What**: `extends Error`, `.issues` = `resolveIssueMessages(zodError,
structClass, resolveLocale())` output.
- **Where**: `src/core/validation-error.ts`
- **Depends on**: `i18n-error-messages` (`resolveIssueMessages`, `resolveLocale`)
- **Done when**: thrown from a failing `.parse()`, `.issues` messages are
  already i18n-resolved.
- **Gate**: `npm run test -- validation-error`

## T-002: constructor + `static parse`/`safeParse`

- **REQ**: REQ-001, REQ-002, REQ-003
- **What**: constructor uses `new.target[STRUCT_META].schema.parse(input)`
  → `ValidationError` on throw, else `Object.assign(this, data)`.
  `static parse(input) { return new this(input) }`. `static safeParse`
  avoids double-validation via `Object.create(this.prototype)` + assign on
  the already-validated `schema.safeParse()` result.
- **Where**: `src/core/struct.ts` (extends what `struct-entities` built —
  confirm `struct-entities`'s T-003 didn't already add a bare-bones version;
  reconcile rather than duplicate)
- **Depends on**: T-001, `struct-entities` (`STRUCT_META`, base class)
- **Done when**: `X.parse(valid)` returns `instanceof X`; `X.parse(invalid)`
  throws `ValidationError`; `X.safeParse(invalid)` returns `{success:false,
errors}` without throwing; `new X(input)` behaves identically to
  `.parse()`.
- **Gate**: `npm run test -- lifecycle`

## T-003: `.toJSON()`

- **REQ**: REQ-005
- **What**: skips `meta.writeOnly` fields; recurses into `Embed`/`Ref`
  instances (`descriptor.targetStruct` set) via their own `.toJSON()`;
  applies `descriptor.meta.encode` (codec fields); maps over `List` items
  via `descriptor.itemDescriptor`.
- **Where**: `src/core/to-json.ts`
- **Depends on**: T-002
- **Done when**: a `Password({writeOnly:true})` field never appears in
  output; a `DateTime` field serializes to ISO string; an `Embed`-ed field
  serializes via its own `.toJSON()` (nested masking/encoding also applies).
- **Gate**: `npm run test -- to-json`

**Total**: 3 tasks, sequential.
