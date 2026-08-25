# Design: Entity Relationships (`Ref`, `FieldOf`, `Union`)

## Architecture Overview

All three primitives produce the same `FieldDescriptor` shape from
`define-metatypes` — no special-casing anywhere else in the pipeline
(`struct-entities`'s field assembly already treats every field uniformly by
reading `.zodSchema`). `Ref` and `FieldOf` both read from `STRUCT_META`
(`struct-entities`'s internal registry) but at different times: `Ref` reads
it LAZILY (thunk, deferred to first parse), `FieldOf` reads it EAGERLY
(synchronously, at declaration time) — this is the entire technical
difference behind INSIGHT.md's "lazy vs. not lazy" distinction.

```
Ref(() => Post)                          FieldOf(User, 'id')
     │                                          │
     ▼                                          ▼
z.lazy(() => Post[STRUCT_META].schema    User[STRUCT_META].fields['id']
  .transform(d => new Post(d)))
     │  (thunk unresolved until           (read NOW — User must already
     │   Zod actually validates)           be fully declared)
     ▼                                          ▼
FieldDescriptor{ zodSchema: lazy }       FieldDescriptor (cloned) + options
                                          merged via mergeDescriptor()
```

## `Ref(() => Struct)` — lazy resolution

`zodSchema = z.lazy(() => { const S = thunk(); return
S[STRUCT_META].schema.transform(data => new S(data)) })`. Per the
correction made during `lifecycle-serialization` design,
`STRUCT_META.schema` itself carries no instantiation transform — `Ref`
appends its own, same as `Embed` does, binding to the concrete class `S`
resolved by the thunk (not `this`/polymorphic, since — like `Embed` — `Ref`
always knows its concrete target at resolution time). `targetStruct: thunk`
is set directly on the descriptor (added during `i18n-error-messages`
design — the SAME thunk `Ref` already has covers this, since by the time an
error-message lookup needs to descend into it, the thunk is guaranteed
resolvable). Context7 confirms
`z.lazy(fn)` is still the v4 mechanism for deferred/circular schema
resolution — `fn` isn't invoked until Zod actually needs the schema during a
`.parse()` call, by which point ALL modules have finished loading and every
`Struct`-produced class (including a self-referencing one) has its
`STRUCT_META` fully populated.

**Resolves spec.md's open question on self-reference:** YES, `Ref` supports
self-reference (`parent: Optional(Ref(() => Category))` inside `Category`
itself) with zero extra work — the thunk-plus-`z.lazy()` design is exactly
what makes this safe. At the moment `Struct({ parent: Optional(Ref(() =>
Category)) }, {...})` executes, `Category` is still in its declaration's
temporal dead zone, but the ARROW FUNCTION body (`() => Category`) isn't
evaluated yet — only invoked later, after `class Category extends
Struct(...) {}` has fully bound the `Category` identifier.

Cardinality: `Ref` bare = 1:1, `Optional(Ref(...))` = optional 1:1,
`Optional(List(Ref(...)))` = 1:N — all via the SAME `List`/`Optional`
wrappers already built in `struct-entities`, no new composition primitive
needed (confirms spec.md REQ-002 as designed).

## `FieldOf(Struct, 'fieldName', options?)` — eager field-shape reuse

Reads `Struct[STRUCT_META].fields['fieldName']` directly — this MUST be
fully populated already, which is guaranteed by JS module evaluation order
(the referenced `Struct` class's `class X extends Struct(...) {}` must have
already executed by the time `FieldOf(X, ...)` is called, otherwise
`X[STRUCT_META]` doesn't exist yet — this is a real ordering constraint, not
just a design suggestion).

**Resolves spec.md REQ-004 (inheritance scope):** `FieldOf` clones the
SOURCE field's FULL `FieldDescriptor` — `zodSchema` (including any
`regex`/`refine` baked in) AND `meta` — then merges `options` on top via the
SAME `mergeDescriptor()` from `define-metatypes` (shallow overwrite for
`description`/`default`/etc., deep merge per-code for `message`). Rationale:
the whole point of `FieldOf` per INSIGHT.md §4 is "same type as `User.id`,
same guarantees" for a scalar FK — inheriting only the bare Zod type
(dropping `regex`/`refine`) would silently weaken that guarantee. `default`
is the one exception worth flagging: cloning `PrimaryKey`'s `default: () =>
crypto.randomUUID()` onto `Post.userId` would be wrong (a FK isn't
self-generating) — `FieldOf`'s clone step explicitly DROPS `meta.default`
and `meta.immutable` from the source (an FK is neither auto-generated nor
inherently immutable just because the referenced PK is); `options` may
re-add either explicitly if the specific use case needs it.

**Resolves spec.md's runtime-error open question:** if `'fieldName'` isn't a
key in `Struct[STRUCT_META].fields`, `FieldOf` throws synchronously,
immediately, at the `FieldOf(...)` call site (module load time — fails
fast, same phase as the mistake was made, never deferred to first parse).
TS-level safety via `keyof StructFields<Struct>` is achievable since
`STRUCT_META.fields` is a typed record on the class — flagged as an Execute-
phase typing task, not a design blocker.

## `Union([...members], options?)` — mirrors Zod's own applicability rule

Per the earlier resolution (mirror Zod exactly, no `morphz`-specific
heuristic), the detection algorithm is:

```ts
function resolveUnion(members: FieldDescriptor[]) {
  const objectMembers = members.filter((m) => isZodObject(m.zodSchema));
  const allAreObjects = objectMembers.length === members.length;
  const sharedKey = allAreObjects ? detectDiscriminatorKey(objectMembers) : null;

  return sharedKey
    ? z.discriminatedUnion(
        sharedKey,
        objectMembers.map((m) => m.zodSchema),
      )
    : z.union(members.map((m) => m.zodSchema));
}
```

- `isZodObject`: every `Struct`-produced `FieldDescriptor.zodSchema` IS a
  `ZodObject`-based pipeline underneath (see `struct-entities` design) — but
  the pipeline includes `pre`/`post`/`.transform()` wrapping, so
  `isZodObject` must check the UNDERLYING object shape
  (`STRUCT_META.rawObjectSchema`, already exposed by `struct-entities`'s
  registry design for exactly this kind of introspection need), not the
  full transformed pipeline. A bare `Literal(value)` (wrapping `z.literal`)
  is never a `ZodObject` and always fails this check → forces plain union.
- `detectDiscriminatorKey`: finds a key present in every member's raw object
  shape where each member's value at that key is a distinct
  `z.literal(...)`. Zero or more than one candidate key, or non-distinct
  literal values → `null` → plain union.
- When a `sharedKey` IS found, `morphz` still calls Zod's
  `z.discriminatedUnion(key, options)` with the EXPLICIT key (not relying on
  v4's auto-detect-if-omitted feature, confirmed available via Context7) —
  explicit is preferred internally since `morphz` already computed it
  during its own structural check; no reason to make Zod redo that work or
  risk its auto-detection disagreeing with `morphz`'s.

This resolves the mixed-member question definitively: `Union([Literal(...),
StructWithDiscriminator])` — `Literal` fails `isZodObject`, `allAreObjects`
is `false`, falls straight to plain `z.union`. No special mixed-case logic
needed; it falls out of the same structural check used for the all-`Struct`
case.

## `Literal(value)`

Thin wrapper: `FieldDescriptor { zodSchema: z.literal(value), meta: {} }`.
No `Define`-based specialization needed or expected — it's a leaf primitive,
same tier as `Text`/`Number` in `define-metatypes`, but scoped to this
feature since its only real use in INSIGHT.md is as a `Union` member.

## New Components

| Component                             | Responsibility                                                                                                     | Location               |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| `Ref()`                               | Lazy `FieldDescriptor` via `z.lazy()` reading target `STRUCT_META.schema`                                          | `src/core/ref.ts`      |
| `FieldOf()`                           | Eager clone of a source field's `FieldDescriptor` (minus `default`/`immutable`) + `mergeDescriptor` with `options` | `src/core/field-of.ts` |
| `Union()`                             | Structural discriminator detection + `z.discriminatedUnion`/`z.union` dispatch                                     | `src/core/union.ts`    |
| `Literal()`                           | Thin `z.literal()` wrapper                                                                                         | `src/core/literal.ts`  |
| `detectDiscriminatorKey()` (internal) | Shared-literal-key detection over raw object shapes                                                                | `src/core/union.ts`    |

## Dependency Paths

- `Ref`/`FieldOf` → `STRUCT_META` (from `struct-entities` design) —
  `STRUCT_META.rawObjectSchema` specifically is what makes `Union`'s
  discriminator detection possible without re-parsing the full pipeline.
- `FieldOf` → `mergeDescriptor()` (from `define-metatypes`) — reused
  verbatim, no new merge logic.

## Risks

- Confirms `STRUCT_META` as the cross-feature God Node flagged in
  `struct-entities/design.md` — THREE of its four fields
  (`schema`, `rawObjectSchema`, `fields`) are now load-bearing for this
  feature alone. Any future change to `STRUCT_META`'s shape must be checked
  against `Ref`, `FieldOf`, AND `Union`'s designs, not just
  `struct-entities`'s own.
- `FieldOf`'s ordering constraint (source `Struct` must already be declared)
  is a real footgun for co-located/alphabetically-sorted file structures —
  worth a clear runtime error message (not just a generic `undefined` crash)
  pointing at "declare `User` before `FieldOf(User, ...)`."

## Decision Log

- `FieldOf` clones the FULL descriptor but explicitly strips `default`/
  `immutable` from the source — resolves spec.md REQ-004, prevents an FK
  field from silently inheriting a PK's self-generation/immutability
  semantics it shouldn't have.
- `Union`'s discriminator detection always operates on
  `STRUCT_META.rawObjectSchema` (pre-transform), never the full pipeline —
  necessary because `Struct`'s pipeline wraps the object in
  `preprocess`/`superRefine`/`transform`, none of which are `ZodObject`
  instances themselves.
- Chose to always pass an explicit key to `z.discriminatedUnion()` (never
  relying on v4's auto-detect) since `morphz` already computed it doing its
  own applicability check — avoids doing the same detection work twice via
  two different code paths that could theoretically disagree.
