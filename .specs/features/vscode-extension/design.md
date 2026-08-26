# Design: VSCode Extension

## Architecture Overview

Thinnest possible extension: it contributes the already-built
`ts-language-service-plugin` to VSCode's TS extension host via the
official `contributes.typescriptServerPlugins` manifest point, and adds a
status bar item as the only runtime UI. No custom language logic lives
here — hover/completions/diagnostics all come from `packages/ts-plugin`
running inside `tsserver`'s own process, exactly like Vue Language
Features / Angular Language Service extensions activate their respective
TS plugins.

```
VSCode TS extension host (built-in "typescript" extension)
        │  reads contributes.typescriptServerPlugins from morphz-vscode
        ▼
tsserver process (per-workspace)
        │  require()s the "morphz" package's bundled plugin subpath
        ▼
packages/ts-plugin's init()/create() (already built — ts-language-service-plugin)
        │
        ▼
hover / completions / diagnostics surfaced natively in every TS file
```

`morphz-vscode`'s own `extension.ts` only does two things: (1) nothing —
the contribution point above requires zero activation code to work, and
(2) maintain a status bar item showing whether the open workspace looks
like a `morphz` consumer, as an honest best-effort signal (see Risks —
VSCode's extension API has no official channel to confirm a contributed
TS plugin actually loaded inside tsserver).

## Dependency Paths (no graph — direct inspection)

- REQ-001/002 → `packages/vscode/package.json`'s `contributes` field →
  VSCode's built-in TS extension → `packages/core/package.json`'s new
  `./ts-plugin` export subpath → `packages/ts-plugin/dist/index.cjs`
  (already correctly CJS-packaged per this session's earlier fix).
- REQ-003 → `packages/vscode/src/extension.ts`'s `activate()` → status
  bar item, driven by a `package.json` read (`vscode.workspace.findFiles`
  - JSON parse) checking for `morphz` in `dependencies`/`devDependencies`.
- REQ-004 → no new component — architecture above IS the zero-daemon
  property, inherited from `ts-language-service-plugin`, not re-proven.

## New Components

| Component                                            | Responsibility                                                                                                                           | Location                                                     |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `contributes.typescriptServerPlugins` manifest entry | Declares the plugin to VSCode's TS extension host — the actual activation mechanism                                                      | `packages/vscode/package.json`                               |
| `extension.ts`                                       | `activate()`/`deactivate()`, status bar lifecycle                                                                                        | `packages/vscode/src/extension.ts`                           |
| `status-bar.ts`                                      | Detects `morphz` dependency + TS-file focus, updates status bar text/tooltip                                                             | `packages/vscode/src/status-bar.ts`                          |
| `README.md`                                          | Marketplace listing copy (REQ-006)                                                                                                       | `packages/vscode/README.md`                                  |
| `./ts-plugin` export subpath                         | **Prerequisite fix** (not new scope) — exposes `packages/ts-plugin`'s build at a name resolvable from any workspace's installed `morphz` | `packages/core/package.json`, `packages/core/tsup.config.ts` |

## Modified Components

| Component                      | Change                                                                                                                                                                                                                                                                                                    | Risk                                                                                      |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `packages/core/package.json`   | add `"./ts-plugin"` to `exports`, matching `monorepo-architecture`'s original (never-implemented) decision                                                                                                                                                                                                | Low — additive, no existing consumer touches this path                                    |
| `packages/core/tsup.config.ts` | new `tsplugin` sub-build step copying `packages/ts-plugin/dist` output into `packages/core/dist/ts-plugin`, OR (simpler, chosen — see Decision Log) a `postbuild` script that copies the already-built `packages/ts-plugin/dist` into `packages/core/dist/ts-plugin` after `turbo` builds ts-plugin first | Low — build-order dependency, Turborepo already tracks inter-package deps via `dependsOn` |
| `packages/vscode/package.json` | full manifest rewrite: `publisher`, `contributes`, `engines`, `categories`, real `activationEvents`, devDependencies (`@types/vscode`, `@vscode/vsce`, `esbuild`)                                                                                                                                         | Medium — first real manifest, no prior consumers to break                                 |

## Risks

- **No official "is my contributed plugin actually loaded" API.** VSCode
  doesn't expose tsserver's internal plugin-load state to extensions.
  Accepted limitation — the status bar reflects "workspace looks like a
  `morphz` consumer + active file is TS", a reasonable proxy, documented
  as such in the tooltip text (not overclaiming "plugin active").
- **`./ts-plugin` export subpath is a genuine prerequisite gap** (see
  spec.md's Affected Components) — must land and be verified (real
  `require('morphz/ts-plugin')` smoke test, same rigor as this session's
  earlier CJS packaging fix) before the extension's `contributes` entry
  can be considered functionally complete, not just manifest-correct.
- **`vsce package` requires `publisher`, `README.md`, and (recommended
  but not required) an icon** — publisher uses the placeholder
  `leandroluk` per user's explicit go-ahead; icon omitted (VSCode
  substitutes a default), not worth inventing a logo unrequested.

## Decision Log

- Copy-after-build (`postbuild` script in `packages/core`) chosen over a
  second `tsup` entry pointing at `packages/ts-plugin/src` directly:
  `packages/ts-plugin` is its own package with its own `tsconfig.json`
  (`module: CommonJS`, deliberately different from `core`'s dual ESM/CJS
  build per this session's earlier packaging fix) — building it a SECOND
  time from `core`'s own `tsup` config would risk silently reintroducing
  the exact ESM/CJS bug just fixed. Copying the already-correct,
  already-tested `packages/ts-plugin/dist` output is simpler and
  provably preserves that fix.
- `contributes.typescriptServerPlugins` chosen over manual
  `tsconfig.json compilerOptions.plugins` patching (rejected in spec.md's
  REQ-001) — zero file mutation, matches how every real-world TS-plugin-
  backed extension (Vue, Angular, Prisma) does this; also avoids ever
  needing write access to a file this extension doesn't own.
- No bundling of the plugin INTO the VSCode extension itself (e.g.
  vendoring `packages/ts-plugin/dist` as an extension asset) — REQ-002
  requires the plugin to run against the WORKSPACE's own TypeScript/
  `morphz` versions, which only works if tsserver resolves the plugin via
  the workspace's own `node_modules/morphz`, not an extension-bundled
  copy. This is also why the `./ts-plugin` export subpath fix (not a
  vendored copy) is the correct prerequisite fix.
