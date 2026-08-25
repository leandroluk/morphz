# Spec: Property Interceptors (`get`/`set` on `Define`, §16)

## Summary

Per `INSIGHT.md` §16: `Define(BaseType, { get, set })` registers dynamic
`get`/`set` accessors (applied via `Object.defineProperty` in the
constructed instance) so a field's WIRE format (what validates/serializes)
can differ from its DOMAIN representation (a rich object the consumer
actually interacts with, e.g. MongoDB's `ObjectId`) — and stays live
across mutation (`user.id = new ObjectId()`), unlike Zod's one-shot
`z.preprocess()`.

## Requirements

- REQ-001: `Define(BaseType, { get, set })` — `get: (accessor: {value:
WireT}) => DomainT` reads the internally-stored WIRE value and returns
  the rich domain object; `set: (val: DomainT | WireT, accessor: {value:
WireT}) => void` accepts either the domain type OR a raw wire-compatible
  value, normalizes, and writes back to `accessor.value` (the internal
  wire-format storage).
- REQ-002: Constructor-time application: for every field descriptor with
  `get`/`set` in its `meta`, `buildStructClass()`'s constructor uses
  `Object.defineProperty(this, fieldName, { get, set, enumerable: true,
configurable: true })` INSTEAD OF a plain `Object.assign`-style value
  property — the internal wire value lives in a non-enumerable backing
  slot (e.g. a `Symbol`-keyed or `#private`-prefixed internal store) that
  `get`/`set` close over.
- REQ-003: Validation still happens against the WIRE format at
  `.parse()`/`.safeParse()` time (the `zodSchema` never sees the domain
  object) — `get`/`set` are a PURELY post-validation presentation layer,
  they don't change what gets validated.
- REQ-004: `.toJSON()`/`.toMaskedJSON()` read the WIRE value (the backing
  slot), NOT the domain object via the `get` accessor — INSIGHT.md's
  example confirms this (`user.toJSON()` returns the pure wire string,
  not a serialized `ObjectId`). This is a real interaction with
  `lifecycle-serialization`'s already-shipped `to-json.ts`/
  `to-masked-json.ts` — needs to read from the SAME internal source those
  already read from (currently `this[fieldName]` directly — if that now
  triggers the `get` ACCESSOR instead of a plain property read, `toJSON`
  would incorrectly serialize the DOMAIN object, not the wire value; this
  needs `to-json.ts`/`to-masked-json.ts` to be updated to read the
  backing wire slot directly when a `get`/`set` pair is present, not
  `this[fieldName]`).
- REQ-005: `immutable` still applies to the WIRE value at `set` time (an
  immutable field with `get`/`set` still rejects reassignment on an
  update-derived variant, per `class-extensibility`'s existing mechanism)
  — but that mechanism currently works by patching the FIELD'S ZOD SCHEMA
  (`z.undefined().optional()`), which is a validation-time concern; the
  RUNTIME reassignment protection (`user.id = ...` after construction)
  is a SEPARATE, NEW concern this feature introduces — INSIGHT.md's
  example shows `user.id = new ObjectId()` succeeding on a NON-immutable
  field's `set`, but never demonstrates what happens when `set` is called
  on an `immutable` field's instance post-construction. Needs a decision:
  does the generated `set` accessor ITSELF throw for `immutable` fields
  after first assignment, or is `immutable` still purely a
  validation-time concept (never enforced against direct property
  mutation, matching how NO field is protected against mutation today —
  confirm current behavior, `Object.assign` doesn't freeze anything)?

## Affected Components

Cross-cuts `struct-entities` (constructor/`buildStructClass`),
`lifecycle-serialization` (`to-json.ts`/`to-masked-json.ts` must read the
wire slot, not the accessor), `define-metatypes` (`FieldDescriptorMeta`
needs `get`/`set` added), `mock-fixtures` (mocking a `get`/`set` field —
does `.mock()` synthesize the WIRE value and let `set` normalize it, or
bypass entirely? Needs confirming, not assumed).

## Out of Scope

- Any change to how `.parse()`/`.safeParse()` validate — REQ-003 already
  states validation stays wire-format-only, unaffected by this feature.
- A generic "computed property" mechanism beyond wire/domain translation
  — `get`/`set` here are specifically about ONE field's own wire↔domain
  representation, not arbitrary derived/computed fields spanning multiple
  fields (INSIGHT.md's own "Fronteira do design" — computed getters like
  `fullAddress` — already explicitly excludes that from the schema
  lifecycle; this feature doesn't change that boundary).

## Resolved

- REQ-005: `set` DOES throw for `immutable` fields after the first
  assignment (construction) — a write-once field with `get`/`set` must
  stay write-once through direct mutation too, not just through
  `.parse()`/DTO derivation, or the `immutable` guarantee would be
  silently hollow for any field using this feature. Concretely: the
  generated `set` accessor checks `meta.immutable` and a per-instance
  "already initialized" flag (set true right after the constructor's
  first assignment); a second `set` call on an immutable field throws.

## Open Questions

- Does `Embed`/nested-`Struct` field access through a `get`/`set` field
  interact correctly with the EXISTING `Embed`/`Ref` machinery (which
  itself expects to read/write plain values, not go through a custom
  accessor)? Likely orthogonal (an `Embed`-ed field wouldn't typically ALSO
  have `get`/`set` — they solve different problems) but worth an explicit
  test rather than assuming no interaction.
- `STRUCT_META.fields` currently stores the STATIC descriptor — does
  `get`/`set` need any additional STRUCT_META-level bookkeeping (e.g. a
  quick "does this field have a custom accessor" flag) for
  `to-json.ts`/`mock.ts`/`jsdoc`'s consumers to know to treat it specially,
  or can they all just check `descriptor.meta.get`/`.set` directly? Likely
  the latter (simpler, no new bookkeeping needed) — confirm in Design.
