# morphz

Zod v4 + a class-based, type-safe OO layer for your domain model: `Struct`
entities, `Define` meta-types, real class instances from `.parse()`, cascading
labels, i18n error messages, JSON-Schema-safe date codecs, and first-class editor
tooling.

This repository is a pnpm + Turborepo monorepo.

## Packages

| Package | Published as | What |
|---|---|---|
| [`packages/core`](packages/core) | [`morphz`](https://www.npmjs.com/package/morphz) on npm | The library itself |
| [`packages/vscode`](packages/vscode) | `morphz-vscode` on the VSCode Marketplace + Open VSX | Editor extension — activates the TS Language Service Plugin for hover / autocomplete / diagnostics, no `tsconfig.json` editing |
| [`packages/ts-plugin`](packages/ts-plugin) | _not published separately_ — bundled into `morphz/ts-plugin` | The TypeScript Language Service Plugin |

## Monorepo layout

```
packages/
├── core/        # the `morphz` library (npm)
├── ts-plugin/   # tsserver plugin — copied into core/dist/ts-plugin at build time
└── vscode/      # the `morphz-vscode` editor extension
.github/workflows/
└── release.yml  # tag-triggered publish: npm + VSCode Marketplace + Open VSX
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
