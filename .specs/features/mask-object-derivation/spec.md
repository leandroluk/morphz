# Spec: Mask-Object Derivation (`.omit()` / `.pick()` / `.partial()` API)

**Status: DONE (2026-08-28).** Implemented + tested (260 core tests green,
288 monorepo-wide). Shipped alongside `default-entity-name` in the same
commit. Open questions resolved by user:

- Q1 → **yes**, Zod v4 `ZodObject.partial(mask)` keeps the selective
  semantics (verified via Context7: `/colinhacks/zod`). `morphz` delegates
  straight to it.
- Q2 → **explicit throw.** `assertMask()` raises a `TypeError` with a
  migration hint if given a string/array (old form).
- Q3 → **`feat!` → `0.2.0`.** Confirmed.
- Q4 → **export `Mask<Shape>` publicly** — `export type { Mask }` from
  `src/index.ts`. Consumers can `{ ... } satisfies Mask<Shape>`.

## Summary

Replace the variadic / single-array argument form of `.omit()`, `.pick()`
and `.partial()` on `Struct`-derived classes with a **mask object** —
`{ [K in keyof Shape]?: true }` — matching Zod v4's own `.omit()` /
`.pick()` / `.partial()` signature exactly.

Today:

```ts
User.omit("id", "createdAt"); // variadic
User.omit(["id", "createdAt"]); // single array
User.pick("name", "email").partial(); // variadic
```

After:

```ts
User.omit({ id: true, createdAt: true });
User.pick({ name: true, email: true }).partial();
User.partial({ name: true }); // NEW — selective partial
```

Motivation: `morphz`'s guiding principle is "Zod + an OO/class type-safety
layer, never invent behavior Zod wouldn't produce." The variadic sugar is
the one place the derivation API visibly diverges from the Zod schema API a
`morphz` user already knows. Aligning removes a surprise, unlocks selective
`.partial(mask)` for free (Zod supports it, `morphz` currently does not),
and shrinks the public surface (one form, not three).

This is a **breaking change**. It is taken now, at `v0.1.0`, while adoption
is effectively zero — a codemod (`.omit("a", "b")` → `.omit({ a: true, b:
true })`) is mechanical. No deprecation window, no dual-form overload
(explicitly rejected — see Rejected Alternatives).

## Requirements

- REQ-001: `Struct`-derived class static `.omit(mask)` accepts a single
  argument `mask: { [K in keyof Shape]?: true }` and returns
  `StructConstructor<Omit<Shape, keyof typeof mask>>`. Passing a key not in
  `Shape` is a compile-time error (`mask` is typed against `keyof Shape`).
  A key whose value is not `true` (`false`, `undefined`, omitted) is a
  compile-time error — only `true` is accepted, mirroring Zod v4 (no
  `{ id: false }` "keep everything except" inversion).
- REQ-002: `.pick(mask)` — same argument shape as REQ-001 — returns
  `StructConstructor<Pick<Shape, keyof typeof mask & keyof Shape>>`.
- REQ-003: `.partial(mask?)` accepts an OPTIONAL mask.
  - No argument → every remaining field becomes optional (current
    behavior, unchanged).
  - With a mask → only the named fields become optional, the rest keep
    their current optionality. Return type reflects this
    (`Partial<Pick<Shape, K>> & Omit<Shape, K>`).
  - Verify against Context7 (`/colinhacks/zod` v4) that `ZodObject.partial`
    accepts a mask argument in v4 with these semantics before Design
    commits to delegating to it; if v4 dropped the mask arg, `morphz`
    synthesizes the selective behavior itself (patch only masked keys to
    `.optional()`).
- REQ-004: The variadic form (`.omit("id", "createdAt")`) and the
  single-array form (`.omit(["id", "createdAt"])`) are REMOVED. Calling
  either is a compile-time type error and a runtime failure (no silent
  coercion of a string/array argument into a mask).
- REQ-005: Chaining is unchanged — `.pick({...}).partial()`,
  `.omit({...}).partial({...})`, `.pick({...}).partial().extend({...})` all
  still work, each step consuming/producing the mask-object form.
- REQ-006: `immutable`-field enforcement (`class-extensibility` REQ-006 /
  `stripImmutable`) is unaffected — still applied unconditionally by all
  three methods regardless of argument form. A `PatchUserDto extends
User.omit({ password: true }).partial()` still rejects a write to
  `id` / `createdAt`.
- REQ-007: `.extend(newFields)` is NOT touched — it already takes a field
  RECORD (`Record<string, FieldDescriptor>`), not a name list, and its
  shape is correct as-is.
- REQ-008: All in-repo call sites updated to the new form:
  - `packages/core/tests/class-extensibility/derive-variant.test.ts`
  - `packages/core/tests/recipes-package/recipes-integration.test.ts`
  - `packages/core/tests/struct-type-inference/basic-inference.test.ts`
  - `packages/core/tests/struct-type-inference/coverage-extra.test.ts`
  - any other `.omit(` / `.pick(` / `.partial(` call found at Execute time
- REQ-009: Documentation updated to the new form:
  - `docs/README.md` (`#dtos-and-class-extension` section)
  - `docs/examples/user-post.md` (`## DTOs` section)
  - `packages/core/README.md` if it shows a derivation call
  - `INSIGHT.md` §8 (`.omit`/`.pick`/`.partial` examples) — update in
    place; INSIGHT.md is the design source of truth and must not contradict
    shipped API.
- REQ-010: `class-extensibility/spec.md` REQ-003/REQ-004/REQ-005 and
  `class-extensibility/design.md`'s `.omit()`/`.pick()`/`.partial()`
  sections + Decision Log entry ("Supports both variadic and single-array
  ... ") are amended to reflect the mask-object form as the sole API. The
  "Resolved (design phase)" note in that spec that says both forms are
  supported is superseded by this feature.
- REQ-011: `npx tsc --noEmit` clean and `npm test` green (all cumulative
  tests) before the feature is considered done, per `CONVENTIONS.md`.

## Affected Components (from graph)

- `src/core/derive-variant.ts` — `normalizeNames()` deleted, `toMask()`
  deleted or reduced to identity, `omit()` / `pick()` / `partial()` runtime
  signatures changed to `(mask)`. `deriveVariant()`'s `names: string[]`
  parameter becomes `keys: string[]` derived from `Object.keys(mask)`.
- `src/core/struct.ts` — `StructConstructor` interface: `omit` / `pick` /
  `partial` type signatures rewritten against a `Mask<Shape>` helper type.
- `src/core/struct-meta.ts` — no change expected (`STRUCT_META` shape
  untouched).
- Tests + docs per REQ-008 / REQ-009.

Depends on `class-extensibility` (owns these three methods) and
`struct-type-inference` (owns the precise `StructConstructor<Shape>`
interface the new signatures slot into).

## Out of Scope

- `{ key: false }` "omit-by-exclusion" / inversion semantics — Zod v4 does
  not support it; `morphz` will not either.
- Deprecation shim / dual-form overload keeping the variadic API alive — a
  clean break is the whole point (see Rejected Alternatives).
- A published codemod tool / ESLint autofix — the transform is a one-line
  find-replace; a formal codemod is not warranted at this adoption level.
- `.required(mask)` (Zod v4 has it) — not currently exposed by `morphz`,
  out of scope for this change; can be a separate additive feature later.
- Any change to `.extend()` (REQ-007).

## Open Questions (for Design phase)

- Q1: Does Zod v4's `ZodObject.partial()` still accept a mask argument with
  "only these become optional" semantics? Drives whether REQ-003's
  selective partial delegates to Zod or is synthesized in `morphz`. Verify
  via Context7, do not assume.
- Q2: Runtime guard for REQ-004 — when a caller passes a string or array
  (old form) despite the types, should `.omit()` throw a clear
  `TypeError("omit() expects a mask object, e.g. { id: true }")` or let it
  fail naturally downstream? Leaning explicit throw for a good migration
  error; confirm at Design.
- Q3: Version bump — `feat!` (breaking) in the Conventional Commit, and
  since the project is `0.x`, git-cliff will bump `0.1.0` → `0.2.0`.
  Confirm that's the intended next version (vs. folding into a larger
  `0.2.0` batch).
- Q4: `Mask<Shape>` helper — export it publicly (`import type { Mask }`) so
  consumers can build reusable masks (`const SERVER_FIELDS = { id: true,
createdAt: true } satisfies Mask<UserShape>`), or keep it internal?

## Rejected Alternatives

- **Dual-form overload (accept both mask object and variadic).** Zero
  migration cost, but doubles the type surface of three methods, keeps the
  Zod divergence half-alive, and leaves two ways to do one thing in the
  docs forever. Rejected in favor of a clean break while adoption is ~zero.
- **Keep variadic, add mask object as a second form.** Same objection as
  above.
- **Deprecate variadic with a console warning for one minor version.**
  Overkill for a `v0.1.0` → `v0.2.0` change nobody has built against yet.
