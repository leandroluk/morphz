# Project: morphz

## What
`morphz` is a TypeScript schema/validation library built on top of Zod v4. It
introduces class-based `Struct` entities that parse into real class instances
(not plain objects), reusable field-level meta-types (`Define`) with templated
descriptions/i18n messages, entity relationships (`Ref`, `FieldOf`), embedded
value objects (`Embed`), and codec-based date handling for OpenAPI/JSON Schema
compatibility.

## Why
Zod alone produces anonymous plain-object results and has no first-class way to:
- reuse a "recipe" of validation rules (regex/refine/description/i18n message)
  across many fields under a single named type (`Cep`, `Slug`, `Email`, ...)
- parse directly into a real class instance with domain methods (`isAdmin()`)
  and `instanceof` support
- express entity-to-entity relationships (lazy `Ref`) vs. field-type reuse
  (`FieldOf`) as distinct concepts
- represent dates in a way that survives `z.toJSONSchema()` without becoming
  an unrepresentable/empty schema

`morphz` closes these gaps as a layer on top of Zod v4, not a replacement.

## Source of truth
Design captured in `INSIGHT.md` (repo root) — read for full rationale on each
decision. `.specs/features/` breaks that insight down into implementable specs.

## Status
Greenfield. No source code yet — repo currently contains only `INSIGHT.md`.
Not yet a git repository.
