# Tasks: Define & Meta-Types (foundation)

_(PO breakdown, from spec.md + design.md)_

**Status: DONE (2026-08-25).** All 6 tasks implemented (DEV) + tested (QA,
25/25 passing, `tsc --noEmit` clean). QA fixed a real bug: `.refine()`'s
`params` must use zod v4's actual `{ error: (issue) => string }` shape (the
issue object, not the raw value) — `message`/value-fn from v3-era docs
silently produced generic "Invalid input" instead of custom messages. See
`src/core/refine-adapter.ts` + `src/core/define.ts`.

## T-001: `FieldDescriptor` type + `mergeDescriptor()`

- **REQ**: REQ-002
- **What**: `FieldDescriptor<T>` interface (`zodSchema`, `meta`) per design.md
  (including `itemDescriptor`, `targetStruct` slots reserved for later
  features). `mergeDescriptor(base, overrides)`: shallow overwrite for
  `description`/`default`/`immutable`/`examples`/`writeOnly`, deep merge
  per-code (and per-`format` under `invalid_format`) for `message`.
- **Where**: `src/core/field-descriptor.ts`, `src/core/merge-descriptor.ts`
- **Depends on**: none
- **Done when**: unit tests cover shallow overwrite + message deep-merge
  (overriding one code doesn't drop another).
- **Gate**: `npm run test -- merge-descriptor`

## T-002: `toZodRefine()` adapter

- **REQ**: REQ-002 (refine convention)
- **What**: adapts `(val, opts?) => true | string` into Zod's
  `.refine(validator, params)` shape (truthy/falsy + separate message).
- **Where**: `src/core/refine-adapter.ts`
- **Depends on**: none
- **Done when**: a refine returning a string produces a `custom` issue with
  that string as message; returning `true` passes.
- **Gate**: `npm run test -- refine-adapter`

## T-003: `Define()` factory

- **REQ**: REQ-001
- **What**: BaseType normalization (call if function, else use as-is) +
  `mergeDescriptor` + deferred `refine`/runtime-opts binding at
  `specialized(instanceOverrides)` call time.
- **Where**: `src/core/define.ts`
- **Depends on**: T-001, T-002
- **Done when**: `Define(Text, {...})` and `Define(Ip({version:'v4'}), {...})`
  both work per design.md's normalization rule; `TimeAgo({within:'30d'})`-
  style runtime opts reach `refine`.
- **Gate**: `npm run test -- define`

## T-004: Core primitives

- **REQ**: REQ-006
- **What**: `Text`, `Number`, `Uuid`, `Email`, `Password`, `Ip`, `Enum`,
  `Version`, `Nullable`, `Optional`, `List` — each a zero-arg-callable
  `FieldDescriptorFactory`.
- **Where**: `src/primitives/*.ts`
- **Depends on**: T-001
- **Done when**: each primitive's zero-arg call produces a valid
  `FieldDescriptor` whose `zodSchema` round-trips `.parse()` correctly.
- **Gate**: `npm run test -- primitives`

## T-005: `FromZodType()`

- **REQ**: REQ-007
- **What**: wraps an arbitrary Zod schema into `FieldDescriptor` (empty
  `meta`).
- **Where**: `src/core/from-zod-type.ts`
- **Depends on**: T-001
- **Done when**: `FromZodType(z.tuple([...]))` produces a descriptor usable
  as `Define`'s `BaseType`.
- **Gate**: `npm run test -- from-zod-type`

## T-006: `writeOnly` flag on `meta`

- **REQ**: (lifecycle-serialization follow-up, landed on this feature's shape)
- **What**: confirm `meta.writeOnly?: boolean` is accepted/propagated by
  `Define`/`mergeDescriptor` (already in T-001's type, this task is the
  explicit test coverage for it).
- **Where**: `src/core/field-descriptor.ts` (type only, already covered by T-001)
- **Depends on**: T-001
- **Done when**: `Password({ writeOnly: true })`-style descriptor carries
  `meta.writeOnly === true`.
- **Gate**: `npm run test -- field-descriptor`

**Total**: 6 tasks (T-004/T-005 parallelizable `[P]` after T-001/T-002).
