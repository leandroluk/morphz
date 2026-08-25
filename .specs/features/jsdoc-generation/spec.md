# Spec: JSDoc Generation (`jsdoc: true`)

**Status: DONE (2026-08-25).** Implemented + tested (137/137 cumulative
pass, 16 tests for this feature). `extractFieldConstraints` (`_zod.def`
introspection, unwraps `optional`/`nullable`/`pipe`/`default`/`prefault`
before reading checks), `sanitizeExample`, `buildFieldTags`, `applyJsDoc`
(gated on `getConfig().jsdoc`, dynamic-imports the built JS, patches the
matching `.d.ts` via `ts-morph`). 3 real bugs fixed along the way:
`StructConstructor`'s construct signature returned `unknown` (blocked
`tsc` entirely for any consumer subclass — see the CRITICAL finding
below), and two Windows `file://` URL construction bugs in
`apply-jsdoc.ts`'s path handling.

**CRITICAL FINDING (separate, unscoped issue — flagged to user, not
silently fixed here):** `Struct()`'s declared return type,
`StructConstructor`, is NOT generic over `fields` — the constructor is
`new (input: unknown): object`, every method returns `unknown`. This
means NO consumer of `morphz` gets ANY field-level type inference from
TypeScript today (`user.name` isn't a recognized property on a `class
User extends Struct({ name: Text() }, {...}) {}`). This undermines
`morphz`'s core "type-safe classes for JS and TS" value proposition and
was never caught because `tsconfig.json` only includes `src/` (tests
aren't typechecked) and every existing test asserts runtime behavior only,
never actual TS inference from a consumer's perspective. This feature's
own integration test worked around it with a hand-written `.d.ts`
fixture (documented in `tasks.md`/`STATE.md`) — the underlying gap is
NOT fixed and needs its own dedicated feature (`Struct`/`Define`/every
primitive need to become properly generic, inferring field shapes via
mapped types, closer to how Zod's own `z.object()` infers). Flagged for
the user to decide scope/priority — this is a large, cross-cutting
retrofit, not a small fix.

## Summary

Per `INSIGHT.md` §9-10: `morphz.config.ts`'s `jsdoc: true` flag makes the
build propagate each field's `FieldDescriptor.meta` (`description`,
`default`, `examples`, `immutable`→`@readonly`, `writeOnly`→`@writeOnly`,
regex/min/max→`@pattern`/`@min*`/`@max*`, format→`@format`) into JSDoc
comments on the emitted `.d.ts`. Makes the schema the single source of
truth for both runtime validation AND editor hover/Intellisense.

## Requirements

- REQ-001: `jsdoc: true` in `MorphzConfig` (extends `project-config`'s
  `MorphzConfig` type — small addition, not a new config namespace).
- REQ-002: A build-time step (NOT a runtime concern — this never executes
  in the consumer's running process) reads each `Struct`-produced class's
  `STRUCT_META.fields`, generates a `.d.ts` overlay with JSDoc blocks per
  field, using the mapping table in INSIGHT.md §10 (`description` → block
  body, `default` → `@default`, `examples` → `@example`, `immutable` →
  `@readonly`, `writeOnly` → `@writeOnly`, `min`/`max` → `@minLength`/
  `@maxLength` (Text) or `@minimum`/`@maximum` (Number), `regex` →
  `@pattern`, format-checks → `@format`).
- REQ-003: `@example` sanitization — any `@` character inside an example
  value is escaped (`&#64;` or equivalent) before emission, and structured
  examples get fenced in ` ```ts `/` ```json ` blocks — prevents
  `tsserver`'s JSDoc parser from misreading an internal `@` as a new tag
  boundary (documented `tsserver` parser quirk, not speculative).
- REQ-004: Generation is a POST-BUILD step over the `.d.ts` `tsup`/`tsc`
  already emits — not a custom compiler transform. Rewrites/augments the
  generated `.d.ts` in place (or emits a companion overlay merged by the
  TS compiler's declaration-merging, whichever proves simpler in Design).
- REQ-005: Locale for `description` when it's an i18n map (per §11's
  multilingual `Define` example) resolves the SAME way `resolveLocale()`
  already does for runtime error messages, but at BUILD time uses
  `config.locale.default` only (no `AsyncLocalStorage` — there's no
  request context at build time).

## Affected Components

Depends on `define-metatypes` (`FieldDescriptor.meta` shape),
`struct-entities` (`STRUCT_META.fields`), `project-config` (`MorphzConfig`
extension, `jiti`-loaded config read at build time), `monorepo-architecture`
(lives in `packages/core`, this feature's build step runs as part of
`core`'s own `build` script — no new package needed).

## Out of Scope

- The TS Language Service Plugin's LIVE hover rendering — that's
  `ts-language-service-plugin`'s job (reads the SAME `STRUCT_META`
  metadata, but renders it live in the editor via `tsserver`, not by
  writing to `.d.ts`). This feature only produces the static `.d.ts`
  JSDoc; the plugin is a separate, richer, interactive layer.

## Resolved (design phase)

- Mechanism: `ts-morph` post-processor, confirmed via Context7
  (`ClassDeclaration`/`PropertyDeclaration.addJsDoc()` +
  `sourceFile.saveSync()`), run strictly AFTER the consumer's own
  build already emitted `.js`+`.d.ts`.
- Class discovery: runtime-metadata-driven, NOT static-AST-driven —
  `import()`s the just-built `.js`, walks its exports for anything
  carrying a `STRUCT_META` symbol. Only classes reachable from the built
  entry point's exports get documented (consistent: a class never
  re-exported isn't importable by a consumer either, so there's nothing
  to document). See `design.md` for the full rationale (this choice
  deliberately avoids duplicating `ts-language-service-plugin`'s much
  harder static-analysis problem).
- **New finding**: `min`/`max`/`regex`/`format` are NOT in
  `FieldDescriptorMeta` (`define-metatypes` never stored them there —
  they're baked directly into `zodSchema`). REQ-002's constraint tags
  must be extracted via `zodSchema._zod.def.checks` introspection (same
  internal-API pattern `union.ts`/`mock.ts` already use), not read off
  `meta`.
  documented.
