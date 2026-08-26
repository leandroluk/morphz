# Spec: VSCode Extension

## Summary

A real VSCode extension packaging `morphz`'s TS Language Service Plugin
(`packages/ts-plugin`, feature `ts-language-service-plugin`) so a developer
gets hover/completions/diagnostics for `Struct`/`Define` fields with zero
manual `tsconfig.json` editing — the same "just install and it works" DX as
the Tailwind CSS IntelliSense extension. User explicitly confirmed this is
NOT optional (INSIGHT.md §14 marks `packages/vscode` "(Opcional)", but the
user overrode that).

User's own framing (verbatim intent): "a idéia da extensão é facilitar o
linter e intelisense como o tailwindcss faz" — the extension's job is
DX/activation, not reimplementing language features. Tailwind CSS
IntelliSense's own feature set (autocomplete, hover previews, lint
diagnostics for invalid/conflicting values) is already fully covered by the
existing `ts-language-service-plugin` feature riding on `tsserver`'s real
LanguageService API. This extension does NOT reimplement hover/completions/
diagnostics logic — it makes the already-built plugin activate automatically
in the editor.

## Requirements

- REQ-001: Extension auto-registers `morphz`'s TS Language Service Plugin
  for any workspace with `morphz` as a dependency, via VSCode's official
  `contributes.typescriptServerPlugins` contribution point — zero
  `tsconfig.json` editing, matches how Vue/Angular language extensions work.
- REQ-002: Plugin activates against the workspace's own TypeScript version
  (respects `typescript.tsdk`), not a version bundled into the extension —
  the plugin package itself must be resolvable from the workspace's
  `node_modules/morphz` (Node module resolution from tsserver's plugin
  loader), matching the existing `ts-language-service-plugin` design.
- REQ-003: Status bar item (or equivalent minimal UI) shows whether the
  plugin is currently active for the open TS file, and surfaces a clear
  message when `morphz` isn't a workspace dependency (extension does
  nothing silently broken — it's either active or visibly inactive).
- REQ-004: Zero new runtime processes — matches
  `ts-language-service-plugin`'s "ultra-leve" principle (INSIGHT.md §14):
  no bundled LSP server, no extra Node process. All actual language
  features run inside `tsserver`'s own process via the plugin.
- REQ-005: Extension activates lazily (`onLanguage:typescript` /
  `onStartupFinished`-class activation event), never eagerly on VSCode
  startup for unrelated workspaces.
- REQ-006: `README.md` for the extension (marketplace listing copy) —
  what it does, requires `morphz` as a dependency, screenshot placeholders.

## Affected Components (no graph — degraded mode, direct inspection)

- `packages/vscode/package.json` — currently a placeholder scaffold
  (`main: ./dist/extension.js`, empty `activationEvents`, no
  `contributes`). This feature replaces the placeholder with a real
  manifest + `src/extension.ts`.
- `packages/ts-plugin` (`ts-language-service-plugin`, DONE) — the plugin
  this extension activates. No code changes expected there.
- `packages/core/package.json` — **real gap found during this Specify
  pass**: `monorepo-architecture`'s STATE.md decision recorded "ts-plugin
  distributes as a subpath export bundled into `core`'s dist" but the
  actual `exports` map only has `.`, `./register`, `./recipes` — no
  `./ts-plugin` subpath, and `packages/core/tsup.config.ts` never bundles
  `packages/ts-plugin`'s output into `core`'s `dist/`. This extension
  cannot function without that gap closed first (REQ-001's plugin `name`
  must resolve from the user's installed `morphz` package) — treated as a
  blocking prerequisite of this feature's Execute phase, not new scope.

## Out of Scope

- Reimplementing hover/completions/diagnostics — already done by
  `ts-language-service-plugin`, this extension only activates it.
- Any custom webview, sidebar panel, or code-lens UI beyond the status bar
  — Tailwind CSS IntelliSense itself has no such UI either (it's a thin
  LSP-client extension); matching that shape, not exceeding it.
- Automatic `tsconfig.json`/`morphz.config.ts` mutation — REQ-001's
  `contributes.typescriptServerPlugins` mechanism makes this unnecessary.
- Cursor/Neovim/WebStorm packaging — INSIGHT.md §14 already confirms the
  plugin itself works everywhere via `tsserver`; only the VSCode
  Marketplace _extension wrapper_ is this feature's concern.

## Open Questions

- **Resolved** (2026-08-25): user wants a GitHub Actions pipeline that
  publishes all 3 release artifacts together — `morphz` (npm), and this
  extension to BOTH VSCode Marketplace and Open VSX (Cursor/VSCodium/etc.
  read from Open VSX, not the Microsoft Marketplace). Specced as its own
  feature, `release-pipeline` (see `.specs/features/release-pipeline/`),
  since it's a cross-cutting concern (also covers `packages/core`'s
  never-addressed npm publish) rather than part of this extension's own
  Design. This feature (`vscode-extension`) only needs to produce a
  buildable `.vsix` via `vsce package` — `release-pipeline` owns the
  actual `publish` steps + required secrets (`NPM_TOKEN`, `VSCE_PAT`,
  `OVSX_PAT` — user provides these as GitHub repo secrets, out of my
  control to create).
