# Design: Class Extensibility (`.extend()`, `.omit()`, `.pick()`, `.partial()`)

## Architecture Overview

Two genuinely different mechanisms, chosen per-method based on whether the
result is a SUPERSET of the parent's shape (`.extend()` — real `instanceof`
relationship makes sense) or a SUBSET/reshape (`.omit()`/`.pick()`/
`.partial()` — `instanceof` the source would be semantically wrong, a
`CreatePostDto` missing `id` is NOT a `Post`).

```
.extend(newFields)                    .omit()/.pick()/.partial()
       │                                      │
       ▼                                      ▼
class extends ParentClass {}          buildStructClass(...)  — INDEPENDENT
  (real JS subclassing —                class, no prototype
   instanceof ParentClass                chain to the source
   holds transitively)                   (instanceof source does NOT hold)
       │                                      │
       ▼                                      ▼
STRUCT_META.schema =                  STRUCT_META.schema =
  parentRawObjectSchema                 derivedRawObjectSchema
  .extend(newFieldsShape)               (.omit/.pick/.partial, native
  wrapped w/ parent's pre/post          Zod, immutable fields patched
                                         to z.undefined().optional())
                                         wrapped w/ SAME pre/post
```

## Required addition to `struct-entities`'s `STRUCT_META`

Both branches need to REBUILD the `pre`/`post`-wrapped pipeline around a
NEW raw object schema. `STRUCT_META` (as designed) stores the already-built
`schema`/`rawObjectSchema` but not the original hook FUNCTIONS — needed so
this feature can re-wrap. Small additive follow-up:

```ts
interface StructMeta {
  // ...existing fields...
  hooks: { pre?: (val: unknown) => unknown; post?: (val: unknown, ctx) => void };
}
```

Flagged here, applied as a follow-up edit to
`struct-entities/design.md`'s `StructMeta` interface (same pattern as the
`targetStruct`/`writeOnly`/`encode`/`itemDescriptor` additions already made
by later-designed features).

## `.extend(newFields)`

```ts
static extend(newFields: Record<string, FieldDescriptor>) {
  const parentMeta = this[STRUCT_META]
  const resolvedNewFields = resolveTemplates(newFields, parentMeta.labels) // same
                                                                             // resolver struct-entities built
  const rawObjectSchema = parentMeta.rawObjectSchema.extend(
    toZodShape(resolvedNewFields)
  )
  return buildStructClass({
    extendsClass: this,               // real `class extends this` — see below
    rawObjectSchema,
    hooks: parentMeta.hooks,          // reused verbatim, not re-specified
    fields: { ...parentMeta.fields, ...resolvedNewFields },
    labels: parentMeta.labels,
    description: parentMeta.description,
  })
}
```

`buildStructClass({ extendsClass: this, ... })` emits a real
`class extends this { ... }` — this is the ONE case where the internal
class-builder (also used by `Struct()` itself) takes an explicit parent to
subclass, rather than building a fresh, prototype-independent class. This is
what makes `admin instanceof AdminUser` AND `admin instanceof User` both
hold: `AdminUser extends User.extend({...})`, and `User.extend({...})`
itself `extends User` — `instanceof` is transitive through the whole chain
for free, standard JS semantics, no `morphz`-specific magic needed.

Zod's native `ZodObject.extend()` (confirmed available in v4 via Context7 —
same API shown for `Post.extend({ publishDate: z.date() })`) does the actual
shape merge — `morphz` doesn't reimplement field-merging, it defers to Zod
for the schema half and only handles the class/metadata half itself.

**Resolves spec.md REQ-001** (already stated, confirmed unchanged by this
design): `rawObjectSchema.extend(newShape)` naturally makes a redeclared key
in `newFields` overwrite the parent's — this is exactly Zod's own
`.extend()` semantics, so `morphz`'s "child wins" rule falls directly out of
delegating to Zod rather than being a `morphz`-specific rule to implement.

## `.omit(...names)` / `.pick(...names)`

```ts
static omit(...names: string[] | [string[]]) {
  const flatNames = names.length === 1 && Array.isArray(names[0]) ? names[0] : names as string[]
  return deriveVariant(this, schema => schema.omit(toMask(flatNames)), flatNames, 'omit')
}
static pick(...names: string[] | [string[]]) {
  const flatNames = names.length === 1 && Array.isArray(names[0]) ? names[0] : names as string[]
  return deriveVariant(this, schema => schema.pick(toMask(flatNames)), flatNames, 'pick')
}
```

**Resolves spec.md's open question**: supports BOTH the variadic form
(`omit('id', 'createdAt')`, matching every INSIGHT.md example) AND a single
array argument (`omit(['id', 'createdAt'])`) via a one-line normalization —
near-zero implementation cost to support both, so there's no reason to
force a choice. `toMask(names)` converts to Zod's native mask-object form
(`{ id: true, createdAt: true }`) — Zod's OWN `.omit()`/`.pick()` still
receive their native shape; `morphz`'s variadic sugar is purely an ergonomic
layer on top, never a divergent implementation.

`deriveVariant(sourceClass, transform, names, mode)`:

1. `newRawObjectSchema = transform(sourceMeta.rawObjectSchema)` (native Zod
   `.omit()`/`.pick()`).
2. `newFields` = source's `STRUCT_META.fields` filtered to the surviving
   keys (`mode === 'omit'` excludes `names`, `mode === 'pick'` keeps only
   `names`).
3. `newRawObjectSchema = stripImmutable(newRawObjectSchema, newFields)`
   (below) — applied UNCONDITIONALLY by `.omit()`/`.pick()` (not just
   `.partial()`), so `PatchUserDto extends User.omit('password').partial()`
   and a hypothetical `User.omit('password')` WITHOUT `.partial()` both
   correctly reject writes to `id`/`createdAt` — order of chaining doesn't
   matter.
4. `buildStructClass({ extendsClass: null, rawObjectSchema:
newRawObjectSchema, hooks: sourceMeta.hooks, fields: newFields, labels:
sourceMeta.labels, description: sourceMeta.description })` —
   `extendsClass: null` means an INDEPENDENT class, no prototype chain to
   `sourceClass`. **`instanceof sourceClass` deliberately does NOT hold**
   for `.omit()`/`.pick()`/`.partial()` results — a `CreatePostDto` missing
   `id` is not, semantically, a `Post`. `spec.md` REQ-007 only requires the
   full lifecycle CONTRACT (parse/safeParse/toJSON/instanceof-of-ITSELF),
   never instanceof-of-source — `buildStructClass` satisfies that
   regardless of the `extendsClass` branch taken.

## `.partial()`

```ts
static partial() {
  const meta = this[STRUCT_META]
  const newRawObjectSchema = stripImmutable(meta.rawObjectSchema.partial(), meta.fields)
  return buildStructClass({ extendsClass: null, rawObjectSchema: newRawObjectSchema,
    hooks: meta.hooks, fields: meta.fields, labels: meta.labels, description: meta.description })
}
```

Same `extendsClass: null` / no-`instanceof`-source rule as `.omit()`/
`.pick()`. `stripImmutable` applied here too (not just when chained after
`.omit()`/`.pick()`) — covers a hypothetical standalone `X.partial()` call
not shown in INSIGHT.md but not excluded by it either.

## `stripImmutable()` — concrete REQ-006 enforcement

```ts
function stripImmutable(rawSchema: z.ZodObject, fields: Record<string, FieldDescriptor>) {
  const patch: Record<string, z.ZodType> = {};
  for (const [name, descriptor] of Object.entries(fields)) {
    if (descriptor.meta.immutable && name in rawSchema.shape) {
      patch[name] = z.undefined().optional(); // accepts ONLY absence/undefined
    }
  }
  return Object.keys(patch).length ? rawSchema.extend(patch) : rawSchema;
}
```

Simpler than an earlier-considered `.refine()`-based reject: a field that
must NEVER carry any value on a derived/update variant is exactly what
`z.undefined().optional()` already means natively — no custom refinement
needed. Providing ANY concrete value (even one that would've been valid on
the base class) fails with Zod's own `invalid_type` issue (expected
`undefined`) — this satisfies REQ-005/REQ-006's "rejects, never silently
drops" requirement using a native Zod mechanism, not a `morphz`-specific
one. A nicer issue message for this specific case (e.g. "field is
immutable, cannot be updated") is a possible future enhancement via the
same `message` map the field's `Define` already carries — not required for
correctness, flagged as a nice-to-have, not a spec requirement.

## New Components

| Component                                               | Responsibility                                                                     | Location                                                               |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `buildStructClass()` (internal, shared with `Struct()`) | Builds a class + attaches `STRUCT_META`, optionally as `class extends parentClass` | `src/core/struct.ts` (factored out of `Struct()`'s own implementation) |
| `.extend()`                                             | Superset derivation, real JS subclassing                                           | `src/core/extend.ts`                                                   |
| `.omit()` / `.pick()` / `.partial()`                    | Subset/reshape derivation, independent class                                       | `src/core/derive-variant.ts`                                           |
| `stripImmutable()`                                      | Patches immutable fields to `z.undefined().optional()` on derived variants         | `src/core/derive-variant.ts`                                           |

## Dependency Paths

- `.extend()` → `rawObjectSchema.extend()` (native Zod v4, confirmed via
  Context7) + `STRUCT_META.hooks` (new follow-up to `struct-entities`).
- `.omit()`/`.pick()`/`.partial()` → native Zod `.omit()`/`.pick()`/
  `.partial()` on `rawObjectSchema` + `STRUCT_META.hooks`.
- All four → `buildStructClass()`, the SAME internal helper `Struct()`
  itself uses — `struct-entities/design.md`'s `Struct()` entry should be
  understood as "thin wrapper around `buildStructClass()` with
  `extendsClass: null`" once Execute phase implements it (documentation
  note, not a required edit to that already-completed design).

## Risks

- `post` hook edge case (not resolved, flagged rather than silently
  ignored): if a source `Struct`'s `post` hook cross-validates two fields
  (`startDate < endDate`) and ONE of them is `.omit()`-ted in a derived
  DTO, the reused hook will see `undefined` for the omitted field at
  runtime — `options.post`'s author is responsible for guarding against
  `undefined` inputs if their entity is ever going to be `.omit()`-ted this
  way. `morphz` does not (and structurally cannot, without re-deriving
  cross-field logic per DTO) protect against this — worth a documentation
  callout at Execute time, not a design blocker.
- `buildStructClass`'s two modes (`extendsClass` set vs. `null`) are a
  meaningful branch — worth a clear internal name/comment distinguishing
  "real subclass" vs. "independent derived class" so a future maintainer
  doesn't assume they're interchangeable.

## Decision Log

- `.extend()` uses REAL JS `class extends` (subclassing the parent
  directly); `.omit()`/`.pick()`/`.partial()` build a fully INDEPENDENT
  class with no prototype relationship to the source — resolved by
  reasoning through what `instanceof` should semantically mean for each
  (superset vs. subset/reshape), not explicitly stated in INSIGHT.md but
  consistent with how INSIGHT.md itself only ever asserts `instanceof` for
  the `.extend()` case, never for DTOs.
- `stripImmutable` uses `z.undefined().optional()` rather than a
  `.refine()`-based reject — simpler, fully native to Zod, same observable
  behavior (rejects any concrete value, accepts absence).
- Supports both variadic and single-array-argument forms for
  `.omit()`/`.pick()` — resolves the spec.md open question by making both
  work rather than picking one over the other.
