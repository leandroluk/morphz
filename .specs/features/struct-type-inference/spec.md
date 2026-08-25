# Spec: Static Field Type Inference (CRITICAL FINDING retrofit)

## Summary

Resolves the CRITICAL FINDING flagged during `jsdoc-generation`:
`Struct()`'s public signature isn't generic over `fields`, so every
`morphz` consumer gets ZERO field-level TypeScript inference today
(`user.name` isn't a recognized property). This is a **type-declaration-
-only retrofit** — runtime behavior (239/239 tests, already correct) does
not change; only PUBLIC function/method signatures gain precise generics.
Internal implementations keep their existing loose/`unknown` typing with
`as unknown as` bridges at the typed/untyped boundary — a standard,
low-risk TS pattern: the compiler can't verify internals, but the PUBLIC
contract becomes accurate, which is what actually matters to consumers.

## Requirements

- REQ-001: `type InferShape<Fields extends Record<string, FieldDescriptor
<any>>> = { [K in keyof Fields]: Fields[K] extends FieldDescriptor<infer
T> ? T : never }` — the core inference helper, derives a plain instance
  shape from a field-descriptor record. (`Define`/`FieldDescriptorFactory`
  are ALREADY correctly generic per-field per `define-metatypes` — this
  retrofit doesn't touch them, only propagates their existing `T` upward
  through `Struct`/`Embed`/`Ref`/`FieldOf`/derivation methods, which
  currently erase it.)
- REQ-002: `Struct<Fields extends Record<string, FieldDescriptor<any>>>
(fields: Fields, options?: StructOptions): StructConstructor<InferShape
<Fields>>` — `StructConstructor<Shape>` parameterized by the ALREADY-
  COMPUTED plain shape (not by `Fields` itself) — this is the key design
  choice that makes every derivation method below a simple TS utility-type
  application instead of needing to re-derive from a field-descriptor map
  each time.
- REQ-003: `StructConstructor<Shape>`'s construct signature: `new (input:
unknown): Shape`. Static methods use the POLYMORPHIC-`this` TS idiom
  (`static parse<T extends new (i: unknown) => any>(this: T, input:
unknown): InstanceType<T>`) so `AdminUser.parse(...)` types as
  `AdminUser`, not `User` — same idiom for `safeParse`, `mock`,
  `mockMany`. This works because these are real `static` methods in
  `struct.ts`'s actual TS source (not stringified/dynamically typed) —
  standard, well-supported TS behavior for exactly this "polymorphic
  factory method" case.
- REQ-004: Derivation methods, using `Shape` directly (not `Fields`):
  - `.extend<NewFields extends Record<string, FieldDescriptor<any>>>
(newFields: NewFields): StructConstructor<Omit<Shape, keyof NewFields>
& InferShape<NewFields>>` — `Omit<...> & ...` (not plain `&`) to
    correctly model "child field overrides parent field" at the type
    level, matching the ALREADY-IMPLEMENTED runtime shallow-overwrite
    semantics (`class-extensibility`'s existing behavior) exactly.
  - `.omit<K extends keyof Shape>(...names: K[] | [K[]]): StructConstructor
<Omit<Shape, K>>`
  - `.pick<K extends keyof Shape>(...names: K[] | [K[]]): StructConstructor
<Pick<Shape, K>>`
  - `.partial(): StructConstructor<Partial<Shape>>`
- REQ-005: `Embed<T>`/`Ref<T>`/`FieldOf<T>` (`entity-relationships`)
  ALREADY declare the correct generic shape (`StructConstructorLike<T>`)
  — once `StructConstructor<Shape>`'s construct signature actually
  produces `Shape` (not `unknown`), these should become correctly typed
  "for free" via normal structural assignability — no signature changes
  expected, but MUST be verified with real type-level tests, not assumed.
- REQ-006: A NEW type-level test suite (vitest's `expectTypeOf`, already
  available in the installed `vitest`) exercising INSIGHT.md's OWN
  canonical examples verbatim: `User`/`Post`/`Address` (§2-4),
  `AdminUser extends User.extend(...)` (§8A, confirms `instanceof`-
  -preserving polymorphism ALSO now carries correct field types),
  `CreatePostDto`/`UpdateUserDto`/`PatchUserDto` (§8B/C, confirms
  `.omit()`/`.pick()`/`.partial()` produce correctly-shaped types). This
  is the REAL verification this retrofit needs — `tsc --noEmit` passing
  is necessary but not sufficient (unsound `any`-laden types would also
  compile silently); `expectTypeOf` assertions catch that.

## Affected Components

`struct.ts` (`StructConstructor` interface + `Struct()` signature — the
root of the retrofit), `extend.ts`, `derive-variant.ts`, `mock.ts` (public
signatures only), `embed.ts`/`ref.ts`/`field-of.ts` (verification, likely
no signature change needed). Does NOT touch `define-metatypes` (`Define`,
`FieldDescriptor<T>`, every primitive) — already correctly generic,
confirmed by reading the current source before writing this spec.

## Out of Scope

- `readonly`-marking `immutable` fields at the type level (e.g. `user.id =
'x'` being a TS compile error, not just a runtime one via `class-
extensibility`'s derived-variant schema patch) — real, legitimate
  future enhancement, NOT attempted here. Threading an immutability marker
  through `FieldDescriptor<T>`'s type parameter is meaningfully more
  design work (a second type parameter or a discriminated shape) — this
  retrofit's whole point is fixing the "no field exists at all" gap first,
  the highest-leverage fix; immutability-at-the-type-level is a smaller,
  separable follow-up.
- `Union`'s member-type inference, `additional-primitives`' `Json<T>`
  generic (already flagged in that spec as "cosmetic until Struct is
  generic" — THIS retrofit is what makes it non-cosmetic, but wiring
  `Json<T>`'s specific consumer-facing ergonomics is not re-verified here
  beyond confirming it now flows through correctly via `InferShape`).
- Any RUNTIME code change — this is exhaustively a type-declaration
  retrofit. If Execute finds a case that genuinely requires a runtime
  change to make the types sound, that's a real finding to flag, not
  something to route around with an unsound type assertion.

## Open Questions

None — design is fully resolved above (unusual for this project's specs,
but this retrofit's design was worked out completely before writing this
spec, given how easy it is to under-specify TS generic engineering and
end up with something that "compiles" but is unsound or unusable).
