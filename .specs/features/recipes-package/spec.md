# Spec: `morphz/recipes` (convenience `Define` presets)

## Summary
Ships `INSIGHT.md` §1's reference `Define`-based recipes as an OPTIONAL
subpath export (`morphz/recipes`), NOT part of the main `morphz` entry
point. Resolved with user: not required by `INSIGHT.md`'s own import block
(§1's recipes are demonstrated as userland code), but shipped anyway as a
convenience so consumers don't have to hand-write the well-known ones.

## Requirements
- REQ-001: New subpath `morphz/recipes` (own `tsup` entry, own `exports`
  map entry in `packages/core/package.json`, mirroring the existing
  `./register` subpath pattern).
- REQ-002: Exports every recipe from `INSIGHT.md` §1: `PrimaryKey`,
  `CreatedAt`, `UpdatedAt`, `DeletedAt`, `Cep`, `Slug`, `PublicIp`,
  `TimeAgo`, `TimeBefore`, `TimeAfter`, `RowVersion`, `Mac`, `Domain`,
  `Phone`, `Brl`, `ShortId` — each built EXACTLY per `INSIGHT.md`'s own
  code (same `Define(...)` calls, same regex/refine/description), using
  already-shipped primitives (`Uuid`, `Timestamp`, `DateTime`, `Nullable`,
  `Text`, `Number`, `Version`) and the already-installed `nanoid`
  dependency (`ShortId`'s default).
- REQ-003: `PublicIp` uses the shipped `Ip({version: 'v4'})` primitive.
  `RowVersion` uses the shipped `Version({type: 'incr'})` primitive.
- REQ-004: These are PLAIN re-exports of `Define(...)` results — no new
  mechanism, no changes to `Define`/`Struct`/any core file. Purely
  additive, zero risk to existing functionality.
- REQ-005: Since these are NOT in `morphz`'s main entry, importing them
  requires `import { PrimaryKey } from 'morphz/recipes'` — different from
  `INSIGHT.md`'s own examples which show them as already-declared local
  constants (no import shown at all, implying userland). Document this
  distinction clearly (a short comment/README note) so it's clear
  `morphz/recipes` is morphz's own opinionated starter set, not a literal
  transcription of INSIGHT.md's implied userland pattern.

## Affected Components
New file(s) only, `packages/core/src/recipes/*.ts` or a single
`src/recipes.ts` barrel — no existing file touched.

## Out of Scope
- Any NEW recipe not explicitly in `INSIGHT.md` §1.
- Locale/i18n `message` maps for these recipes (§1's examples don't show
  any `message` option on them — only `description`/`regex`/`refine`/
  `default`/`immutable`/`examples`).

## Open Questions
None.
