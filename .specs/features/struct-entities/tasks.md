# Tasks: Struct Entities & Embedded Value Objects
*(PO breakdown, from spec.md + design.md)*

## T-001: `STRUCT_META` symbol + `StructMeta` type
- **REQ**: internal registry (design.md)
- **What**: `StructMeta` interface: `fields`, `labels`, `description?`,
  `schema` (pre→object→post, validation-only, NO instantiation transform —
  see design.md correction), `rawObjectSchema`, `hooks: { pre?, post? }`.
- **Where**: `src/core/struct-meta.ts`
- **Depends on**: `define-metatypes` T-001 (`FieldDescriptor`) — external
- **Done when**: type compiles, symbol exported for cross-feature use.
- **Gate**: `npx tsc --noEmit`

## T-002: Template resolver
- **REQ**: REQ-001 (labels, scoped to one `Struct` call — no cascade)
- **What**: walk `meta.description`/`meta.message` strings, substitute
  `#placeholder` (or configured delimiter) using `options.labels`, produce
  RESOLVED copies (never mutate the shared `Define`-produced descriptor).
- **Where**: `src/core/template.ts`
- **Depends on**: none (delimiter defaults to `'#'`; `project-config`
  integration is a later follow-up call, not required for this task)
- **Done when**: `#entityName` resolves against `{entityName: 'Usuário'}`;
  unresolved placeholder (no matching label) left as-is, never throws.
- **Gate**: `npm run test -- template`

## T-003: `buildStructClass()` internal helper
- **REQ**: REQ-001..REQ-006 (core pipeline)
- **What**: assembles `pre → z.object(fields) → post` (NO transform —
  design.md correction), attaches `STRUCT_META`. Constructor uses
  `new.target[STRUCT_META].schema.parse(input)` then `Object.assign(this,
  data)` (this piece is technically `lifecycle-serialization`'s REQ, but
  MUST be written now since the constructor lives on the class this task
  builds — implement per `lifecycle-serialization/design.md`'s
  constructor snippet; `lifecycle-serialization`'s own DEV pass will add
  `static parse`/`safeParse`/`.toJSON()` on top).
- **Where**: `src/core/struct.ts`
- **Depends on**: T-001, T-002, `define-metatypes` T-001..T-003 (external)
- **Done when**: `class X extends Struct({...}, {...}) {}` produces a real
  class; `new X(validInput)` assigns validated fields to `this`; invalid
  input throws (raw ZodError acceptable for now — i18n wrapping is
  `i18n-error-messages`/`lifecycle-serialization`'s job, layered later).
- **Gate**: `npm run test -- struct`

## T-004: `Embed()`
- **REQ**: REQ-005
- **What**: `TargetStruct[STRUCT_META].schema.transform(data => new
  TargetStruct(data))`, sets `targetStruct: () => TargetStruct` on the
  descriptor.
- **Where**: `src/core/embed.ts`
- **Depends on**: T-003
- **Done when**: parsing a parent with `Optional(Embed(Address))` produces
  `parent.address instanceof Address`.
- **Gate**: `npm run test -- embed`

**Total**: 4 tasks, sequential (T-001→T-002 parallelizable `[P]`, both
before T-003).
