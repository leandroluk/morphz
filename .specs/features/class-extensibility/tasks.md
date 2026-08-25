# Tasks: Class Extensibility (`.extend()`, `.omit()`, `.pick()`, `.partial()`)
*(PO breakdown, from spec.md + design.md)*

## T-001: `stripImmutable()`
- **REQ**: REQ-006
- **What**: patches every `meta.immutable` field still present in a raw
  object schema's shape to `z.undefined().optional()`.
- **Where**: `src/core/derive-variant.ts`
- **Depends on**: `struct-entities` (`rawObjectSchema`), `define-metatypes`
  (`meta.immutable`)
- **Done when**: a schema with an immutable field patched rejects any
  concrete value for it, accepts absence/`undefined`.
- **Gate**: `npm run test -- strip-immutable`

## T-002: `.omit()` / `.pick()` / `.partial()`
- **REQ**: REQ-003, REQ-004, REQ-005
- **What**: native Zod `.omit()`/`.pick()`/`.partial()` on
  `rawObjectSchema`, variadic-or-single-array argument normalization,
  `stripImmutable` applied unconditionally, rebuilt via
  `buildStructClass({ extendsClass: null, ... })` (independent class, no
  `instanceof` source).
- **Where**: `src/core/derive-variant.ts`
- **Depends on**: T-001, `struct-entities` (`buildStructClass`, `STRUCT_META.hooks`)
- **Done when**: `Post.omit('id','createdAt')` and `Post.omit(['id','createdAt'])`
  both work identically; `PatchUserDto extends User.omit('password').partial()`
  rejects a payload containing `id`; result is NOT `instanceof Post`/`User`.
- **Gate**: `npm run test -- derive-variant`

## T-003: `.extend()`
- **REQ**: REQ-001, REQ-002
- **What**: `rawObjectSchema.extend(newShape)` (native Zod), rebuilt via
  `buildStructClass({ extendsClass: this, ... })` — real `class extends`.
- **Where**: `src/core/extend.ts`
- **Depends on**: `struct-entities` (`buildStructClass`)
- **Done when**: `class AdminUser extends User.extend({department: Text()})
  {}` — `admin instanceof AdminUser` AND `admin instanceof User` both true;
  redeclaring an existing field name silently overrides it.
- **Gate**: `npm run test -- extend`

**Total**: 3 tasks. T-002/T-003 both depend only on `struct-entities`,
parallelizable `[P]` with each other (T-002 also needs T-001 first).
