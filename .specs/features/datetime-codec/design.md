# Design: DateTime/Timestamp as Codec

## Architecture Overview

`DateTime` is a `FieldDescriptorFactory` (same tier as `Text`/`Number` in
`define-metatypes`) wrapping a `z.codec()` pipe. `Timestamp` is a
`define-metatypes`-style recipe over `DateTime` (`Define(DateTime, {
default: () => new Date() })`), not a separate wire/domain shape.

```
wire (JSON/HTTP)              domain (in-memory)
  ISO string                     Date
  z.iso.datetime()  ──decode──►  z.date()
                    ◄──encode──
       │                              │
       ▼                              ▼
 z.toJSONSchema() sees            TimeAgo/TimeBefore/TimeAfter
 ONLY this side → always          (define-metatypes) compare
 { type:'string',                against `new Date()` directly
   format:'date-time' }
```

## `DateTime` implementation

```ts
const DateTimeCodec = z.codec(
  z.iso.datetime(), // wire: strict UTC, 'Z' suffix required — see below
  z.date(), // domain
  {
    decode: (s: string) => new Date(s),
    encode: (d: Date) => d.toISOString(),
  },
);

const DateTime: FieldDescriptorFactory<Date> = (overrides?) => ({
  zodSchema: DateTimeCodec,
  meta: { ...overrides, encode: (d: Date) => d.toISOString() },
});
```

`meta.encode` is set here directly (not left for a caller to add) — this is
the concrete fulfillment of the `meta.encode` hook `lifecycle-
serialization/design.md`'s `.toJSON()` already expects to exist on any
`DateTime`/`Timestamp` field. No further follow-up needed on that design;
this closes it.

## Resolved: timezone handling

Context7-confirmed (`/colinhacks/zod` v4.0.1): `z.iso.datetime()` with NO
options is STRICT — accepts only a `Z`-suffixed (UTC) ISO string, REJECTS
both a numeric offset (`+02:00`) and a local/timezone-less string. `morphz`
uses the bare `z.iso.datetime()` (no `{ offset: true }`, no `{ local: true
}`) as `DateTime`'s wire schema — this is a deliberate constraint, not an
oversight: it forces every `DateTime`/`Timestamp` value across the wire to
be unambiguous UTC, matching `encode`'s `.toISOString()` (which always
produces a `Z`-suffixed UTC string) round-trip exactly. `decode`'s `new
Date(s)` is safe as-is: a `Z`-suffixed string parses to the correct UTC
instant regardless of the runtime's local timezone — no manual
normalization step needed.

## `Timestamp` implementation

```ts
const Timestamp = Define(DateTime, { default: () => new Date() });
```

Literally this one line — per the session's earlier resolution (`Timestamp`
= `DateTime` + baked default), no separate codec, no separate wire/domain
shapes. Uses `Define`'s BaseType-normalization rule from `define-metatypes`
design (`DateTime` referenced bare → called with no args → merged with the
`default` override).

## New Components

| Component   | Responsibility                                                | Location                      |
| ----------- | ------------------------------------------------------------- | ----------------------------- |
| `DateTime`  | Zero-arg-callable `FieldDescriptorFactory` wrapping the codec | `src/primitives/date-time.ts` |
| `Timestamp` | `Define(DateTime, { default: () => new Date() })` recipe      | `src/primitives/timestamp.ts` |

## Dependency Paths

- `DateTime`/`Timestamp` → `Define`'s normalization + merge algorithm
  (`define-metatypes`, already designed) — `Timestamp` is a direct,
  unmodified consumer, no new mechanism needed.
- `meta.encode` → consumed by `lifecycle-serialization`'s `.toJSON()`
  (already designed, was waiting on this).

## Risks

- None new. This feature is the last one owing a follow-up to
  `define-metatypes`'s `FieldDescriptor` shape — with `meta.encode` now
  concretely implemented here (not just reserved as a hook), that
  interface can be treated as fully final for Execute phase.

## Decision Log

- `DateTime`'s wire schema uses NO `z.iso.datetime()` options (strict UTC
  `Z`-only) — chosen over `{ offset: true }` to keep `encode`/`decode`
  round-tripping unambiguous; a project wanting to ACCEPT (not just emit)
  offset strings can still do so via a `Define(DateTime, { refine: ... })`-
  style wrapper or a `FromZodType`-based custom codec, without `morphz`
  needing to support every timezone-handling policy in the core primitive.
- Confirms (no change): `Timestamp` fully resolved by the earlier session
  decision — this design just shows the one-line implementation that
  decision implies.
