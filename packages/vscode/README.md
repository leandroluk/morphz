# morphz for VSCode

Editor support for [`morphz`](https://github.com/leandroluk/morphz) — a
Zod v4 + class-based, type-safe OO layer.

## What it does

Activates `morphz`'s TypeScript Language Service Plugin for any workspace
that has `morphz` as a dependency, giving you inside `Struct`/`Define`
declarations:

- **Hover** — resolved description, regex/format, and examples for each
  field, pulled from its `Define` origin chain.
- **Completions** — `#label`-style template references and `FieldOf`
  second-argument field names.
- **Diagnostics** — broken template references and invalid post-hook
  `ctx.addIssue` paths, flagged directly in the Problems panel.

There is nothing to configure. The extension registers the plugin via
VSCode's standard `contributes.typescriptServerPlugins` mechanism — the
same activation path used by extensions like Vue Language Features or the
Angular Language Service — so it runs inside VSCode's own `tsserver`
process. No extra language server, no background process, no
`tsconfig.json` edits.

## Requirements

- `morphz` must be listed in your project's `package.json`
  (`dependencies` or `devDependencies`).
- VSCode's TypeScript version must be the workspace version (VSCode does
  this by default when a `typescript` dependency is present; if prompted,
  choose "Use Workspace Version").

## Status bar

A `morphz` item in the status bar shows whether the currently open file's
workspace looks like a `morphz` consumer. This is a best-effort signal —
VSCode doesn't expose whether a contributed TS server plugin actually
loaded inside `tsserver`, so treat it as "should be active", not a
guarantee.

## Related

Language features themselves are implemented in `morphz`'s TS Language
Service Plugin (bundled with the `morphz` npm package, not this
extension) — this extension is purely the activation layer.
