# Design: TypeScript Language Service Plugin

## Architecture Overview

Standard `tsserver` plugin shape, confirmed via Context7 against the
OFFICIAL TypeScript wiki page ("Writing a Language Service Plugin",
`/microsoft/typescript`) — this is a stable, ~8-year-unchanged public API:

```ts
function init(modules: { typescript: typeof import("typescript/lib/tsserverlibrary") }) {
  function create(info: ts.server.PluginCreateInfo): ts.LanguageService {
    const proxy: ts.LanguageService = Object.create(null);
    for (const k of Object.keys(info.languageService) as (keyof ts.LanguageService)[]) {
      const x = info.languageService[k]!;
      // @ts-expect-error — standard pass-through decorator pattern
      proxy[k] = (...args) => x.apply(info.languageService, args);
    }
    proxy.getQuickInfoAtPosition = wrapHover(info, ts);
    proxy.getCompletionsAtPosition = wrapCompletions(info, ts);
    proxy.getSemanticDiagnostics = wrapDiagnostics(info, ts);
    return proxy;
  }
  return { create };
}
export = init;
```

`info.languageService` = the REAL underlying LS (call it for the "prior"
result, then enrich/filter). `info.project` = for logging
(`info.project.projectService.logger.info(...)`, useful for debugging a
running plugin — no console.log, tsserver's stdout is the protocol
channel). `info.languageService.getProgram()` gives the `ts.Program` →
`.getTypeChecker()` for symbol resolution.

## Static AST analysis, not runtime `STRUCT_META`

Confirmed in spec.md's "Affected Components": the plugin analyzes SOURCE
(often unbuilt, sometimes even uncompilable mid-edit) — it can never
`require()` a consumer's compiled `STRUCT_META`. Every piece of
information the runtime computes from `Define`/`Struct` calls must be
RE-DERIVED by walking the AST + `TypeChecker` symbol resolution instead.
This is a fundamentally different, independent code path from
`packages/core`'s own `resolveTemplates`/`STRUCT_META` — intentionally
so, but the LOGIC (delimiter substitution, label lookup, locale fallback
order) should mirror it to avoid disagreement between what the plugin
shows and what the runtime actually does.

## Core AST helpers (`src/ast-utils.ts`)

- `findNodeAtPosition(sourceFile, position)`: standard `ts.forEachChild`
  descent to the deepest node containing `position` (the well-known
  `getTokenAtPosition`-style traversal every TS tooling project
  reimplements — no public API exports this directly).
- `isStructCallExpression(node, checker)`: `node` is a `CallExpression`
  whose callee resolves (via `checker.getSymbolAtLocation`) to the
  `Struct` export from `morphz`. Returns the call's `fields` (arg 0,
  expects an `ObjectLiteralExpression`) and `options` (arg 1, optional
  `ObjectLiteralExpression`) nodes.
- `isDefineCallExpression(node, checker)`: same idea for `Define` calls
  — returns the `BaseType` arg and `options` object literal.
- `getObjectLiteralProperty(obj: ObjectLiteralExpression, name: string)`:
  finds a `PropertyAssignment` by key, small utility reused everywhere
  (`labels`, `description`, `regex`, `path`, etc.).

## `getQuickInfoAtPosition` — REQ-002

Scope (per INSIGHT.md §11.A's own example — hover happens ON the field
DECLARATION site inside a `Struct({...})` call, e.g. `username: Slug()`,
not a later usage site — simpler AND matches the doc precisely):

1. `findNodeAtPosition` → walk ancestors to find an enclosing
   `PropertyAssignment` whose parent `ObjectLiteralExpression` is a
   `Struct(...)` call's `fields` argument (via `isStructCallExpression`
   on further ancestor walk).
2. The property's VALUE is a `CallExpression` (`Slug()`, `Email({...})`)
   — resolve its callee identifier's symbol → declaration. If that
   declaration is itself `export const Slug = Define(Text, {...})`,
   statically read `Define`'s second-argument object literal for
   `description`/`regex`/`examples` (same `getObjectLiteralProperty`
   helper). If the field call has ITS OWN inline overrides
   (`Email({ description: '...' })`), merge those on top (own args win —
   mirrors `mergeDescriptor`'s real shallow-overwrite semantics).
3. Resolve `#placeholder`s in the found `description` against the
   enclosing `Struct(...)` call's `options.labels` object literal
   (static key/value read — values must be string literals to resolve,
   degrade gracefully — show the unresolved `#placeholder` literally —
   for anything computed/non-literal, this is a best-effort DX layer,
   not required to handle every possible expression shape).
4. Call `info.languageService.getQuickInfoAtPosition` for the PRIOR
   result (TS's own default hover — property name + inferred type from
   `struct-type-inference`'s now-working generics), then APPEND our
   resolved info into `prior.documentation` (an array of
   `SymbolDisplayPart`s) — enrich, don't replace, so the user still sees
   the normal `(property) username: string` TS already shows.

## `getCompletionsAtPosition` — REQ-003

Two independent trigger contexts, dispatched by walking `findNodeAtPosition`:

- **(a) Label completion**: cursor inside a `StringLiteral`, and that
  string's nearest ancestor chain leads to a `Struct(...)` call (the
  string is somewhere in that call's `fields` object, in a `description`
  position). Walk UP to that `Struct(...)` call, read its `options.labels`
  object literal's keys (`entityName`, `module`, etc.) — offer each,
  PREFIXED with the configured delimiter (default `#`, or read from a
  `morphz.config.ts` in the project if resolvable via
  `info.languageServiceHost.getScriptFileNames()`/a simple file read —
  best-effort, falls back to `#` if not found), as `CompletionEntry`s
  with `kind: ts.ScriptElementKind.string` when the user has just typed
  the delimiter character.
- **(b) `FieldOf` second-arg completion**: cursor inside `FieldOf(X,
"|")`'s second argument string literal. Resolve `X`'s symbol →
  declaration (a `class extends Struct(...)`) → that `Struct(...)` call's
  `fields` object literal's property KEYS — offer each as a
  `CompletionEntry`.
- Both delegate to `info.languageService.getCompletionsAtPosition` for
  the prior result and MERGE entries in (rather than replacing) — TS's
  own string-literal completions (e.g. nothing, usually) stay available.

## `getSemanticDiagnostics` — REQ-004

Walk the WHOLE `SourceFile` once (via `ts.forEachChild` recursive visit,
standard pattern — no incremental/cached AST diffing needed for a v1,
correctness over micro-optimization) collecting two issue classes,
APPENDED to `info.languageService.getSemanticDiagnostics(fileName)`'s
prior array (never replace — TS's own diagnostics must still surface):

- **(a) Broken template**: every `description` string literal found
  inside a `Struct(...)`'s fields (same discovery as hover) — regex-scan
  for `#\w+` placeholders, check each against that Struct call's
  `options.labels` keys (own author is unlikely to also check
  `morphz.config.ts`'s auto-derivation function in v1 — that's a runtime-
  only fallback that can't be statically evaluated in general; document
  this as a known false-positive source, not silently pretend it's
  handled) — unmatched placeholder → `ts.Diagnostic` at that string's
  span, `category: ts.DiagnosticCategory.Warning`, a private `code`
  (any unused 6-digit number in `morphz`'s own reserved range, e.g.
  `900001`), `source: 'morphz'`.
- **(b) Bad `post`-hook path**: every `Struct(...)` call's `options.post`
  arrow/function body — find `ctx.addIssue({ path: [...] })` call
  expressions (match by property name `path` on an object literal
  argument to a call whose callee is `.addIssue` on the hook's `ctx`
  parameter), read the array literal's string-literal elements, check
  the FIRST segment against that Struct's fields object's keys — no
  match → warning at that array literal's span.

## Locale resolution (REQ-005, spec's open question resolved)

Confirmed (no further Context7 lookup needed — this is a Node/host
capability question, not a TS API question): `vscode.env.language` is
VSCode-EXTENSION-API-only, not reachable from a bare `tsserver` plugin
(the plugin runs inside `tsserver`'s own process, which VSCode spawns as
a plain Node child process with no VSCode API surface injected into it).
The only realistic host-agnostic signal is `Intl.DateTimeFormat()
.resolvedOptions().locale` (Node's own OS locale) — INSIGHT.md §11.D's
"IDE locale" step effectively degrades to "OS locale" for every host,
including VSCode, when running as a real `tsserver` plugin. Cascade:
`morphz.config.ts`'s `locale.default` (read via a best-effort file lookup

- the SAME `discoverConfig()`-style search, or skip gracefully if it
  can't be loaded synchronously in-process) → `Intl.DateTimeFormat()
.resolvedOptions().locale` → `'en-US'`.

## New Components (`packages/ts-plugin/src/`)

| Component                 | Responsibility                                                                                       | Location                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `index.ts`                | `init`/`create`, builds the pass-through proxy, wires the 3 overrides                                | `index.ts` (replaces the current stub) |
| `ast-utils.ts`            | `findNodeAtPosition`, `isStructCallExpression`, `isDefineCallExpression`, `getObjectLiteralProperty` | `ast-utils.ts`                         |
| `resolve-field-info.ts`   | Field declaration → resolved description/regex/format/`Define` chain                                 | `resolve-field-info.ts`                |
| `features/hover.ts`       | `getQuickInfoAtPosition` wrapper                                                                     | `features/hover.ts`                    |
| `features/completions.ts` | `getCompletionsAtPosition` wrapper (both trigger contexts)                                           | `features/completions.ts`              |
| `features/diagnostics.ts` | `getSemanticDiagnostics` wrapper (both checks)                                                       | `features/diagnostics.ts`              |
| `resolve-locale.ts`       | Plugin-local locale cascade (config → OS → `en-US`)                                                  | `resolve-locale.ts`                    |

## Testing strategy (no real editor needed)

`typescript`'s own `@typescript/vfs`/`createVirtualTypeScriptEnvironment`
(surfaced by Context7 too) lets a plugin's `create(info)` be exercised
against an IN-MEMORY virtual project + language service in a plain
`vitest` test — no real VSCode/tsserver process needed to verify hover/
completion/diagnostic behavior. Confirm this package (or an equivalent
minimal harness building a real `ts.LanguageService` over an in-memory
`ts.LanguageServiceHost`) is added as a devDependency in
`packages/ts-plugin` for Execute — THIS is how DEV/QA verify real
behavior (call `proxy.getQuickInfoAtPosition(...)` directly and assert
on the returned `QuickInfo`), not by manually opening an editor.

## Risks

- AST-shape matching (`Struct(...)`/`Define(...)` call detection, object-
  literal property walks) is inherently best-effort against arbitrary
  consumer code shapes (destructured imports, re-exported wrappers,
  spread `...commonFields` inside a fields object, etc.) — v1 explicitly
  targets the DIRECT literal-call shapes INSIGHT.md's own examples show;
  anything more exotic silently gets NO enrichment (falls back to prior/
  default TS behavior) rather than crashing — a `try/catch` boundary
  around each override is a hard requirement, not optional, since a
  throwing LS method can degrade or crash the WHOLE editor's TS
  experience for the user, not just this plugin's feature.
- `getSemanticDiagnostics` walking the whole file on every call could be
  slow on large files — acceptable for v1 (tsserver already caches/
  debounces diagnostic requests itself), but flagged as a real
  perf-tuning opportunity for later (e.g. memoizing per-`SourceFile`
  version) if it proves too slow in practice.

## Decision Log

- Hover scoped to the field DECLARATION site (inside `Struct({...})`),
  not usage sites (`user.username`) — matches INSIGHT.md §11.A's own
  example exactly, meaningfully simpler (no backward instance-property-
  to-field-declaration resolution needed), and still delivers the
  documented DX value (see the origin/regex/interpolated-label info
  right where the field is declared).
- Confirmed via Context7 against the OFFICIAL TypeScript wiki: the
  pass-through-proxy-then-override pattern is exactly right, not
  something to second-guess or reinvent.
- Every wrapped LS method degrades to the PRIOR (unmodified) result on
  any internal error or unrecognized AST shape — never throws, never
  makes the editor's TS experience worse than having no plugin at all.
