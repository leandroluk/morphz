# Editor Tooling

`morphz` ships a **TypeScript Language Service Plugin** (`morphz/ts-plugin`) that
runs inside the `tsserver` process your editor already hosts — no extra Node
daemon, no separate LSP server. It reuses the AST and type-checker state
TypeScript keeps in memory.

## Enable it

### Any editor / plain `tsc`

```json
// tsconfig.json
{
  "compilerOptions": {
    "plugins": [{ "name": "morphz/ts-plugin" }]
  }
}
```

VS Code additionally needs the workspace TypeScript version selected
("TypeScript: Select TypeScript Version" → "Use Workspace Version").

### VS Code / Cursor — zero-config

Install the **morphz** extension (`morphz-vscode`) from the
[VS Marketplace](https://marketplace.visualstudio.com/items?itemName=leandroluk.morphz-vscode)
or [Open VSX](https://open-vsx.org/extension/leandroluk/morphz-vscode). It
activates `morphz/ts-plugin` with no `tsconfig.json` edit.

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
