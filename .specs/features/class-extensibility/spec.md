# Spec: Class Extensibility (`.extend()`, `.omit()`, `.pick()`, `.partial()`)

## Summary
`Struct`-derived classes support real class extension: `.extend(newFields)`
adds fields (and the subclass can add its own methods) while preserving
`instanceof` polymorphism against the parent class. `.omit()`/`.pick()`
derive DTO classes with a subset of fields (e.g. stripping server-managed
fields for a "create" DTO). `.partial()` makes all remaining fields optional
(e.g. for a "patch" DTO). `immutable` fields (from `define-metatypes`)
constrain what a derived "update" DTO can legally accept.

## Requirements
- REQ-001: `BaseStruct.extend(newFields)` returns a new base class usable
  with `class X extends BaseStruct.extend({...}) {}`, combining the parent's
  field record with `newFields`. If `newFields` redeclares a field name that
  already exists on the parent, the new descriptor SILENTLY REPLACES the
  parent's for that field — ordinary single-parent override semantics, same
  as overriding a class field/property in standard OOP. This is NOT the
  mixin-collision problem INSIGHT.md warns against (that concerns two
  *sibling* mixins composed at the same level with no hierarchy to resolve
  precedence — `.extend()` has exactly one parent, so precedence is always
  unambiguous: child wins).
- REQ-002: A class extending `.extend(...)`'s result satisfies BOTH
  `instance instanceof Subclass` and `instance instanceof ParentStruct`
  (polymorphism preserved through the extension chain), per INSIGHT.md's
  `admin instanceof AdminUser` / `admin instanceof User` example.
- REQ-003: `.omit(...fieldNames)` returns a class with the named fields
  removed from the schema (and thus from parse/serialize) — used for DTOs
  like `CreatePostDto extends Post.omit('id', 'createdAt', 'updatedAt',
  'deletedAt')`.
- REQ-004: `.pick(...fieldNames)` returns a class with ONLY the named fields
  retained — used for narrow update DTOs like
  `UpdateUserDto extends User.pick('name', 'address').partial()`.
- REQ-005: `.partial()` returns a class where every remaining field becomes
  optional (Zod `.partial()` semantics), chainable after `.omit()`/`.pick()`.
- REQ-006: Fields marked `immutable: true` (see `define-metatypes` REQ-005)
  remain enforced through `.omit()`/`.partial()` derivation — e.g.
  `PatchUserDto extends User.omit('password').partial()` still rejects a
  write to `id`/`createdAt` if included in the payload, without the DTO
  author needing to explicitly `.omit('id', 'createdAt', ...)` — the
  `immutable` flag is the single source of truth for "not writable via
  update," not a per-DTO omit list.
- REQ-007: `.extend()`/`.omit()`/`.pick()`/`.partial()` all return classes
  that independently support the full lifecycle contract from
  `lifecycle-serialization` (`.parse()`, `.safeParse()`, `.toJSON()`,
  `instanceof`).

## Affected Components (from graph)
N/A — greenfield. Depends on `struct-entities` (base class shape) and
`define-metatypes` (`immutable` flag semantics — REQ-006 above is the
concrete enforcement point: base `Struct.parse()` always allows writing an
`immutable` field, any class derived via `.omit()`/`.pick()`/`.partial()`
that still carries the field rejects it if present in input, resolved per
`define-metatypes` REQ-005).

## Out of Scope
- Deep/structural merge of `Embed`-nested field overrides on `.extend()` —
  not demonstrated in INSIGHT.md; assume `.extend()` only adds/overrides
  top-level fields unless a concrete use case surfaces.
- Runtime schema diffing/migration between versions of an extended class —
  not covered.

## Resolved (design phase)
- `.omit()`/`.pick()` accept BOTH the variadic form
  (`.omit('id', 'createdAt')`, matching every INSIGHT.md example) AND a
  single array argument (`.omit(['id', 'createdAt'])`) — normalized
  internally to Zod's native mask-object form before delegating to Zod's
  own `.omit()`/`.pick()`. Near-zero cost to support both, no reason to
  force a single form.
- `instanceof` semantics resolved by design: `.extend()` uses real JS
  `class extends` (subclasses the parent — `instanceof` holds transitively
  through the whole chain). `.omit()`/`.pick()`/`.partial()` build a fully
  INDEPENDENT class with no prototype relationship to the source —
  `instanceof` the SOURCE class does NOT hold for these (a `CreatePostDto`
  missing `id` is not semantically a `Post`); REQ-007's lifecycle contract
  still holds regardless (parse/safeParse/toJSON/instanceof-of-itself).
- `immutable` enforcement (REQ-006) concretely implemented via patching the
  field's schema to `z.undefined().optional()` on derived variants — native
  Zod `invalid_type` rejection, no custom refine needed. Applied
  unconditionally by `.omit()`/`.pick()`/`.partial()` (not just when
  chained together), so ordering never matters.
