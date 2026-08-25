# Spec: Define & Meta-Types (foundation)

## Summary
`Define(BaseType, options)` creates a reusable, named specialization of a core
primitive type (`Text`, `Number`, `Uuid`, `DateTime`, `Ip`, `FromZodType`, ...)
with baked-in defaults, description, regex/refine validation, and i18n
messages. This is the foundational composition primitive: almost every other
feature (`Struct` fields, `FieldOf`, error messages) is built by calling
`Define()` or consuming its output. Templated descriptions (`#entityName`,
`#module`) are interpolated from context supplied by the parent `Struct` at
declaration time.

## Requirements
- REQ-001: `Define(BaseType, options)` returns a callable factory. Calling the
  factory with no args or with per-field overrides (e.g. `Cep()`,
  `PrimaryKey()`) produces a field descriptor consumable by `Struct`.
- REQ-002: `options` accepts: `description` (string, may contain template
  placeholders), `default` (value or thunk `() => value`), `immutable`
  (boolean), `regex` (RegExp, for `Text`-based types), `refine` (function
  `(val, opts?) => true | string`, single-field custom validation), `message`
  (per-issue-code override, string or i18n map — see `i18n-error-messages`
  feature), `examples` (array).
- REQ-003: `refine` receives only the field's own value plus optional runtime
  args (e.g. `TimeAgo({ within: '30d' })`) — it must never receive the full
  parent object. Cross-field validation is explicitly out of scope for
  `Define`/`refine` (delegated to `Struct`'s `post` hook).
- REQ-004: Template placeholders in `description` (`#entityName`, `#module`,
  etc.) are resolved lazily, at `Struct` construction/parse time, using the
  `labels` object propagated from the owning `Struct`'s options (see
  `struct-entities`). Delimiter is configurable via `morphz.config.ts`
  (`template.delimiter`, default `#`).
- REQ-005: `immutable: true` marks a field as set-once-at-creation: the
  value written on the FIRST successful parse (creation) can never be
  changed by a later parse of the same logical record. Concretely: on any
  update/patch parse (a `Struct` derived via `.omit()`/`.partial()` that
  still retains the field, see `class-extensibility`), if the payload
  includes a value for that field, parsing REJECTS with a `ValidationError`
  on that field's path — it is never silently dropped/ignored. Creation
  flows (first parse, no prior record) are unaffected — the field is
  writable exactly once, at construction.
- REQ-006: Core primitives ship as first-class exports, not `Define`-based
  wrappers: `Uuid`, `Timestamp`, `DateTime`, `Nullable`, `Optional`, `List`,
  `Text`, `Number`, `Email`, `Password`, `Ip`, `Enum`, `Version`,
  `FromZodType`. `Define` composes on top of these; it does not replace them.
- REQ-007: `FromZodType(zodSchema)` wraps an arbitrary Zod v4 schema so it can
  be used as the `BaseType` argument to `Define`, participate in `Struct`
  field declarations, and receive `message` overrides via the same
  `(path, code)` mechanism as native types (see `i18n-error-messages`).
- REQ-008: Reusable domain-type recipes documented in `INSIGHT.md` §1 (`Cep`,
  `Slug`, `PublicIp`, `TimeAgo`, `TimeBefore`, `TimeAfter`, `RowVersion`,
  `Mac`, `Domain`, `Url`, `Phone`, `Brl`, `ShortId`, `PrimaryKey`, `CreatedAt`,
  `UpdatedAt`, `DeletedAt`) are implemented as example/reference `Define`
  usages — they validate the API surface but ship as documented patterns, not
  necessarily as built-in exports (confirm with user whether any ship in
  `morphz` core vs. a separate "recipes" package).

## Affected Components (from graph)
N/A — greenfield, no graph built yet. This feature has no existing code to
touch; it is the first module written.

## Out of Scope
- Cross-field validation (belongs to `Struct`'s `post` hook, see
  `struct-entities`).
- Entity-to-entity relationships (`Ref`, `FieldOf`) — separate feature.
- i18n message resolution mechanics beyond accepting the `message` option
  shape — full resolution logic lives in `i18n-error-messages`.
- Date/time internal representation (`z.codec` wiring) — separate feature
  (`datetime-codec`); this feature only requires that `DateTime`/`Timestamp`
  exist as importable primitives.

## Open Questions
- REQ-005 mechanics: an "update/patch parse" has no access to the prior
  record by default (`morphz` is schema-only, no persistence) — so
  "rejects if payload includes a value" means ANY presence of the field in
  an update-shaped DTO's input is rejected, not a diff against a stored
  value. Confirm this reading matches intent: an `immutable` field is simply
  never accepted as input on any `Struct` variant that represents an update
  (in practice this is enforced structurally — update DTOs should
  `.omit()` immutable fields — REQ-005 is the safety net for when a DTO
  author forgets to). `class-extensibility` REQ-006 covers this interaction.
- Do any `Define` recipes from §1 (Cep, Slug, Brl, etc.) ship as part of the
  public `morphz` package, or only `PrimaryKey`/`CreatedAt`/`UpdatedAt`/
  `DeletedAt`/`RowVersion` (structural/generic) with the rest left as
  documentation examples?
- `refine`'s return-string-as-error-message convention — does the string
  become the Zod issue `message` directly, or does it still flow through the
  `message`/i18n override mechanism (REQ codes like `custom`)?
