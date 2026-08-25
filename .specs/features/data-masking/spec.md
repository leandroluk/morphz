# Spec: Data Masking / LGPD (`mask` / `.toMaskedJSON()`)

**Status: DONE (2026-08-25).** Implemented + tested (106/106 cumulative
pass). `mask` fell into `mergeDescriptor`'s existing shallow-overwrite path
unchanged (no special merge logic needed, unlike `message`). Confirmed:
`mask` runs before `encode`; `Embed`/`Ref` recurse via the child's own
`.toMaskedJSON()`; `List` masks item-by-item via `itemDescriptor`;
`writeOnly` fields never reach masking (omitted same as `.toJSON()`);
`.toJSON()` itself is completely unaffected by `mask` (only
`.toMaskedJSON()` applies it).

## Summary

Per `INSIGHT.md` §13: `Define`/field-level `mask` option registers a
redaction function; `.toMaskedJSON()` serializes an instance applying
`mask` per field (in addition to `.toJSON()`'s existing `writeOnly`
omission) — protects PII in logs/observability tooling.

## Requirements

- REQ-001: `mask?: (value: T) => T` added to `FieldDescriptor.meta` (new
  optional key, same tier as `encode`/`writeOnly` — small additive change
  to `define-metatypes`'s already-shipped `FieldDescriptor` shape).
- REQ-002: `Define(BaseType, { mask })` registers the function on the
  descriptor; per-field override at declaration site
  (`email: Email({ mask: customFn })`) replaces (not merges — `mask` is a
  single function, not a per-code map like `message`) the `Define`-level
  default.
- REQ-003: `instance.toMaskedJSON()`: same field-walk as `.toJSON()`
  (`writeOnly` fields still omitted entirely — masking is not a
  replacement for write-only omission, both apply), but for every field
  that HAS a `mask` function, apply it to the value BEFORE the existing
  `.toJSON()` encoding step (mask the domain value, e.g. the real email
  string, THEN apply any `meta.encode` if the type also has one — though
  in practice `mask` and `encode` co-occurring on the same field is an
  unlikely combination, order still needs to be well-defined: mask first,
  since `encode` is about wire representation, `mask` is about redaction
  of the semantic value).
- REQ-004: Fields WITHOUT a `mask` function pass through unchanged in
  `.toMaskedJSON()` (same value as `.toJSON()` would produce for that
  field) — masking is opt-in per field, not a blanket redaction.
- REQ-005: `Embed`/`Ref` nested instances: `.toMaskedJSON()` recurses into
  their own `.toMaskedJSON()` (not their `.toJSON()`) — masking must
  propagate through the whole nested structure, consistent with how
  `.toJSON()` already recurses via `.toJSON()` at each level
  (`lifecycle-serialization`'s existing `to-json.ts` design).

## Affected Components

Depends on `define-metatypes` (`FieldDescriptor.meta.mask`, new field),
`lifecycle-serialization` (`.toJSON()`'s existing recursive field-walk is
the direct template for `.toMaskedJSON()` — same traversal, different
per-field transform applied). Lives in `packages/core`.

## Out of Scope

- Automatic PII detection (inferring which fields SHOULD be masked from
  field name/type heuristics) — `mask` is always explicit, author-declared,
  never inferred.
- Masking of `List`-item values needing per-item mask functions distinct
  from the list's own descriptor — not covered by INSIGHT.md's example
  (only scalar fields like `email`/`cpf` shown); if a `List(Email())`
  field's items need masking too, the mechanism should fall out naturally
  from `to-json.ts`'s existing `itemDescriptor` recursion (each item goes
  through the SAME per-item masking as `.toJSON()` already does for
  encoding) — confirm in Design, don't special-case.

## Open Questions

- None blocking — this is one of the smaller, more mechanical items in
  the batch (directly parallels `.toJSON()`'s already-built traversal).
