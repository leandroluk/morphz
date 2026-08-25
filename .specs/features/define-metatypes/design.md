# Design: Define & Meta-Types (foundation)

## Architecture Overview

`morphz` is a thin OO/class-safety layer over Zod v4 — it never re-implements
validation, it composes Zod schemas and attaches metadata. The foundation is
one uniform internal shape, `FieldDescriptor`, produced by every core
primitive and by `Define`. Everything downstream (`Struct`, `Ref`, `FieldOf`,
i18n) consumes `FieldDescriptor`, never a raw Zod schema directly.

```
                 ┌────────────────────┐
 core primitives │ Text, Number, Uuid, │   each: (args?) => FieldDescriptor
 (zero-arg call) │ DateTime, Ip, ...   │
                 └─────────┬──────────┘
                           │ passed as BaseType (called or bare)
                           ▼
                 ┌────────────────────┐
                 │      Define()      │   normalizes BaseType → base descriptor
                 │  (BaseType, opts)  │   merges opts → returns a NEW factory
                 └─────────┬──────────┘
                           │ factory(instanceOverrides?) => FieldDescriptor
                           ▼
                 ┌────────────────────┐
                 │  field descriptor  │   consumed by Struct's field record
                 │  { zodSchema, meta }│
                 └────────────────────┘
```

## Core internal shape: `FieldDescriptor`

```ts
interface FieldDescriptor<T = unknown> {
  zodSchema: z.ZodType<T>; // fully-built Zod schema, checks baked in
  meta: {
    description?: string; // may still contain unresolved #placeholders
    default?: T | (() => T);
    immutable?: boolean;
    examples?: T[];
    writeOnly?: boolean; // resolved by lifecycle-serialization design:
    // .toJSON() skips fields where this is true
    message?: MessageMap; // see i18n-error-messages spec
    encode?: (val: T) => unknown; // set concretely by DateTime/Timestamp
    // (datetime-codec) — .toJSON()'s hook for
    // codec-encoding (Date -> ISO string)
  };
  itemDescriptor?: FieldDescriptor; // set by List() only — added during
  // lifecycle-serialization design so .toJSON()
  // knows how to encode each array item
  targetStruct?: () => StructClass; // set by Embed()/Ref() only — added during
  // i18n-error-messages design for recursive
  // message resolution, reused by .toJSON()
}
```

`zodSchema` already has `.regex()`/`.refine()`/etc. applied — `Struct` never
re-derives validation from `meta`, it only reads `meta` for
description-templating, `message` lookup, and `immutable` enforcement.

## `Define(BaseType, options)` normalization algorithm

This resolves the two call shapes seen in INSIGHT.md
(`Define(Text, {...})` vs. `Define(Ip({version:'v4'}), {...})`) with ONE
rule:

```ts
function Define(base: FieldDescriptorFactory | FieldDescriptor, options) {
  const baseDescriptor = typeof base === "function" ? base() : base;
  const merged = mergeDescriptor(baseDescriptor, options);

  return function specialized(instanceOverrides?) {
    return mergeDescriptor(merged, instanceOverrides);
  };
}
```

- If `base` is still a **callable factory** (`Text`, `Number`, `DateTime`,
  `Uuid` — referenced bare, not invoked), `Define` calls it with no
  arguments to obtain that primitive's zero-arg default descriptor.
- If `base` is already an **invoked descriptor** (`Ip({version:'v4'})`,
  `Nullable(DateTime)`, `Version({type:'incr'})`, `FromZodType(zodSchema)`,
  or even another `Define`'s output called with its own args), `Define`
  uses it as-is.

This single branch covers every example in INSIGHT.md §1 without a special
case per primitive. Every core primitive (`Text`, `Number`, ...) MUST be
implemented as a function so this branch works uniformly — see New
Components below.

## `mergeDescriptor(base, overrides)` semantics

- `description`, `default`, `immutable`, `examples`, `writeOnly`: shallow
  overwrite — `overrides[key]` replaces `base[key]` when present.
- `message`: **deep merge per issue code** (and per `format` string under
  `invalid_format`, see `i18n-error-messages`) — `overrides.message.regex`
  augments/replaces only that key, `base.message.invalid_type` survives
  untouched if `overrides.message` doesn't mention it. This is required by
  INSIGHT.md §5's example (`Email({ message: { invalid_format: {...} } })`
  overrides only the format message, keeps `Email`'s own `invalid_type`
  message from its `Define`).
- `zodSchema`: rebuilt, not merged — `regex`/`refine`/`default` in
  `overrides` are re-applied onto `base.zodSchema` via Zod's chaining
  (`.refine()` per Context7 confirmation: Zod v4 `.refine()` clones the
  schema and appends to its internal checks array, no wrapper class, so
  chaining from an already-`Define`d schema is safe and composable).

## `refine` adapter (Zod API mismatch)

INSIGHT.md's `refine` convention returns `true | string` (string IS the
failure message). Zod v4's native `.refine(validator, params)` wants a
truthy/falsy return and a SEPARATE `params.message`. `Define` must adapt:

```ts
function toZodRefine(refineFn: (val, opts?) => true | string, opts?) {
  return (val: unknown) => {
    const result = refineFn(val, opts);
    return result === true; // truthy/falsy for Zod; message handled below
  };
}
```

The string returned by `refineFn` on failure becomes that field's `custom`
issue message (Zod's `.refine()` supports a `message` function of `(data) =>
RefineParams`, so the adapter re-invokes `refineFn` inside the message
callback, or caches the last-computed message — implementation detail for
Execute phase, not a design blocker).

## `refine` runtime args (`TimeAgo({ within: '30d' })`)

`opts` in `refine(val, opts)` come from the field-declaration-site call
(`TimeAgo({ within: '30d' })`), NOT from `Define`-time. This means the final
`.refine()` check must be attached at `specialized(instanceOverrides)` time
(inside the factory `Define` returns), not baked into `merged` — `merged`
only carries the refine FUNCTION, `specialized()` closes over
`instanceOverrides` and binds it into the Zod `.refine()` call at that point.

## New Components

| Component                                                                                                                | Responsibility                                                                   | Location                       |
| ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ------------------------------ |
| `FieldDescriptor` type                                                                                                   | Uniform shape: Zod schema + morphz metadata                                      | `src/core/field-descriptor.ts` |
| `Define()`                                                                                                               | Normalizes BaseType, merges options, returns specialized factory                 | `src/core/define.ts`           |
| `mergeDescriptor()`                                                                                                      | Shallow-overwrite + deep-merge-`message` combinator                              | `src/core/merge-descriptor.ts` |
| `toZodRefine()` adapter                                                                                                  | Bridges `true \| string` convention to Zod's `.refine()` API                     | `src/core/refine-adapter.ts`   |
| Core primitives (`Text`, `Number`, `Uuid`, `Email`, `Password`, `Ip`, `Enum`, `Version`, `Nullable`, `Optional`, `List`) | Zero-arg-callable `FieldDescriptorFactory`s wrapping the matching Zod v4 builder | `src/primitives/*.ts`          |
| `FromZodType()`                                                                                                          | Wraps an arbitrary Zod schema into a `FieldDescriptor` (empty `meta`)            | `src/core/from-zod-type.ts`    |

`DateTime`/`Timestamp` are NOT built here — they're the `datetime-codec`
feature's responsibility; this feature only requires they exist as
zero-arg-callable factories by the time `define-metatypes`' recipe examples
(`TimeAgo`, `RowVersion`, etc.) are implemented.

## Dependency Paths

- REQ-001/002 (`Define` factory) → `mergeDescriptor` → core primitive
  factories (new, no existing code).
- REQ-003 (`refine` single-field only) → enforced structurally: `refine`'s
  signature only ever receives `(val, opts?)`, never `ctx`/full object —
  there is no code path that could pass the parent object even by mistake,
  since `Struct`'s `post` hook (separate feature) is the only place `ctx`
  exists.
- REQ-007 (`FromZodType`) → thin wrapper, no dependency on other new code.

## Risks

- No graph/existing code — every component here is net-new. Main risk is
  internal API churn once `struct-entities` and `entity-relationships` are
  designed and start consuming `FieldDescriptor` — if their needs don't fit
  the shape above, this design may need a revision pass. Flagged for
  re-check at the start of `struct-entities` design.
- The `refine`-as-`true|string` adapter is the one place `morphz` diverges
  from calling Zod's API directly (everywhere else it's a thin pass-through)
  — slightly higher implementation/test surface than the rest of this
  feature.

## Decision Log

- Uniform `FieldDescriptor` shape (Zod schema + `meta`) chosen over
  per-primitive-type distinct shapes — keeps `Struct`/`Define`/`FromZodType`
  code paths identical, matches the "mirror Zod, don't invent" principle
  agreed with the user.
- `Define`'s BaseType normalization (call-if-function, else use-as-is) was
  derived by reconciling ALL of INSIGHT.md §1's examples against one rule,
  rather than special-casing "bare primitive" vs. "parameterized instance"
  — confirmed it covers every documented case (`Cep`, `PublicIp`, `TimeAgo`,
  `RowVersion`, `ShortId`).
- Verified via Context7 (`/colinhacks/zod` v4.0.1) that `.refine()` in Zod v4
  clones-and-appends rather than wrapping in `ZodEffects` — confirms
  `Define`'s chain-refinements-onto-base-schema approach is safe and doesn't
  lose earlier checks (a v3-era concern that no longer applies).
- `message` map's real issue-code taxonomy corrected against INSIGHT.md
  (`regex` → `invalid_format` + `format` sub-key) — see
  `i18n-error-messages` spec.md for the full correction; `Define`'s
  `mergeDescriptor` message-merge logic is written against the CORRECTED
  shape, not INSIGHT.md's literal example.
