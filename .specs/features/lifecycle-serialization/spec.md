# Spec: Lifecycle — Parsing, Instantiation, Serialization

## Summary

Unlike raw Zod (which produces anonymous plain objects), every `Struct`-based
parse operation must produce a real instance of the declaring class, with
`instanceof` identity and access to hand-written domain methods. Three entry
points: `.parse()` (throws `ValidationError`), `.safeParse()` (returns a
result object, HTTP-friendly), and `new Struct({...})` (constructor form,
presumably equivalent to `.parse()`). Serialization via `.toJSON()` respects
per-field `writeOnly` masking and any declared transforms.

## Requirements

- REQ-001: `StructClass.parse(input)` validates `input` against the field
  schema, runs `pre`/`post` hooks (see `struct-entities`), and on success
  returns `new StructClass(validatedData)` — an instance where
  `result instanceof StructClass === true`. On failure, throws a
  `ValidationError` (or equivalent) carrying Zod's issue tree (post i18n
  override, see `i18n-error-messages`).
- REQ-002: `new StructClass(input)` is equivalent to `StructClass.parse(input)`
  in validation behavior (throws on invalid input) — confirm this equivalence
  vs. an alternative where the constructor is a _trusted_ fast-path (no
  validation) and only `.parse()` validates. INSIGHT.md's example implies
  they're equivalent ("Ou via construtor").
- REQ-003: `StructClass.safeParse(input)` never throws. Returns
  `{ success: true, data: StructInstance }` or
  `{ success: false, errors: ... }` shaped for direct use in HTTP handlers
  (`res.status(400).json({ errors: result.errors })`).
- REQ-004: Fields with a `default` (value or thunk) are populated on the
  resulting instance when absent from input — confirmed by `user.id` being
  populated after `PrimaryKey()`'s `default: () => crypto.randomUUID()`.
- REQ-005: `instance.toJSON()` serializes the instance back to a plain
  object/JSON-compatible shape, omitting fields marked `writeOnly: true`
  (e.g. `Password({ writeOnly: true })` never appears in `toJSON()` output).
  Must also apply codec `encode` for `DateTime`/`Timestamp` fields (Date →
  ISO string) and equivalent serialization for `Embed`/`Ref`-nested
  instances (calling their `.toJSON()` recursively).
- REQ-006: Domain methods declared on the class (e.g. `isAdmin()`,
  `isDeleted()`) are callable on both `.parse()`-produced and
  constructor-produced instances identically — no separate "hydration" step.

## Affected Components (from graph)

N/A — greenfield. Depends on `struct-entities` (the class produced by
`Struct(...)`), `define-metatypes` (`writeOnly`/`default` field options —
confirm `writeOnly` is part of `define-metatypes`'s option set, currently
only shown used directly on `Password()` in INSIGHT.md §3), and
`i18n-error-messages` (error shape returned on failure).

## Out of Scope

- `.extend()`-produced subclass lifecycle nuances (polymorphism through
  inheritance) — separate feature (`class-extensibility`); this spec covers
  the base-class lifecycle contract that subclasses must also satisfy.
- Database/ORM persistence (save/load) — `morphz` produces validated,
  serializable instances; it does not persist them.

## Resolved (design phase)

- `writeOnly` lives on `FieldDescriptor.meta` (`define-metatypes` tier,
  same as `immutable`) — set directly by whichever primitive/`Define` call
  declares it (`Password({ writeOnly: true })`). Not a separate
  `Struct`-level annotation.
- REQ-002: the public constructor ALWAYS validates, fully equivalent to
  `.parse()` (`.parse()` is literally `new this(input)`) — no public
  "trusted fast-path" exists. `safeParse()`'s double-validation avoidance is
  an internal-only optimization (`Object.create(this.prototype)` after a
  successful `schema.safeParse()`), invisible to callers, not a second
  public constructor mode.
- `ValidationError extends Error` with `.issues` matching Zod's `ZodError`
  issue shape directly (`path`, `code`, `message`), EXCEPT `message` has
  already been passed through `resolveIssueMessages()` (i18n overrides
  applied). Same shape used for both the thrown error's `.issues` and
  `safeParse()`'s `.errors` — one shape, two access paths.
