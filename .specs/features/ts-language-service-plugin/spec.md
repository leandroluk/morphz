# Spec: TypeScript Language Service Plugin

## Summary

Per `INSIGHT.md` §11: a `tsserver` Language Service Plugin (`morphz/ts-plugin`)
providing live, resolved hover info, template/field autocomplete, and
semantic diagnostics for `Define`/`Struct`/`FieldOf` usage — runs inside
the editor's existing `tsserver` process (no extra daemon).

## Requirements

- REQ-001: Plugin registers via the standard TS LS plugin API
  (`init({ typescript }) => ({ create(info) => ts.LanguageService })`),
  wrapping `getQuickInfoAtPosition`, `getCompletionsAtPosition`,
  `getSemanticDiagnostics`.
- REQ-002: `getQuickInfoAtPosition` — on hover over a field declared via a
  `Define`-produced factory (`Slug()`, `Email()`, etc.) inside a `Struct`
  call, renders the resolved (template-interpolated) description, active
  regex/format, and `Define` origin chain, matching INSIGHT.md §11.A's
  mock popup content.
- REQ-003: `getCompletionsAtPosition` — two contexts: (a) inside a
  `description` string literal, typing the configured template delimiter
  (`#` by default) triggers completion of labels in scope for that
  `Struct` call; (b) inside `FieldOf(SourceStruct, "...")`'s second
  argument, completions are restricted to `SourceStruct`'s actual declared
  field names (reading `STRUCT_META.fields` via static analysis of the
  `SourceStruct` identifier's declaration).
- REQ-004: `getSemanticDiagnostics` — two checks: (a) a template
  placeholder (`#foo`) with no matching key in the `Struct`'s `labels` (nor
  `morphz.config.ts`'s global label-derivation) surfaces a warning at that
  string literal's position; (b) a `post` hook's `ctx.addIssue({ path:
[...] })` referencing a field name not in that `Struct`'s field record
  surfaces a warning.
- REQ-005: Locale resolution for the SAME multilingual `description`/hover
  content follows INSIGHT.md §11.D's cascade: `morphz.config.ts`'s
  `locale.default` → IDE/OS locale (`vscode.env.language` equivalent, or
  `Intl.DateTimeFormat().resolvedOptions().locale` as a host-agnostic
  fallback since the plugin runs inside `tsserver`, not directly inside
  VSCode's extension host — confirm what locale signal is actually
  available to a plain LS plugin, see Open Questions) → `en-US`.

## Affected Components

Lives in `packages/ts-plugin` (new workspace package, per
`monorepo-architecture`). Consumes `packages/core`'s exported
`STRUCT_META`/`FieldDescriptor` shapes for static analysis — but CANNOT
just `require()` the consumer's runtime code to read `STRUCT_META` (the
plugin runs against SOURCE, often before/without a build); it must work
by **static AST analysis** of the `Define`/`Struct`/`FieldOf` CALL
EXPRESSIONS in the consumer's `.ts` files, re-deriving the same
label/field information the runtime would compute, using the TS
`Program`'s type checker — this is a fundamentally different code path
from `core`'s own runtime `resolveTemplates`/`STRUCT_META`, not a reuse of
it (though the LOGIC — delimiter substitution, label lookup — should
mirror it exactly to avoid the plugin and the runtime disagreeing).

## Out of Scope

- Any editor OTHER than ones using `tsserver` (this is a `tsserver`-only
  mechanism — VSCode, WebStorm, Neovim's built-in LSP client via
  `typescript-language-server` all route through it; a hypothetical
  non-TS-based tool would not).
- `packages/vscode`'s marketplace extension — separate, optional,
  unscoped in this batch (per `monorepo-architecture`'s Out of Scope).

## Open Questions

- This is the single most novel/highest-effort item in the whole batch —
  writing a real `tsserver` plugin requires deep familiarity with the TS
  Compiler API (`ts.LanguageService` wrapping, `ts.Program`/`TypeChecker`
  traversal, `SourceFile` AST node matching for `Define(...)`/`Struct(...)`
  call expressions). Needs a dedicated Design pass with Context7 lookups
  against the `typescript` package's LS plugin API before any Execute
  work — flagging this explicitly rather than understating the scope.
- Locale signal availability inside a bare `tsserver` plugin (no direct
  access to `vscode.env.language` — that's VSCode-extension-API-only, not
  exposed to a portable LS plugin) — needs confirming what's actually
  readable; `Intl.DateTimeFormat().resolvedOptions().locale` (Node's own
  OS locale) may be the only realistic host-agnostic signal, making
  INSIGHT.md §11.D's "IDE locale" step effectively degrade to "OS locale"
  for any host other than a VSCode-specific companion extension.
- Should this feature be attempted at all in this batch, given its scope
  vs. the other 5 items? Flagging for explicit build-order confirmation —
  recommend building it LAST, after the smaller wins (`mock-fixtures`,
  `data-masking`, `config-jsdoc-flag`) land, and treating it as its own
  multi-session effort rather than a single DEV/QA fork pass like the
  others.
