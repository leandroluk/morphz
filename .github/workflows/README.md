# Workflows

## `release.yml`

Triggers on pushing a version tag (`v*`, e.g. `v1.2.3`) — never on a plain
push to `main`. Builds, tests, and typechecks the whole monorepo first;
nothing publishes if that fails. Publishes `packages/core` to npm, and
`packages/vscode` (from a single built `.vsix`) to both the VSCode
Marketplace and Open VSX.

### Required repo secrets

| Secret      | Used for                   | Where to generate it                                                                                                                                       |
| ----------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NPM_TOKEN` | `npm publish` (`morphz`)   | npmjs.com → Access Tokens → Generate New Token → "Automation" type                                                                                         |
| `VSCE_PAT`  | VSCode Marketplace publish | dev.azure.com → User settings → Personal Access Tokens → scope "Marketplace (Manage)", under the Azure DevOps org tied to the `leandroluk` publisher       |
| `OVSX_PAT`  | Open VSX publish           | open-vsx.org → Settings → Access Tokens (requires a namespace matching the extension's `publisher`, registered separately from the VSCode Marketplace one) |

Add each under the repo's Settings → Secrets and variables → Actions.
Missing a secret doesn't silently skip its job — the relevant
`publish-*` job fails immediately with a clear `::error::` message
naming which secret is missing.

### Version source of truth

The git tag itself. Pushing `v1.2.3` sets both `packages/core/package.json`
and `packages/vscode/package.json` to `1.2.3` at build time (via `npm
version --no-git-tag-version`) — there's nothing to keep in sync by hand.
