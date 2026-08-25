# Design: JSDoc Generation (`jsdoc: true`)

## Architecture Overview

**Runtime-metadata-driven, not static-AST-driven.** Resolves the spec's
open question: instead of re-deriving labels/constraints by parsing
`Define`/`Struct` call expressions statically (what `ts-language-service
-plugin` has to do, since it runs against unbuilt source), this feature
runs strictly AFTER the consumer's own build already emitted BOTH `.js`
AND `.d.ts` — so it can `import()` the just-built JS, read each exported
class's REAL, fully-resolved `STRUCT_META` (labels already interpolated,
templates already substituted, everything the runtime itself would use),
and mirror that onto the matching `.d.ts` declaration via `ts-morph`. Zero
duplicate logic with the runtime resolver, zero risk of the static
analysis disagreeing with what actually runs.

```
consumer's own build (tsc/tsup)
   already produced: dist/index.js  +  dist/index.d.ts
        │
        ▼
morphz's jsdoc step (called by the CONSUMER's build script,
only when getConfig().jsdoc === true)
        │
        ├─ 1. dynamic import(dist/index.js) — get real exports
        │
        ├─ 2. for each export with a STRUCT_META symbol:
        │        walk STRUCT_META.fields (already-resolved descriptors)
        │
        ├─ 3. ts-morph Project.addSourceFileAtPath(dist/index.d.ts)
        │        find the matching ClassDeclaration by exported name
        │        for each field: find the matching PropertyDeclaration
        │        by name, call .addJsDoc({ description, tags })
        │
        └─ 4. sourceFile.saveSync()
```

## Resolves spec's open question #2 (class discovery)

Only classes reachable from the CONSUMER's own built entry point's exports
get documented — a class never re-exported isn't importable by anyone
either, so there's nothing meaningful to document for it. No project-wide
AST scan needed; walking `Object.entries(await import(jsEntryPath))` and
filtering by `STRUCT_META in value` is sufficient and exactly matches
"what a consumer of this package can actually see."

## Resolves spec's open question #1 (rewrite mechanism)

`ts-morph`, confirmed via Context7 (`/dsherret/ts-morph`):
`declaration.addJsDoc({ description, tags: [{ tagName, text }] })` works
on any `JSDocableNode` (covers both `ClassDeclaration` and
`PropertyDeclaration`), `sourceFile.saveSync()` persists back to disk. No
custom AST-diffing/regex-patching needed — `ts-morph` IS the chosen
post-processor.

## Constraint extraction — NOT from `meta`

`FieldDescriptorMeta` (already shipped, `define-metatypes`) does NOT carry
`min`/`max`/`regex`/`format` as separate metadata — those are baked
directly into `zodSchema` via `.regex()`/`.min()`/`.max()` calls
(`define.ts`, primitives) and never duplicated into `meta`. This means
REQ-002's `@minLength`/`@maxLength`/`@minimum`/`@maximum`/`@pattern`/
`@format` tags must be extracted by INTROSPECTING `zodSchema._zod.def`
(the SAME internal-API introspection pattern already established in
`union.ts` — discriminator detection — and `mock.ts` — format/regex
detection for synthesis). Concretely: walk `zodSchema._zod.def.checks`
(an array of check objects, each with a `_zod.def.check`
discriminator — `'min_length'`, `'max_length'`, `'string_format'` with
its own `format` field, etc.) — this is real, already-proven-working
introspection in THIS codebase, not speculative.

## `@example` sanitization (REQ-003)

```ts
function sanitizeExample(value: unknown): string {
  const rendered = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const escaped = rendered.replace(/@/g, "&#64;");
  return typeof value === "string" && !value.includes("\n")
    ? escaped // short scalar — no fencing needed
    : `\`\`\`ts\n${escaped}\n\`\`\``;
}
```

Matches INSIGHT.md §10's documented `tsserver` JSDoc-parser quirk exactly
(an unescaped `@` inside `@example`'s body gets misread as a new tag
boundary) — this is a real, previously-documented TypeScript tooling
issue, not a hypothetical.

## The generator's own entry point

```ts
// exported from packages/core, called by the CONSUMER's build script
export async function applyJsDoc(options: {
  jsEntryPath: string; // e.g. './dist/index.js' (already built)
  dtsPath: string; // e.g. './dist/index.d.ts' (already built)
}): Promise<void>;
```

Gated internally on `getConfig().jsdoc === true` (REQ-002 from
`config-jsdoc-flag`) — a no-op (returns immediately) when the flag is
off, so consumers can unconditionally call it in their build script
without an extra `if` themselves.

## Locale resolution for i18n `description` maps

Per spec REQ-005 (already decided): `config.locale.default` ONLY — no
`AsyncLocalStorage` (no request context exists at build time). Reuses
`i18n-error-messages`'s locale-map-resolution LOGIC (pick key by locale,
fall back to `fallback`, then to the first available key) but as a small
standalone helper — NOT `resolveLocale()` itself, since that function's
AsyncLocalStorage-first behavior would be wrong here (there's no
"request" to read a locale from at build time).

## New Components

| Component                   | Responsibility                                                                      | Location                                              |
| --------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `applyJsDoc()`              | Entry point, dynamic-imports the built JS, drives the whole step                    | `packages/core/src/core/jsdoc/apply-jsdoc.ts`         |
| `extractFieldConstraints()` | `_zod.def.checks` introspection → tag list                                          | `packages/core/src/core/jsdoc/extract-constraints.ts` |
| `sanitizeExample()`         | `@`-escaping + fencing for `@example`                                               | `packages/core/src/core/jsdoc/sanitize-example.ts`    |
| `buildFieldTags()`          | Composes `description` + all tags per INSIGHT.md §10's mapping table, for one field | `packages/core/src/core/jsdoc/build-field-tags.ts`    |

## Dependency Paths

- `applyJsDoc` → `STRUCT_META` (`struct-entities`) — reads real,
  fully-resolved field descriptors.
- `extractFieldConstraints` → Zod's internal `_zod.def` shape (same
  introspection surface `union.ts`/`mock.ts` already use — no new
  dependency, just a third consumer of an already-proven pattern).
- `applyJsDoc` → `getConfig()` (`project-config`) for the `jsdoc` gate and
  `locale.default`.
- New external dependency: `ts-morph` (`packages/core`).

## Risks

- This step runs AFTER the consumer's OWN build already emitted `.d.ts` —
  meaning it must be wired into THEIR build pipeline (a `postbuild`
  script calling `applyJsDoc()`, or a `tsup`/`vite` plugin hook). This
  feature ships the FUNCTION; actually wiring it into a real consumer's
  `tsup.config.ts`/`package.json` is a DOCS/DX concern (README example),
  not something `morphz` can force — flagged so Execute doesn't
  over-promise "fully automatic" JSDoc.
- `_zod.def` is Zod's INTERNAL API (not the public `z.*` surface) —
  already accepted as a risk in this codebase (three call sites now), but
  worth a shared comment/constant noting it could break on a Zod internal
  refactor across major versions (not minor/patch, per Zod's own semver
  stability promises on its public API — this specific caveat applies
  only to `_zod.def`, not `z.string()` etc.).

## Decision Log

- Chose runtime-metadata-driven over static-AST-driven specifically
  BECAUSE `ts-language-service-plugin` already has to solve the harder,
  static version of this problem for live hover — no reason to duplicate
  that complexity here when a simpler, MORE ACCURATE approach (real
  resolved metadata, zero risk of static/runtime disagreement) is
  available for a POST-BUILD step specifically.
- `ts-morph` over hand-rolled regex/string patching on the `.d.ts` output
  — confirmed via Context7 that `addJsDoc()`/`saveSync()` are exactly the
  primitives needed, no reason to reinvent AST manipulation.
