# Workflows

## `release.yml`

Triggers on pushing a version tag (`v*`, e.g. `v1.2.3`) — never on a plain
push to `main`. Builds, tests, and typechecks the whole monorepo first;
nothing publishes if that fails. Publishes `packages/core` to npm, and
`packages/vscode` (from a single built `.vsix`) to both the VSCode
Marketplace and Open VSX.

### Job graph

```
build-test ──┬─> publish-npm ──┐
             ├─> publish-vsce ──┼─> github-release ──> changelog-commit
             └─> publish-ovsx ──┘
```

- **build-test** — also asserts the `packages/core` npm tarball contains
  `README.md`, `LICENSE`, and a working `dist/ts-plugin/` subpath, and
  that the `.vsix` carries its readme + license and leaks no `src/` or
  `*.map`. A packaging regression fails the release before anything is
  published.
- **publish-npm** — `npm publish --provenance` (job has `id-token:
write`), so the release is published with a verifiable provenance
  attestation linking it to this workflow + commit.
- **github-release** — runs only after all three `publish-*` jobs
  succeed. Creates a GitHub Release for the tag, body = the git-cliff
  changelog section for that version, with the built `.vsix` attached as
  a release asset.
- **changelog-commit** — regenerates `CHANGELOG.md` with git-cliff for
  the tag and commits it back to `main` as `chore(release): update
CHANGELOG for <version> [skip ci]`. Because the workflow only triggers
  on tags, this branch push cannot re-trigger it. **The tagged commit
  itself does not contain that version's changelog entry — it lands one
  commit later on `main`.**

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
The changelog is likewise derived, not hand-written: `cliff.toml` +
git-cliff render it from Conventional Commits. Run `pnpm changelog`
locally to preview; CI regenerates and commits it on release.
