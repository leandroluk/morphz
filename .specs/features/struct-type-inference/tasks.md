# Tasks: Static Field Type Inference

**Pass 1 status: DONE (2026-08-25).** T-001/T-002 implemented + verified
(248/248 cumulative pass, 9 new `expectTypeOf`-based type-level tests —
NOT just "compiles", actual inferred-type assertions). Zero runtime
behavior change confirmed (all 239 prior tests untouched, pure type
retrofit). `Embed`/`Ref`/`FieldOf` flow through correctly with NO
signature changes needed, confirmed via real test (not assumed). New
`tsconfig.tests.json` (deliberately scoped to `src` + this feature's
tests only, not the whole `tests/` tree — avoids an unrelated typecheck
explosion across every prior test file that was never typechecked before).
**1 real bug self-corrected mid-task**: first version of `.extend()`'s
type only used `Shape` (fields), losing the parent's METHODS from the
type (`isAdmin()` disappeared from `AdminUser`'s inferred type) — fixed
by making `.extend()` ALSO use polymorphic `this`/`InstanceType<T>`
(matching `.parse()`/`.mock()`'s pattern), which correctly matches
`.extend()`'s real runtime behavior (genuine `class extends`, methods
inherited).

## Pass 1 — Core

## T-001: `InferShape` + `Struct()`/`StructConstructor` generics

- **REQ**: REQ-001, REQ-002, REQ-003
- **What**: `InferShape<Fields>` helper. `StructConstructor<Shape>`
  parameterized construct signature + polymorphic-`this` static
  `parse`/`safeParse`. `Struct<Fields>(fields, options):
StructConstructor<InferShape<Fields>>`.
- **Where**: `src/core/struct.ts`
- **Gate**: `npx tsc --noEmit` + a throwaway real `User` example compiles
  with `user.name` recognized as `string`

## T-002: Verify `Embed`/`Ref`/`FieldOf` flow through correctly

- **REQ**: REQ-005
- **What**: no expected signature change, but confirm via real usage that
  `Embed(Address)`'s field types correctly nest, `Ref(() => Post)` infers
  `Post`'s shape, `FieldOf(User, 'id')` infers `User`'s `id` field type.
- **Where**: verification only, edit signatures IF something doesn't flow
- **Depends on**: T-001

## Pass 2 — Derivation methods + verification suite

## T-003: `.extend()`/`.omit()`/`.pick()`/`.partial()`/`.mock()`/`.mockMany()` generics

- **REQ**: REQ-003, REQ-004
- **What**: generic signatures per spec.md's exact type formulas
  (`Omit<Shape, keyof NewFields> & InferShape<NewFields>` for `.extend()`,
  etc.), polymorphic-`this` for `.mock()`/`.mockMany()`.
- **Where**: `src/core/extend.ts`, `src/core/derive-variant.ts`,
  `src/core/mock.ts`, `src/core/struct.ts` (`StructConstructor` interface)
- **Depends on**: T-001

## T-004: Type-level verification suite

- **REQ**: REQ-006
- **What**: `expectTypeOf`-based tests mirroring INSIGHT.md's `User`/
  `Post`/`Address`/`AdminUser`/`CreatePostDto`/`UpdateUserDto`/
  `PatchUserDto` examples verbatim.
- **Where**: `tests/struct-type-inference/*.test-d.ts` (or `.test.ts` if
  vitest's `expectTypeOf` doesn't require the `.test-d.ts` convention —
  confirm in Execute)
- **Depends on**: T-001, T-002, T-003
- **Done when**: every INSIGHT.md field-access/method-call shown in
  §2-4/§8 type-checks with the CORRECT inferred type, verified by
  assertion (not just "no red squiggles").

**Total**: 4 tasks. T-001 is the highest-risk/highest-value task — get it
right, everything downstream is comparatively mechanical.
