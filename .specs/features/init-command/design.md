# Design: `morphz init` — Project Scaffolding Command

## Architecture

One new source file, `packages/core/src/cli.ts`, built as a **separate tsup
entry** to `dist/cli.cjs` (CJS, shebang preserved). It is pure I/O
orchestration over small pure helpers — no dependency on `morphz`'s own
runtime (`Struct`, `getConfig`, …); the only shared symbol is the config
filename list, promoted to an export.

```
npx morphz <argv>
      │
      ▼
 dist/cli.cjs  (#!/usr/bin/env node)
      │
 parseArgs(argv)  ──► { command, flags }         pure
      │
      ├─ "init" ──► runInit(cwd, flags)
      │               ├─ writeConfig()      ── renderConfigTemplate()   pure
      │               ├─ patchTsconfig()    ── mergePluginEntry()       pure (jsonc-parser)
      │               ├─ checkZod()         ── zodRangeSatisfiesV4()    pure
      │               └─ printSummary()
      │
      ├─ "--version" / "-v" ──► print version, exit 0
      └─ "--help" / "-h" / (no args) ──► print usage, exit 0
        (unknown) ──► usage to stderr, exit 2
```

## Resolved open questions

### Q1 — `tsconfig.json` JSONC handling → **bundle `jsonc-parser`**

`jsonc-parser` (pure JS, zero deps, ~30 KB) is added as a **devDependency of
`packages/core`** and imported only by `src/cli.ts`. tsup/esbuild bundles it
into `dist/cli.cjs`; the `index` / `register` / `recipes` entries never
import it, so their bundles are byte-unchanged (verified at DEV time). Net:
**zero new `dependencies`**, REQ-012 holds.

The patch uses `jsonc-parser`'s surgical edit API, not parse-and-rewrite:

```ts
import { parseTree, findNodeAtLocation, modify, applyEdits } from "jsonc-parser";

const tree = parseTree(text); // tolerant, keeps positions
// already present?  findNodeAtLocation(tree, ["compilerOptions","plugins"])
//   → scan children for an object with name === "morphz/ts-plugin"
const edits = modify(
  text,
  ["compilerOptions", "plugins", -1], // -1 = append to array
  { name: "morphz/ts-plugin" },
  { formattingOptions: { insertSpaces: true, tabSize: 2 } },
);
const next = applyEdits(text, edits); // comments + layout preserved
```

`modify` creates `compilerOptions` and/or `plugins` if missing. Comments,
key order and the rest of the file are untouched — only the new array
element (and its surrounding whitespace) is inserted.

**Fallback:** if `parseTree` returns `undefined` (genuinely broken JSON) OR
the file has a syntax error node at the root, `init` does NOT write —
it prints the two-line snippet for manual paste and notes it in the summary.
No `--rewrite-tsconfig` flag; there is only the safe path.

### Q2 — `--help` / `--version` / no-args

- `morphz` with **no args** → print the usage block to **stdout**, exit `0`
  (matches `eslint`, `tailwindcss`; friendlier than an error).
- `--version` / `-v` → the bare version string (`0.2.0\n`), exit `0`. Read
  from `packages/core/package.json` via
  `readFileSync(join(__dirname, "..", "package.json"))` — `__dirname` is the
  CJS bundle's own dir (`dist/`), so `../package.json` resolves in both the
  repo and the published tarball.
- `--help` / `-h` (top-level or after `init`) → usage block, exit `0`.
- Usage block (~18 lines): one-line synopsis, `Commands:` (just `init`),
  `Flags:` with the four `init` flags + `--help` / `--version`, and two
  `Examples:` lines.

### Q3 — existing `plugins` array with other entries → **append**

Once `jsonc-parser` has parsed the tree the array is known structure;
appending one object with `modify(..., ["...","plugins", -1], ...)` is
low-risk and preserves the siblings. Only a parse failure (Q1 fallback)
makes `init` decline. A `plugins` value that exists but is **not an array**
(malformed) → treat as the Q1 fallback (print snippet, don't write).

### Q4 — `zod` check → **declared range string only**

Read the nearest `package.json` (cwd, then walk up to filesystem root),
look for a `zod` key in `dependencies` ∪ `devDependencies` ∪
`peerDependencies`. `zodRangeSatisfiesV4(range)` returns true when the range
string, after trimming a leading `^ ~ >= > =` and any `v`, starts with `4.`
or is exactly `4`, OR the range is one of `* latest next workspace:*
workspace:^ workspace:~` (can't disprove → don't nag). Anything else (incl.
`3.x`, `^3`, absent) → the warning line. No `semver` dependency, no
`node_modules/zod/package.json` walk (pnpm store / hoisting makes it
unreliable and it's only a warning).

## New / changed components

| Component          | Change                                                                                                                                                          | Location                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `cli.ts`           | NEW — `parseArgs`, `runInit`, `renderConfigTemplate`, `mergePluginEntry` (jsonc), `zodRangeSatisfiesV4`, `readNearestPackageJson`, `printUsage`, `printSummary` | `packages/core/src/cli.ts`                                                   |
| `CONFIG_FILENAMES` | export the existing `const` (was module-private) so `cli.ts` and `config.ts` share one list                                                                     | `packages/core/src/core/config.ts`                                           |
| tsup entry         | `cli: "src/cli.ts"` added to `entry`                                                                                                                            | `packages/core/tsup.config.ts`                                               |
| `"bin"`            | `{ "morphz": "./dist/cli.cjs" }`                                                                                                                                | `packages/core/package.json`                                                 |
| `jsonc-parser`     | new `devDependencies` entry (bundled into `cli.cjs`, not a runtime dep)                                                                                         | `packages/core/package.json`                                                 |
| tarball assertion  | `dist/cli.cjs` added to the required-entries list                                                                                                               | `.github/workflows/release.yml`                                              |
| tests              | `tests/init-command/{parse-args,render-template,merge-plugin,zod-range}.test.ts` (pure) + `tests/init-command/init-integration.test.ts` (temp dir)              | `packages/core/tests/init-command/`                                          |
| docs               | `npx morphz init` as the fast path                                                                                                                              | `docs/README.md`, `docs/guides/editor-tooling.md`, `packages/core/README.md` |

## Shebang / build details

- `src/cli.ts` first line: `#!/usr/bin/env node`. esbuild preserves a
  leading shebang on an entry point; tsup passes it through. DEV verifies
  `head -1 dist/cli.cjs` is the shebang and `node dist/cli.cjs --version`
  works.
- The `cli` entry is emitted for BOTH `esm` and `cjs` formats by the shared
  tsup config (`format: ["esm", "cjs"]`). `"bin"` points at `dist/cli.cjs`
  only; `dist/cli.js` is harmless dead weight (~a few KB). Not worth a
  second tsup config to suppress. `dts: true` also emits `dist/cli.d.ts` —
  also harmless.
- `cli.ts` imports nothing from `./index.js`; it only imports
  `CONFIG_FILENAMES` from `./core/config.js` (a `const string[]`, no side
  effects, no `getConfig()` call — so no config discovery is triggered by
  running the CLI).

## Config template rendering

`renderConfigTemplate(ext: "ts" | "js" | "mjs" | "cjs"): string`

- `ts` / `js` / `mjs` → the `import { defineConfig } from "morphz"` +
  `export default defineConfig({ ... })` form from spec REQ-003.
- `cjs` → `const { defineConfig } = require("morphz");` +
  `module.exports = defineConfig({ ... });`.
- Body (the commented options) is identical across all four — one string
  constant, two wrappers.

## Summary output (`printSummary`)

Collected as the run proceeds, printed once at the end:

```
morphz init

  created  morphz.config.ts
  updated  tsconfig.json  (added morphz/ts-plugin)
  ok       zod@^4 present

next steps
  • install the morphz editor extension (VS Marketplace / Open VSX),
    or rely on the tsconfig.json plugin just added
  • docs: https://leandroluk.github.io/morphz
```

Each of the three action lines is one of: `created` / `updated` / `skipped`
/ `ok` / `warn`, with the reason in parens. `--no-tsconfig` → the tsconfig
line reads `skipped  tsconfig.json  (--no-tsconfig)`.

## Risks

- **tsup bundling `jsonc-parser` into other entries.** If tree-shaking
  fails and `index.cjs` grows, that's a real regression (bundle size is a
  selling point). DEV MUST diff `dist/index.cjs` size before/after and
  confirm `jsonc-parser` strings appear only in `cli.cjs`. If it leaks,
  fall back to the in-repo stripper + full rewrite (Q1 option a).
- **Shebang lost by a tsup upgrade.** Covered by the DEV `head -1` check
  and a smoke test in CI would be ideal but the integration test running
  `node dist/cli.cjs` (not the raw bin) is enough for now.
- **`modify` formatting on a file with tabs.** `formattingOptions` is a
  guess (2-space). Acceptable — only the inserted line is affected, and
  most `tsconfig.json` are 2-space. Not worth detecting the file's
  indentation.

## Decision Log

- CLI is a **separate tsup entry**, not a `bin` shim that `require`s
  `dist/index.cjs` — keeps CLI-only code (and `jsonc-parser`) out of the
  library bundle.
- `jsonc-parser` **bundled, not a runtime dep** — preserves "zero runtime
  dependencies beyond the existing set" while getting real
  comment-preserving edits.
- **No interactive mode, no `--yes`.** Every effect is idempotent and
  additive; nothing to confirm.
- **No-args prints help and exits 0** (not an error) — matches peer tools.
- `zod` check is **declared-range only** — it's a nudge, not a gate; a
  `node_modules` walk buys accuracy nobody needs here.
