# Tasks: Additional Primitives

Split into 2 DEV/QA passes given the size (15 primitives).

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
