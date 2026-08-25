# Design: Struct Entities & Embedded Value Objects

## Architecture Overview
`Struct(fields, options)` synchronously builds ONE Zod pipeline per class and
returns a real ES class carrying that pipeline plus an internal, symbol-keyed
metadata registry. `class X extends Struct({...}, {...}) {}` works because
`Struct(...)` returns an actual constructor — user methods/getters just land
on the subclass prototype, untouched by the pipeline.

```
raw input
   │
   ▼
options.pre (preprocess)         — normalization, whole raw object
   │
   ▼
z.object({ ...fieldSchemas })    — one Zod schema per field, from FieldDescriptor.zodSchema
   │                                (built in define-metatypes; struct-entities only assembles)
   ▼
options.post (superRefine/check) — cross-field validation, ctx.addIssue
   │
   ▼
validated PLAIN data (STRUCT_META.schema stops HERE — no instantiation)
```

This whole pipeline is built ONCE, at `Struct(fields, options)` call time
(module load), not per-parse. **Correction, made during
`lifecycle-serialization` design:** `STRUCT_META.schema` does NOT bake in a
final `.transform(data => new GeneratedClass(data))`. Reason: `Struct(...)`
builds the pipeline before any subclass (`class User extends Struct(...)
{}`) exists, so a transform baked in here could only ever construct the
anonymous base class, never the actual subclass — breaking
`class-extensibility`'s core promise (`admin instanceof AdminUser`).
Instantiation is `lifecycle-serialization`'s responsibility: its static
`parse`/`safeParse` use `new.target`/`this` (resolved at the ACTUAL call
site — `AdminUser.parse(...)` → `this === AdminUser`) to construct the
right class. `STRUCT_META.schema` yields validated plain data only;
`Embed()`/`Ref()` (below / `entity-relationships`) each append their OWN
`.transform(data => new ConcreteTargetClass(data))` on top of the reused
schema, since THEY always know the concrete target class at the point
they're called (`Embed(Address)` always instantiates `Address`, never a
hypothetical future subclass — that asymmetry with `.parse()`'s
polymorphism is intentional, see `lifecycle-serialization/design.md`).

## Correction to struct-entities/spec.md REQ-001
Re-reading INSIGHT.md §2 vs §3: `Address` (an `Embed`-ed `Struct`) declares
its OWN `labels: { entityName: 'Endereço' }` in its OWN `Struct(...)` call —
it does NOT inherit `entityName: 'Usuário'` from `User`. **Labels do NOT
cascade into nested `Embed`/`Ref` targets** — each `Struct` call is a fully
independent template-resolution scope. What DOES cascade is scoped to a
single `Struct(fields, options)` call: every field descriptor **in that same
`fields` record** (built via `Define`-based factories like `PrimaryKey()`,
`CreatedAt()`) resolves its `#entityName`/`#module` placeholders against
THAT call's `options.labels` — never against an ancestor/descendant
`Struct`'s labels. `spec.md` REQ-001 should be corrected to remove "cascades
... to nested `Embed`/`Ref` unless overridden" — replaced below.

## Template resolution timing
Resolved once, synchronously, inside `Struct(fields, options)`:
1. For each field in `fields`, read `FieldDescriptor.meta.description` (and
   `meta.message` string values) from `define-metatypes`.
2. Scan for `options.template?.delimiter ?? '#'` + identifier pattern
   (`#entityName`, `#module`) — resolved from `morphz.config.ts`'s
   `template.delimiter` (see `project-config`), defaulting to `'#'`.
3. Substitute using `options.labels` (this `Struct` call's own labels only,
   per the correction above — NOT merged with any global `defineConfig`
   labels-derivation function; that global default only fires when a
   `Struct` call omits `labels.entityName` entirely, see `project-config`
   REQ-002).
4. Store the RESOLVED strings on the field's entry in the class's internal
   registry (`meta` is not mutated on the shared `Define`-produced
   descriptor — resolution produces a per-`Struct` copy).

Resolving once at class-declaration time (not per-parse) is a deliberate
performance/correctness choice: `labels` are static for a given `Struct`
call, so there is nothing to re-resolve per parse.

## Internal metadata registry
Every class `Struct(...)` produces attaches a symbol-keyed static registry
(not enumerable, not part of the public field surface) so later features can
introspect without re-deriving the pipeline:

```ts
const STRUCT_META = Symbol('morphz.structMeta')

interface StructMeta {
  fields: Record<string, FieldDescriptor>   // resolved descriptions/messages
  labels: Record<string, string>
  description?: string
  schema: z.ZodType                          // pre -> object -> post; NO instantiation transform
  rawObjectSchema: z.ZodObject<...>           // pipeline WITHOUT pre/post/transform —
                                               // needed by FieldOf (entity-relationships)
                                               // to read a field's bare shape
  hooks: { pre?: typeof options.pre; post?: typeof options.post }
                                               // added during class-extensibility design —
                                               // needed so .extend()/.omit()/.pick()/.partial()
                                               // can re-wrap a derived rawObjectSchema with
                                               // the SAME hooks, without re-deriving them
}
// GeneratedClass[STRUCT_META] = {...}
```

`FieldOf(Struct, 'fieldName')` (separate feature) reads
`Struct[STRUCT_META].fields['fieldName']` directly — this is the
"introspectable field-record representation" that feature's spec assumes.

## `Embed(Struct)` — real nested instances
`Embed(TargetStructClass)` returns a `FieldDescriptor` whose `zodSchema` is
`TargetStructClass[STRUCT_META].schema.transform(data => new
TargetStructClass(data))` — the target's validation pipeline REUSED (not a
fresh `z.object()` rebuild), with `Embed`'s OWN instantiation transform
appended on top (per the correction above — `STRUCT_META.schema` itself
carries no transform). `TargetStructClass` here is a concrete class
reference (whatever was literally passed to `Embed(...)`), so no
`this`/`new.target` polymorphism is needed or wanted at this layer. The
descriptor also sets `targetStruct: () => TargetStructClass` (added during
`i18n-error-messages` design — required so error-message resolution can
recurse into `TargetStructClass[STRUCT_META].fields` for nested-field
message overrides instead of falling back to Zod's raw message). Because
Zod's `.transform()` composes through parent object validation (nested-field
transforms run as part of the parent's `.parse()`), parsing `User`
automatically produces `user.address instanceof Address` for free, with
zero special-casing in `struct-entities`'s own object-assembly step. This is
the same mechanism `Ref` (separate feature) reuses.

## `pre`/`post` hook wiring
- `pre`: implemented via `z.preprocess(options.pre, objectSchema)` — Context7
  confirms `z.preprocess(fn, schema)` still exists in Zod v4 as a pipe (`fn`
  runs first, output feeds `schema`). Runs on the raw, still-unvalidated
  input object.
- `post`: implemented via `.superRefine((val, ctx) => options.post(val,
  ctx))` on the object schema (after `pre`, before `.transform()`).
  Context7 flags `.superRefine()` as deprecated in v4 in favor of `.check()`
  — internally `morphz` should call `.check()` (the non-deprecated
  primitive `.superRefine()` delegates to), but the PUBLIC `post(val, ctx)`
  signature stays `ctx.addIssue({ code, path, message })` to match
  INSIGHT.md §3's documented shape exactly — this is an internal
  implementation choice, not a public API change.

## `List`/`Optional`/`Nullable` composition
Already implemented as core primitives in `define-metatypes` (each a
`FieldDescriptorFactory` wrapping `.array()`/`.optional()`/`.nullable()`
around an inner `FieldDescriptor`'s `zodSchema`). `struct-entities` consumes
them as-is — `tags: List(Text(), { default: () => [] })` and
`address: Optional(Embed(Address))` both resolve through the SAME
`FieldDescriptor` shape, so `Struct`'s field-assembly step never needs to
know whether a field is a plain primitive, a `List`, an `Embed`, or (later)
a `Ref` — it only ever reads `.zodSchema` off whatever descriptor is in the
`fields` record.

## New Components
| Component | Responsibility | Location |
|---|---|---|
| `Struct()` | Assembles the pre→object→post pipeline (no instantiation), returns a real class with `STRUCT_META` attached | `src/core/struct.ts` |
| `STRUCT_META` symbol + `StructMeta` type | Internal introspectable registry consumed by `FieldOf`, `.extend()`/`.omit()`/`.pick()`, i18n message lookup | `src/core/struct-meta.ts` |
| Template resolver | Walks field `meta.description`/`meta.message` strings, substitutes `#placeholder` using `options.labels` | `src/core/template.ts` |
| `Embed()` | Field descriptor whose `zodSchema` = target `Struct`'s full pipeline schema (reused, not rebuilt) | `src/core/embed.ts` |

## Dependency Paths
- `Embed`/field assembly → `FieldDescriptor.zodSchema` (from
  `define-metatypes`, already built).
- Template resolver → `options.template.delimiter` (from `project-config`,
  falls back to `'#'` when no config loaded).
- `post` hook → Zod's `.check()`/`.superRefine()` (native API, no new
  dependency).

## Risks
- `STRUCT_META`'s exact shape is a cross-cutting contract — `entity-
  relationships` (`FieldOf`, `Ref`), `class-extensibility` (`.extend()`/
  `.omit()`/`.pick()`/`.partial()`), and `lifecycle-serialization`
  (`.parse()`/`.safeParse()`/`.toJSON()`) all read/derive from it. Any
  shape change here has wide blast radius across those three features —
  treat `STRUCT_META`'s interface as the God Node of this codebase once
  code exists; changes to it should be reviewed against all three consuming
  features' specs.
- `Embed` reusing the target's FULL pipeline schema (transform included)
  means an embedded `Struct`'s `pre`/`post` hooks (if it has its own) DO run
  during the parent's parse — this resolves `struct-entities/spec.md`'s open
  question ("does `Embed`'s nested `Struct` inherit hooks") the opposite way
  from "inherit": the embedded `Struct` keeps and runs its OWN hooks
  (already baked into its `STRUCT_META.schema`), it never inherits the
  parent's `pre`/`post` — each `Struct` is a fully self-contained pipeline,
  consistent with the labels-don't-cascade correction above.

## Decision Log
- Pipeline order fixed as `pre → object → post` — matches INSIGHT.md's
  stated Zod equivalents (`z.preprocess` / `z.superRefine`) exactly.
  Instantiation deliberately kept OUT of this pipeline (corrected during
  `lifecycle-serialization` design, see above) — `STRUCT_META.schema` stays
  a pure validation pipeline; instantiation is layered on top per-consumer
  (`.parse()`'s polymorphic `this`, `Embed`/`Ref`'s concrete-class
  transform).
- Chose symbol-keyed `STRUCT_META` over exposing metadata as regular static
  properties — avoids collision with user-declared static members on
  subclasses and keeps the public class surface exactly what INSIGHT.md
  shows (fields + methods), nothing extra leaking into autocomplete.
- Resolved (this session): labels do NOT cascade to nested `Embed`/`Ref`
  targets; embedded `Struct`s keep and run their own `pre`/`post`, never
  inherit the parent's. Both corrections apply consistently: each `Struct`
  call is a fully independent, self-contained pipeline — composition
  happens by reusing the FULLY-BUILT pipeline schema, never by merging
  options/hooks across `Struct` boundaries.
