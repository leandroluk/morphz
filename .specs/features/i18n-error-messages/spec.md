# Spec: Custom Error Messages & i18n

## Summary

Error messages are built on Zod's native issue tree (`error.issues`: `path`,
`code`, `message`, plus a `format` sub-field on format-check issues). `Define`
accepts a `message` option to override the default text per validation rule —
either a fixed string or an i18n map keyed by locale. The override mechanism
is schema-agnostic: it walks `error.issues` post-parse and matches by
`(path, code[, format])` against what was registered on the `Define` for that
field, with a fallback to Zod's raw message when no override exists. This
same mechanism transparently supports `FromZodType`-wrapped schemas.

**Correction to INSIGHT.md:** the doc's example key `regex` is NOT a real
Zod v4 issue code (verified via Context7 against `/colinhacks/zod` v4.0.1).
Zod v4's actual `ZodIssueCode` enum is: `invalid_type`, `too_big`,
`too_small`, `invalid_format`, `not_multiple_of`, `unrecognized_keys`,
`invalid_union`, `invalid_key`, `invalid_element`, `invalid_value`, `custom`.
Regex/email/uuid/url/etc. failures all share ONE code, `invalid_format`, and
are distinguished by an issue-level `format` string (`'regex'`, `'email'`,
`'uuid'`, ...). REQ-001 below reflects the corrected shape.

## Requirements

- REQ-001: `Define(BaseType, { message })` accepts `message` as either
  `string` (fixed, locale-independent) or a per-code map:
  `{ [zodIssueCode]: string | Record<locale, string> | Record<formatString,
string | Record<locale, string>> }`. For every code EXCEPT
  `invalid_format`, the value is the string/locale-map directly (e.g.
  `invalid_type: { 'pt-BR': '...' } `). For `invalid_format` specifically,
  since one field can only realistically fail one format check in practice
  (a `Text`-based `Define` has exactly one `regex`/`refine`-driven format),
  the value MAY be given directly (`invalid_format: {...}`) as a shorthand —
  `morphz` does not require callers to nest under the format name when a
  field has only one format check, per REQ-004's matching rule below.
- REQ-002: Per-field override at declaration site: `email: Email({ message:
{ invalid_format: { 'pt-BR': '...' } } })` merges with (overrides) the
  `Define`-level `message` map for that specific field instance, without
  mutating the shared `Define` factory's defaults.
- REQ-003: Active locale resolves from `morphz.config.ts`
  (`defineConfig({ locale: { default, fallback } })`) or from an
  `AsyncLocalStorage`/request-scoped context — callers must not need to pass
  locale explicitly to `.parse()`/`.safeParse()` on every call.
- REQ-004: Post-parse, for each issue in `error.issues`: resolve `path` to
  the originating field, look up that field's `Define`'s `message[code]`; if
  found, substitute the issue's `message` (resolving locale + fallback per
  REQ-003); if not found, leave Zod's original message untouched. This never
  throws — absence of a mapping is not an error condition.
- REQ-005: The `(path, code)` mechanism works for `FromZodType`-wrapped
  schemas at the field's root path with zero special-casing, since it never
  inspects the wrapped schema's internal structure — only `path`/`code` on
  the final issue.
- REQ-006: Documented limitation (not a bug): for a `FromZodType`-wrapped
  _composite_ schema (nested `z.object`/`z.tuple`/`z.array`), issues at a
  deeper path (e.g. `['coordinates', 0]`) do NOT match the field-level
  `message` map (which only has entries for the field as a scalar unit) and
  fall back to Zod's raw message. Deep-level custom messages must be set
  directly on the wrapped Zod schema (`.meta()`/native message) before
  passing it to `FromZodType`.

## Affected Components (from graph)

N/A — greenfield. Depends on `define-metatypes` (the `message` option shape
lives on `Define`). Cuts across every feature that produces `ValidationError`
output (`lifecycle-serialization`'s `.safeParse()` result).

## Out of Scope

- Translating Zod's own built-in message _strings_ wholesale (e.g. shipping
  a full i18n bundle for every Zod built-in) — `morphz` only provides the
  override mechanism; translation content is the consumer's responsibility
  except for the recipe types documented in INSIGHT.md.
- Locale detection/negotiation from HTTP headers, etc. — consumer wires the
  `AsyncLocalStorage` context; `morphz` only reads from it.

## Resolved

- REQ-003 fallback: if neither the requested locale nor `fallback` has an
  entry, the lookup returns `undefined` — treated identically to "no
  override registered," falls back to Zod's raw message. Never throws a
  config error, consistent with REQ-004's guarantee. Zero-config locale
  default (no `morphz.config.ts`, no request context) hard-codes to
  `'en-US'`.
- Issue code taxonomy confirmed via Context7 (`/colinhacks/zod` v4.0.1):
  `invalid_type`, `too_big`, `too_small`, `invalid_format`,
  `not_multiple_of`, `unrecognized_keys`, `invalid_union`, `invalid_key`,
  `invalid_element`, `invalid_value`, `custom`. `regex` from INSIGHT.md's
  example does not exist as a code — folded into `invalid_format` (see
  Summary correction and REQ-001).
- Array item paths (`List(Text())`, issue at `['tags', 2]`) and
  `FromZodType` composite internals: NO special handling, fall back to raw
  Zod message — there's no registered field descriptor for a list item
  index or the internals of an opaque wrapped schema.
- **Refined during Design** (`i18n-error-messages/design.md`): the above
  does NOT extend to `Embed`/`Ref` targets. Those point at another `morphz`
  `Struct` with its own fully-populated field registry, so a deeper path
  (`['address', 'zipCode']`) DOES resolve — the matcher recurses through
  each path segment as long as it lands on a field that points at another
  introspectable `morphz` `Struct` (`Embed`/`Ref`), and only falls back once
  it hits something `morphz` has no structural knowledge of (a `List` item,
  `FromZodType` internals). One rule — "recurse while introspectable" — not
  "never recurse."
