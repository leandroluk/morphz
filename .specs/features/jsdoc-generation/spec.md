# Spec: JSDoc Generation (`jsdoc: true`)

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

## Open Questions

- Exact mechanism for rewriting `.d.ts`: parse-and-patch the emitted file
  (regex/AST over the `.d.ts` output) vs. a custom `ts-morph`-based
  post-processor vs. a `tsup`/`rollup` plugin hook. Needs a concrete choice
  in Design — this is real engineering, not a detail.
- How does the generator find EVERY `Struct`-produced class in the
  package to process? Needs either an explicit manifest/barrel (`export *
from` in `index.ts`, walked via the TS `Program`) or a full-project AST
  scan. Affects whether classes NOT re-exported from `index.ts` get
  documented.
