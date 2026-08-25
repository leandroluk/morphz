# Tasks: Additional Primitives

Split into 2 DEV/QA passes given the size (15 primitives).

**Pass 1 status: DONE (2026-08-25).** T-001..T-003 implemented + tested
(183/183 cumulative pass, incl. 6 integration tests). **4 real bugs found
and fixed in shared `mock.ts`** (affects EVERY feature that declares
codec-based `examples`/`default`, not just this one):
1. `mock.ts`'s pipe-handling didn't distinguish real `z.codec` (useful
   wire schema in `def.in`) from `z.preprocess` (`Boolean` uses this —
   `def.in` is an opaque `transform` schema) — now checks `def.in`'s own
   type, synthesizes from `def.out` when it's a `"transform"`.
2. `mock.ts` was feeding `meta.examples`/`meta.default` (DOMAIN-typed
   values) straight into the constructor as raw WIRE input — broke any
   codec field declaring `examples`/`default` (`BigInt`, `Decimal`,
   `DateOnly`, `TimeOnly`, `Duration`, and even v1's `Timestamp`). Fixed:
   applies `meta.encode` before use, when present.
3. `BigInt`/`Decimal` used `z.string().refine()` with no `.regex()` — the
   mock synthesizer had no pattern to generate from. Switched to
   `.regex()` (same validation, now visible to the synthesizer).
4. `decimal.js` defaults to scientific notation in `.toString()` for
   large numbers (`toExpPos`/`toExpNeg` ±21) — broke round-trip when
   `RandExp` generated long digit strings. Fixed via an isolated
   `Decimal.clone({toExpPos: 9e15, toExpNeg: -9e15})` (doesn't affect
   other `decimal.js` consumers). Also added `'time'` to
   `CANONICAL_FORMAT_EXAMPLES` (was missing, broke `TimeOnly`) and a
   default `examples` for `Duration` (its wire side has no regex to
   synthesize from — can't constrain one without breaking the dual
   ISO/friendly-notation acceptance).

Pass 2 (T-004/T-005 — Url, Json, Record, Binary, Tuple, SetOf) not yet
started.

## Pass 1 — Groups A, B, C (9 primitives)

## T-001: Fundamental scalars

- **REQ**: REQ-001, REQ-002, REQ-003
- **What**: `Boolean()` (coercion), `BigInt()` (codec, string wire ↔
  bigint domain), `Decimal()` (codec, string wire ↔ `decimal.js` domain,
  precision/scale options).
- **Where**: `src/primitives/boolean.ts`, `bigint.ts`, `decimal.ts`
- **Gate**: `npx vitest run -- boolean bigint decimal`

## T-002: Specialized dates/times

- **REQ**: REQ-004, REQ-005, REQ-006
- **What**: `PlainDate`/`PlainTime` lightweight wrapper classes (own file),
  `DateOnly()`/`TimeOnly()` (codec, ISO string wire ↔ wrapper domain),
  `Duration()` (codec, accepts ISO 8601 OR `ms`-parseable friendly
  notation on decode, always encodes to canonical ISO 8601 string; domain
  value = milliseconds number). Hand-roll a minimal ISO 8601 duration
  parser/formatter (`PnYnMnDTnHnMnS` grammar) — no dependency covers both
  directions, `ms` only handles the friendly notation.
- **Where**: `src/core/plain-date.ts`, `plain-time.ts`,
  `src/primitives/date-only.ts`, `time-only.ts`, `duration.ts`
- **Depends on**: none (independent of T-001)
- **Gate**: `npx vitest run -- date-only time-only duration plain-date plain-time`

## T-003: Modern identifiers

- **REQ**: REQ-007, REQ-008, REQ-009
- **What**: `Ulid()`, `Nanoid({length?})`, `Cuid2()` — each a `Text`-based
  primitive with a `default` thunk calling the respective generator.
- **Where**: `src/primitives/ulid.ts`, `nanoid.ts`, `cuid2.ts`
- **Depends on**: none
- **Gate**: `npx vitest run -- ulid nanoid cuid2`

## Pass 2 — Groups D, E (6 primitives)

## T-004: Web

- **REQ**: REQ-010
- **What**: `Url({protocols?})` — first-class primitive using Zod's
  `z.url()` with protocol filtering (confirm exact API via Context7 or
  `node_modules/zod` inspection first).
- **Where**: `src/primitives/url.ts`
- **Gate**: `npx vitest run -- url`

## T-005: Flexible structures/binary

- **REQ**: REQ-011, REQ-012, REQ-013, REQ-014, REQ-015
- **What**: `Json<T>()`, `Record(KeyType, ValueType)`, `Binary({maxBytes?,
exactBytes?})` (base64 wire ↔ `Uint8Array` domain codec),
  `Tuple([...FieldDescriptors])`, `SetOf(ItemType, {minSize?})` (domain =
  real `Set<T>`).
- **Where**: `src/primitives/json.ts`, `record.ts`, `binary.ts`, `tuple.ts`, `set-of.ts`
- **Gate**: `npx vitest run -- json record binary tuple set-of`

**Total**: 5 tasks across 2 passes. Update `src/index.ts` exports after
each pass.
