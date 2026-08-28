<h1 align="center">morphz</h1>

<p align="center">
  Zod v4 + a class-based, type-safe OO layer for your domain model — <code>Struct</code>
  entities, <code>Define</code> meta-types, real class instances from <code>.parse()</code>,
  cascading labels, i18n error messages, JSON-Schema-safe date codecs, and first-class
  editor tooling.
</p>

<div align="center">
  <a href="https://www.npmjs.com/package/morphz">
    <img src="https://img.shields.io/npm/v/morphz.svg" alt="NPM Version" />
  </a>
  <a href="https://github.com/leandroluk/morphz/blob/main/LICENSE">
    <img src="https://img.shields.io/npm/l/morphz.svg" alt="License" />
  </a>
  <a href="https://www.npmjs.com/package/morphz">
    <img src="https://img.shields.io/npm/dw/morphz.svg" alt="Downloads" />
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=leandroluk.morphz-vscode">
    <img src="https://img.shields.io/visual-studio-marketplace/v/leandroluk.morphz-vscode?label=VS%20Marketplace" alt="VS Marketplace" />
  </a>
  <a href="https://open-vsx.org/extension/leandroluk/morphz-vscode">
    <img src="https://img.shields.io/open-vsx/v/leandroluk/morphz-vscode?label=Open%20VSX" alt="Open VSX" />
  </a>
  <a href="https://github.com/leandroluk/morphz/actions/workflows/release.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/leandroluk/morphz/release.yml?label=release" alt="Release Status" />
  </a>
  <a href="https://buymeacoffee.com/leandroluk">
    <img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=flat&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me a Coffee" />
  </a>
</div>

<br>

`morphz` keeps [Zod v4](https://zod.dev/) as the validation engine and adds the
layer Zod deliberately leaves out — declaring your domain as **classes** with
domain methods, real `instanceof` identity, and reusable field meta-types.

📚 **[Read the Documentation](https://leandroluk.github.io/morphz)**

This repository is a pnpm + Turborepo monorepo.

## Quick example

```ts
import { Struct, Define, Text, Email, Uuid, Timestamp, Enum } from "morphz";

const PrimaryKey = Define(Uuid, {
  description: "Unique identifier of #entityName",
  default: () => crypto.randomUUID(),
  immutable: true,
});

enum UserRole {
  ADMIN = "ADMIN",
  USER = "USER",
}

export class User extends Struct(
  {
    id: PrimaryKey(),
    name: Text({ min: 2, max: 50, description: "Full name" }),
    email: Email({ description: "Corporate email" }),
    role: Enum(UserRole, { default: UserRole.USER }),
  },
  { labels: { entityName: "User" }, description: "A user account" },
) {
  isAdmin(): boolean {
    return this.role === UserRole.ADMIN;
  }
}

const user = User.parse({ name: "John Doe", email: "john@example.com" });
user instanceof User; // true
user.isAdmin();       // false — a domain method on the instance
```

Full walkthrough in the [documentation](https://leandroluk.github.io/morphz).

## Packages

| Package                                    | Published as                                                 | What                                                                                                                           |
| ------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| [`packages/core`](packages/core)           | [`morphz`](https://www.npmjs.com/package/morphz) on npm      | The library itself                                                                                                             |
| [`packages/vscode`](packages/vscode)       | `morphz-vscode` on the VSCode Marketplace + Open VSX         | Editor extension — activates the TS Language Service Plugin for hover / autocomplete / diagnostics, no `tsconfig.json` editing |
| [`packages/ts-plugin`](packages/ts-plugin) | _not published separately_ — bundled into `morphz/ts-plugin` | The TypeScript Language Service Plugin                                                                                         |

## Monorepo layout

```
packages/
├── core/        # the `morphz` library (npm)
├── ts-plugin/   # tsserver plugin — copied into core/dist/ts-plugin at build time
└── vscode/      # the `morphz-vscode` editor extension
docs/            # Docsify documentation site — published to GitHub Pages
.github/workflows/
└── release.yml  # tag-triggered publish: npm + VSCode Marketplace + Open VSX
```

## Documentation

The full docs live in [`docs/`](docs) as a [Docsify](https://docsify.js.org/)
site, published to **<https://leandroluk.github.io/morphz>**.

| Section | Contents |
| ------- | -------- |
| [Home](docs/README.md) | why it exists, features, get started, primitives reference |
| [Meta-types with Define](docs/README.md#meta-types-with-define) | reusable field factories, `refine`, description templates |
| [Structs and label propagation](docs/README.md#structs-and-label-propagation) | entity classes, cascading `#labels`, `pre` / `post` hooks |
| [References — Ref and FieldOf](docs/README.md#references--ref-and-fieldof) | lazy relations and scalar foreign keys |
| [Lifecycle](docs/README.md#lifecycle--parse-instantiate-serialize) | parse, instantiate, serialize |
| [DTOs and class extension](docs/README.md#dtos-and-class-extension) | `.extend()` / `.pick()` / `.omit()` / `.partial()` |
| [i18n error messages](docs/README.md#i18n-error-messages) | `(path, code)` override mechanism |
| [Dates by construction](docs/README.md#dates-by-construction) | `z.codec` primitives, JSON-Schema-safe |
| [Guides](docs/guides/mocking.md) | mocking, PII masking, property interceptors, editor tooling, debug namespaces |
| [Example](docs/examples/user-post.md) | end-to-end User + Post walkthrough |

Preview the site locally:

```sh
npx serve docs
# or: python -m http.server 4000 -d docs
```

## Develop

```sh
pnpm install
pnpm build       # turbo run build, then copies ts-plugin into core/dist/ts-plugin
pnpm test        # turbo run test
pnpm typecheck   # turbo run typecheck
pnpm lint        # oxlint
pnpm format      # oxfmt --write
pnpm changelog   # regenerate CHANGELOG.md from Conventional Commits (git-cliff)
```

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) —
enforced by commitlint via a lefthook `commit-msg` hook.

## Releasing

Releases are cut by pushing a version tag (`v*`) — never by a plain push to `main`:

```sh
git tag v0.1.0
git push origin v0.1.0
```

`.github/workflows/release.yml` then builds/tests/typechecks the whole monorepo,
derives the version from the tag, publishes `morphz` to npm (with provenance) and
the extension to both the VSCode Marketplace and Open VSX from a single `.vsix`,
creates a GitHub Release with the generated changelog and the `.vsix` attached,
and commits the updated `CHANGELOG.md` back to `main`. See
[`.github/workflows/README.md`](.github/workflows/README.md) for the required
repo secrets.

## License

MIT © Leandro Santiago Gomes — see [LICENSE](LICENSE).
