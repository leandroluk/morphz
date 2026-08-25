# Spec: Additional Primitives (§15)

**Status: Pass 1 DONE (2026-08-25).** T-001..T-003 (9 primitives:
Boolean, BigInt, Decimal, DateOnly, TimeOnly, Duration, Ulid, Nanoid,
Cuid2) implemented + tested (177/177 cumulative pass). 2 real bugs found
and fixed during implementation: `z.codec`'s `decode` does NOT catch
exceptions thrown inside it (verified empirically — even `safeParse`
propagates an uncaught raw error) — `BigInt`'s native `BigInt(str)` throws
a raw `SyntaxError` on malformed input, caught and converted to a proper
Zod issue instead. `PlainDate.addMonths` originally re-stamped the
original day onto the target month without validating overflow (e.g. "Jan
31" + 1 month produced an invalid "Feb 31") — fixed to use `Date.UTC`'s
own day-overflow rollover, same mechanism `addDays` already used.
Pass 2 (Url, Json, Record, Binary, Tuple, SetOf) still pending.

## Summary

Per `INSIGHT.md` §15: 15 new core primitives across 5 groups, all following
the established `FieldDescriptorFactory` pattern (`define-metatypes`) —
mechanical in shape, but several need a new runtime dependency (arbitrary-
precision decimal, ULID/CUID2 generators) or careful Zod-schema choices
(BigInt, Duration parsing, Binary size limits).

## Requirements

### A. Fundamental scalars

- REQ-001: `Boolean(options?)` — `z.coerce.boolean()`-style coercion from
  querystring/payload strings (`"true"`/`"0"` etc.) — confirm exact Zod
  v4 coercion API in Design (`z.coerce.boolean()` vs. manual preprocess).
- REQ-002: `BigInt(options?: {min?, max?})` — wraps `z.bigint()`, native
  JS `bigint` domain value, wire-format as string (JSON has no native
  bigint) — this needs a CODEC (`z.codec`, same pattern as `datetime-codec`),
  not a bare `z.bigint()`, for the same `toJSONSchema()`-representability
  reason `DateTime` isn't bare `z.date()`.
- REQ-003: `Decimal(options?: {precision?, scale?, min?, max?})` — exact
  decimal arithmetic, wire-format as string (`"150.50"`). Needs a real
  arbitrary-precision library dependency (candidates: `decimal.js`,
  `big.js`) — NOT native JS `number` (defeats the whole purpose) — pick
  one in Design.

### B. Specialized dates/times (zero timezone drift)

- REQ-004: `DateOnly(options?)` — `"YYYY-MM-DD"`, domain value TBD (plain
  string vs. a lightweight date-only wrapper type — deciding whether to
  introduce a `PlainDate`-like domain type or keep the string as both
  wire AND domain, since there's no timezone-safe `Date` to decode into
  for a date-only value). Needs a Design decision, not just plumbing.
- REQ-005: `TimeOnly(options?)` — `"HH:mm"`/`"HH:mm:ss"`, similar domain-
  value question as REQ-004.
- REQ-006: `Duration(options?: {default?})` — ISO 8601 (`"PT15M"`) or
  friendly notation (`"15m"`, `"2h"`, `"30d"`) — needs a parser for the
  friendly notation (candidate: `ms` or a custom small parser) since ISO
  8601 duration parsing alone doesn't cover `"30d"`-style shorthand.

### C. Modern high-performance identifiers

- REQ-007: `Ulid(options?)` — needs a `ulid` generator dependency.
- REQ-008: `Nanoid(options?: {length?})` — `nanoid` already used as a
  documented pattern in `define-metatypes`'s recipes (INSIGHT.md §1's
  `ShortId`) but never shipped as an actual dependency — add it for real
  now that it's a first-class primitive, not just a documented recipe.
- REQ-009: `Cuid2(options?)` — needs a `@paralleldrive/cuid2` (or
  equivalent) dependency.

### D. Web/connectivity

- REQ-010: `Url(options?: {protocols?})` — promotes the `define-metatypes`
  §1 `Url` RECIPE (currently `Define(Text, {refine: ...})`-based, hand-
  rolled `URL` parsing) to a first-class core primitive using Zod's own
  `z.url({protocol: ...})` if that covers protocol filtering natively
  (confirm via Context7 in Design) — avoids keeping the hand-rolled
  `refine`-based `URL` parsing now that a first-class primitive exists.

### E. Flexible structures/binary

- REQ-011: `Json<T>(options?)` — generic-typed, accepts arbitrary
  objects/arrays, `z.record`/`z.unknown`-based per the actual shape
  needed — confirm whether `T` flows through to real TS inference (ties
  into the CRITICAL FINDING already flagged — `Struct()` itself isn't
  generic yet, so `Json<T>`'s own generic may be inert until that's fixed;
  document this dependency explicitly, don't pretend it works standalone).
- REQ-012: `Record(KeyType, ValueType, options?)` — wraps `z.record()`,
  both key and value are `FieldDescriptor`s (composable like other
  container primitives).
- REQ-013: `Binary(options?: {maxBytes?, exactBytes?})` — accepts
  `Uint8Array`/`Buffer`/base64 string, size-limit validation. Wire format
  is base64 string (representable in JSON), domain value — decide
  `Uint8Array` vs `Buffer` (Node-specific `Buffer` vs. universal
  `Uint8Array` — recommend `Uint8Array` for runtime-portability, matching
  `morphz`'s general "don't assume Node" posture, though `datetime-codec`
  etc. don't currently need to worry about non-Node runtimes explicitly —
  confirm in Design).
- REQ-014: `Tuple([...FieldDescriptors], options?)` — positional
  heterogeneous, wraps `z.tuple()`.
- REQ-015: `SetOf(ItemType, options?: {minSize?})` — wraps `z.set()` (if
  it exists in Zod v4 — confirm) or a `z.array()` + uniqueness `.refine()`
  fallback, domain value is a real `Set<T>`.

## Affected Components

All live in `packages/core/src/primitives/`, following the exact pattern
already established by `define-metatypes`'s primitives and
`datetime-codec`'s `DateTime`. `BigInt`/`Decimal` specifically need the
SAME codec treatment `DateTime` pioneered (wire string ↔ domain rich
value) — direct reuse of an established pattern, not new architecture.

## Out of Scope

- Retrofit of existing recipes (`define-metatypes`'s documented `Url`
  recipe) into using the new first-class primitives internally — REQ-010
  covers promoting `Url` to core; whether OTHER existing recipes get
  similarly promoted is not decided here (none of the others in §1 have a
  first-class-primitive counterpart yet).
- `mock-fixtures`/`jsdoc-generation`/`data-masking` integration for each
  NEW primitive — these should fall out "for free" from the existing
  `FieldDescriptor`-based mechanisms (constraint introspection, mask,
  toJSON encode) IF each primitive is built correctly against those
  existing contracts — but needs explicit test coverage per primitive in
  Execute, not assumed silently.

## Resolved

- `Decimal` uses `decimal.js` — most configurable precision ceiling and
  most robust rounding-mode support of the common arbitrary-precision
  options (`big.js`/`bignumber.js` are lighter but less feature-complete);
  user explicitly prioritized precision/robustness over dependency size.
- `DateOnly`/`TimeOnly` domain value: custom LIGHTWEIGHT wrapper classes
  (`PlainDate`, `PlainTime`) built in-house — NOT a full `Temporal`
  polyfill dependency (too heavy for what's needed) and NOT a bare string
  (loses the rich-domain-object benefit every other codec-based primitive
  already has). Each wraps the ISO string internally, exposes read
  accessors (`.year`/`.month`/`.day` for `PlainDate`,
  `.hour`/`.minute`/`.second` for `PlainTime`) and basic arithmetic
  (`.addDays()`/`.addMonths()` etc. for `PlainDate`) — scope of exactly
  which methods ship is an Execute-time judgment call, not exhaustively
  specified here; keep it genuinely lightweight, don't scope-creep into a
  full calendar-math library.

## Open Questions

- `Duration`'s friendly-notation parser — reuse an existing library (`ms`,
  `parse-duration`) vs. hand-roll — needs a choice in Design.
- Should `Json<T>`'s generic type parameter be implemented now (inert
  until `Struct()` itself is generic) or deferred until the CRITICAL
  FINDING's generics retrofit lands? Recommend implementing the runtime
  behavior now (works fine at the VALUE level) but flagging the TYPE
  parameter as currently cosmetic/inert in a code comment, rather than
  blocking this whole feature on the (much larger) generics retrofit.
