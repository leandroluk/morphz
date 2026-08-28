# Editor Tooling

`morphz` ships a **TypeScript Language Service Plugin** (`morphz/ts-plugin`) that
runs inside the `tsserver` process your editor already hosts — no extra Node
daemon, no separate LSP server. It reuses the AST and type-checker state
TypeScript keeps in memory.

There are two ways to activate it: a one-line `tsconfig.json` entry that works in
**any** editor, or the **morphz editor extension**, which does it for you.

## Editor extensions

The extension is published under a single ID — `leandroluk.morphz-vscode` — to
two registries, covering every VS Code-family editor:

| Registry                                                                                                  | Install from                                                               | Editors it serves                                                        |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=leandroluk.morphz-vscode) | VS Code — Extensions view, search **morphz**                               | Visual Studio Code (stable & Insiders)                                   |
| [Open VSX](https://open-vsx.org/extension/leandroluk/morphz-vscode)                                       | Cursor / VSCodium / Windsurf / Gitpod — Extensions view, search **morphz** | Cursor, VSCodium, Windsurf, Gitpod, Eclipse Theia, any Open VSX consumer |

Both registries serve the same `.vsix`, built and published from one CI job on
every release — versions never diverge.

### What you get

The extension is a thin **activation layer**. On any workspace that has `morphz`
in its `package.json`, it registers `morphz/ts-plugin` through VS Code's standard
`contributes.typescriptServerPlugins` hook — the same mechanism Vue Language
Features and the Angular Language Service use — so the plugin loads inside the
editor's own `tsserver`. Nothing to configure, no `tsconfig.json` edit, no
background process. Uninstalling the extension fully removes the behavior.

All the language features below (hover, completions, diagnostics, i18n) come from
the plugin, not the extension — they are identical whether you activate via the
extension or the `tsconfig.json` entry.

### Requirements

- `morphz` listed in the project's `package.json` (`dependencies` or
  `devDependencies`) — the extension no-ops in unrelated workspaces.
- The editor must use the **workspace** TypeScript version. VS Code-family
  editors do this automatically when the project has a `typescript` dependency;
  if prompted, pick _"Use Workspace Version"_ (command palette → _TypeScript:
  Select TypeScript Version_).

### Status bar

A **morphz** item appears in the status bar when the open file's workspace looks
like a `morphz` consumer. It is a best-effort _"should be active"_ signal — VS
Code exposes no API to confirm a contributed `tsserver` plugin actually loaded,
so it is not a hard guarantee.

## Enable it without the extension

### Any editor / plain `tsc`

`npx morphz init` adds this for you; by hand it is:

```json
// tsconfig.json
{
  "compilerOptions": {
    "plugins": [{ "name": "morphz/ts-plugin" }]
  }
}
```

Works anywhere `tsserver` runs — Neovim (`typescript-tools` / `tsserver`),
WebStorm / other JetBrains IDEs, Sublime (LSP-typescript), plain `tsc`. VS Code
still needs the workspace TypeScript version selected (see Requirements above).

Use this instead of the extension when your editor has no Open VSX / Marketplace
access, or when you want the plugin active in CI type-checks too.

## What the plugin does

### Resolved hover

Hovering a `Define`, `Struct`, or a declared property renders a Markdown popup
with template variables already interpolated (`#entityName` → `"User"`) and the
active rules:

```
(property) username: string

📝 Friendly textual identifier (slug) for User
⚙️ Regex: /^[a-z0-9-]+$/
🏷️ Origin: Define(Text) -> Slug
📌 Interpolated label: #entityName => "User"
```

### Contextual autocomplete

- typing the template delimiter (`#`) inside a `description` string suggests the
  labels in scope (`#entityName`, `#module`, …)
- `FieldOf(User, "…")` suggests the real field keys of `User`

### Semantic diagnostics

- a template referencing a label not defined on the `Struct` or in
  `morphz.config.ts` is underlined as a warning / error
- a `post` hook calling `ctx.addIssue({ path: ["…"] })` with a path that isn't a
  field of the entity is flagged

## Tooling i18n

Code and docs default to `en-US`. Descriptions can be multilingual:

```ts
export const Slug = Define(Text, {
  description: {
    "en-US": "Friendly textual identifier (slug) for #entityName",
    "pt-BR": "Identificador textual amigável (slug) de #entityName",
  },
  regex: /^[a-z0-9-]+$/,
});
```

Locale resolution in the editor: `morphz.config.ts` `locale.default` → IDE locale
(`vscode.env.language` / `Intl.DateTimeFormat().resolvedOptions().locale`) →
`en-US` fallback.

## Automatic JSDoc

With `jsdoc: true` in `morphz.config.ts`, semantic metadata is propagated to the
generated types as JSDoc tags, so hover works even without the plugin:

| Schema metadata                | JSDoc tag                   |
| ------------------------------ | --------------------------- |
| `description`                  | block body                  |
| `default`                      | `@default`                  |
| `examples` / `example`         | `@example`                  |
| `immutable: true` / `readOnly` | `@readonly`                 |
| `writeOnly: true`              | `@writeOnly`                |
| `deprecated: true`             | `@deprecated`               |
| `min` / `max` (Text)           | `@minLength` / `@maxLength` |
| `min` / `max` (Number)         | `@minimum` / `@maximum`     |
| `regex` / `pattern`            | `@pattern`                  |
| `format`                       | `@format`                   |

`@example` blocks that contain `@`-prefixed decorators are wrapped in fenced
` ```ts ` / ` ```json ` and the inner `@` is escaped (`&#64;`) so
`tsserver` doesn't misparse it as a new tag and truncate the hover.
