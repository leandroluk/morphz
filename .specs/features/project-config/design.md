# Design: Project Configuration (`morphz.config.ts`)

## Architecture Overview

A single module-level singleton, populated exactly once (lazily on first
need, or eagerly via `morphz/register`), read by every other feature that
already designed a dependency on it (`define-metatypes`'s template
delimiter, `struct-entities`'s labels default, `i18n-error-messages`'s
locale default — that last one already implemented its own
`resolveLocale()` fallback chain during its own design, this feature just
needs to make the config VALUE available for that chain to read).

```
                    ┌─────────────────────┐
 first call to a    │  getConfig()         │  singleton, populated once
 config-needing API │  (module-level var)  │
        │           └──────────┬───────────┘
        │                      │ not yet populated?
        ▼                      ▼
  triggers discovery   cosmiconfig-style upward search from process.cwd()
        │              for morphz.config.{ts,js,mjs,cjs}
        │                      │
        │              found? load via jiti (sync, .ts-capable)
        │                      │ not found → {} (built-in defaults apply)
        ▼                      ▼
  getConfig() returns   defineConfig()'s options object (or {})
  the now-cached value
```

`morphz/register` is a side-effect module that just calls the SAME
discovery function eagerly, at import time, instead of waiting for
`getConfig()`'s first lazy call.

## `getConfig()` — the singleton accessor

```ts
let cachedConfig: MorphzConfig | undefined;

function getConfig(): MorphzConfig {
  if (cachedConfig === undefined) {
    cachedConfig = discoverConfig() ?? {};
  }
  return cachedConfig;
}
```

Every consumer (`resolveLocale()` in `i18n-error-messages`, the template
resolver in `struct-entities`, `defineConfig`'s labels-derivation default)
calls `getConfig()` — never reads a config FILE directly, never re-runs
discovery. This is what makes the "process-wide singleton" constraint
(REQ-005, already specified) concrete: `cachedConfig` is one module-level
binding, shared by the whole process regardless of how many `Struct`
classes/packages import `morphz`.

## `discoverConfig()`

Cosmiconfig-style synchronous upward search from `process.cwd()` for
`morphz.config.{ts,js,mjs,cjs}`. `.ts`/`.mjs`/`.cjs`/`.js` all load via
`jiti`'s synchronous `require` — using `jiti` uniformly for every extension
(not just `.ts`) avoids a second code path for plain `.js`/`.cjs` configs;
`jiti` transparently handles both TS and plain JS. Returns `undefined` if no
file is found at any ancestor directory (search stops at filesystem root).

## `defineConfig(options)`

```ts
function defineConfig(options: MorphzConfig): MorphzConfig {
  return options; // pure type-level identity, per REQ-001
}
```

No runtime behavior — exists solely so `morphz.config.ts` authors get
autocomplete/type-checking on `options`. The ACTUAL config object reaches
`morphz` only via `discoverConfig()` loading the file and reading its
`export default` — `defineConfig`'s return value and the file's default
export are the same object, `defineConfig` never registers anything itself
(a common misconception with this pattern worth flagging: unlike
`morphz/register`, importing/calling `defineConfig` inside the config file
does NOT itself trigger discovery — discovery is driven by
`getConfig()`/`morphz/register`, which then IMPORTS the config file, not
the other way around).

## `morphz/register`

```ts
// src/register.ts — side-effect module
import { discoverConfig } from "./core/config";
cachedConfig = discoverConfig() ?? {}; // eager population of the SAME singleton
```

A no-op if `cachedConfig` is already populated (either a prior
`morphz/register` import, or a config-needing API already ran lazy
discovery first) — matches REQ-005's "calling it twice is a no-op"
requirement exactly.

## Resolved open questions

- **Zero-config locale default**: `'en-US'` — this was already settled
  concretely by `i18n-error-messages/design.md`'s `resolveLocale()`
  (`AsyncLocalStorage → config.locale.default → 'en-US'`); this design adds
  nothing new here, just confirms `getConfig().locale?.default` is the
  exact value that chain reads.
- **Monorepo caveat**: accepted as a known v1 limitation, not resolved
  further — a single process hosting multiple `morphz`-based packages
  wanting different `entityName` derivation is unsupported (first config
  found wins, process-wide singleton). No scoped-config mechanism designed
  for this session's scope; a real future need would require a NEW
  feature (e.g. a `morphz.config.ts` per-package + explicit
  `Struct(fields, { configOverride })` opt-in), deliberately deferred.
- **`jiti` as a hard dependency**: accepted — zero-config `.ts` loading is
  a REQ-005 requirement (lazy discovery must work with no setup), which is
  only achievable with a bundled synchronous TS loader as a real
  (non-peer) dependency of `morphz` itself.

## New Components

| Component          | Responsibility                                            | Location                    |
| ------------------ | --------------------------------------------------------- | --------------------------- |
| `getConfig()`      | Singleton accessor, triggers lazy discovery on first call | `src/core/config.ts`        |
| `discoverConfig()` | Cosmiconfig-style sync search + `jiti` load               | `src/core/config.ts`        |
| `defineConfig()`   | Type-only identity helper                                 | `src/core/define-config.ts` |
| `morphz/register`  | Side-effect module, eager discovery                       | `src/register.ts`           |

## Dependency Paths

- `getConfig()` is read by: `struct-entities`'s template resolver (delimiter
  - labels-derivation default), `i18n-error-messages`'s `resolveLocale()`.
    Both already-completed designs reference `project-config` by name; this
    design fulfills that reference with the concrete `getConfig()` API,
    requiring no changes to either of those designs (they already treated
    config as an opaque "the loaded singleton").

## Risks

- None new — this is the last of the 8 features to receive a design, and
  it introduces no further follow-ups onto any other feature's shape
  (unlike most of the preceding designs). Safe to treat as the final piece
  before Execute phase.

## Decision Log

- `jiti` used uniformly for ALL config extensions (not just `.ts`) — one
  code path instead of branching on file extension, simpler to implement
  and reason about.
- Config file discovery is driven by `morphz`'s own code calling
  `discoverConfig()` — `defineConfig()` itself is inert at runtime; this
  is worth stating explicitly since it's a common source of confusion with
  this `defineX`-identity-helper pattern (seen in Vite/Vitest too).
