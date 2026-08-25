# Tasks: JSDoc Generation

## T-001: `extractFieldConstraints()` — Zod internal introspection

- **REQ**: REQ-002
- **What**: walk `zodSchema._zod.def.checks` for min/max length, min/max
  numeric, regex, format-check discriminator; return a tag list.
- **Where**: `src/core/jsdoc/extract-constraints.ts`
- **Depends on**: none
- **Done when**: a `Text({min,max,regex})`-based descriptor's schema
  yields correct `@minLength`/`@maxLength`/`@pattern`; a `Number({min,max})`
  yields `@minimum`/`@maximum`; an `Email()`/`Uuid()` yields `@format`.
- **Gate**: `npx vitest run -- extract-constraints`

## T-002: `sanitizeExample()`

- **REQ**: REQ-003
- **What**: `@`-escape + fence per the design.md algorithm.
- **Where**: `src/core/jsdoc/sanitize-example.ts`
- **Depends on**: none
- **Done when**: a value containing `@Transform` doesn't produce a broken
  JSDoc block when rendered (verify by parsing the produced string back
  through TS's own JSDoc parser or a structural check for unescaped `@`
  outside a fence).
- **Gate**: `npx vitest run -- sanitize-example`

## T-003: `buildFieldTags()` — mapping table composition

- **REQ**: REQ-002
- **What**: composes `description` (locale-resolved) + `@default`/
  `@example`/`@readonly`/`@writeOnly` + T-001's constraint tags, per
  INSIGHT.md §10's table.
- **Where**: `src/core/jsdoc/build-field-tags.ts`
- **Depends on**: T-001, T-002
- **Done when**: a field with `immutable`+`writeOnly`+`examples`+
  `description` produces all 4 corresponding tags correctly.
- **Gate**: `npx vitest run -- build-field-tags`

## T-004: `applyJsDoc()` — the entry point

- **REQ**: REQ-001, REQ-004, REQ-005
- **What**: gated on `getConfig().jsdoc`; dynamic-`import()`s the built
  JS; for each `STRUCT_META`-carrying export, opens the `.d.ts` via
  `ts-morph`, finds the matching `ClassDeclaration`/`PropertyDeclaration`
  by name, calls `.addJsDoc()` with T-003's output; `saveSync()`.
- **Where**: `src/core/jsdoc/apply-jsdoc.ts`
- **Depends on**: T-003
- **Done when**: run against a real built fixture package (a tiny `Struct`
  class + tsup build in a temp dir), the resulting `.d.ts` has correct
  JSDoc on the right properties; running with `jsdoc: false`/unset is a
  no-op (file untouched).
- **Gate**: `npx vitest run -- apply-jsdoc`

**Total**: 4 tasks, mostly sequential (T-001/T-002 parallelizable `[P]`).
