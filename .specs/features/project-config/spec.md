# Spec: Project Configuration (`morphz.config.ts`)

## Summary

`defineConfig({...})` in a project-root `morphz.config.ts` sets monorepo/
project-wide conventions consumed by other features: automatic `labels`
derivation (e.g. deriving `entityName` from the class name, stripping
`Entity`/`Model` suffixes) and template delimiter configuration
(`#entityName` vs `{entityName}`). Also the home for locale defaults
consumed by `i18n-error-messages` (`locale: { default, fallback }`).

## Requirements

- REQ-001: `defineConfig(options)` is a typed identity function (type-only
  helper, like Vite/Vitest's `defineConfig`) — returns `options` unchanged,
  exists purely for editor autocomplete/type-checking on the config shape.
- REQ-002: `options.labels.entityName` accepts a function
  `(ctx: { className: string, ... }) => string` — a global default applied
  to every `Struct` that does NOT explicitly set `labels.entityName` in its
  own `options`. Explicit per-`Struct` `labels` always win over the global
  default.
- REQ-003: `options.template.delimiter` sets the character(s) marking a
  template placeholder in `description` strings (default `'#'`, e.g.
  `#entityName`). Must be consistent project-wide — a single delimiter, not
  per-`Struct` configurable (confirm this constraint is intentional).
- REQ-004: `options.locale.default` / `options.locale.fallback` feed
  `i18n-error-messages`'s locale resolution (see that spec REQ-003) when no
  request-scoped `AsyncLocalStorage` locale is set.
- REQ-005: Config loading is two-layer:
  - **Lazy auto-discovery (default, zero-config).** The first time any
    `morphz` API needs config (e.g. first `Struct` class declared, or first
    `.parse()` call — whichever happens first), a synchronous, cosmiconfig-
    style search runs upward from `process.cwd()` for
    `morphz.config.{ts,js,mjs,cjs}`. Result is cached in a module-level
    singleton for the rest of the process — the search runs at most once.
    `.ts` files load via `jiti`'s synchronous require (no `ts-node`/build
    step required as a peer dependency). No file found → falls back to
    built-in defaults (REQ below / config-less operation).
  - **`morphz/register` (optional, eager).** A side-effect module — import
    or `require('morphz/register')` at the top of the app entrypoint, or via
    `node -r morphz/register` — that runs the exact same discovery/load
    logic immediately instead of waiting for first use. Populates the same
    singleton. Exists for environments where the lazy sync `fs` search
    can't run reliably (bundled/edge runtimes) or where deterministic
    load timing before any entity import is required. Calling it twice, or
    triggering lazy discovery after it already ran, is a no-op (singleton
    already populated).
  - Config is a single process-wide singleton — no per-package/per-scope
    config resolution (see Open Questions for the monorepo caveat this
    implies).

## Affected Components (from graph)

N/A — greenfield. Consumed by `define-metatypes` (template delimiter),
`struct-entities` (labels default), `i18n-error-messages` (locale default).
This feature can be designed last since nothing in the core library hard-
depends on config existing — absence of `morphz.config.ts` must fall back to
sane defaults (`#` delimiter, no auto-label derivation, `'en-US'`-or-similar
locale default — confirm exact fallback).

## Out of Scope

- Full monorepo/workspace-level config merging (e.g. package-level overrides
  of a root config) — not demonstrated in INSIGHT.md; single flat config
  assumed unless a concrete multi-package need surfaces.

## Resolved (design phase)

- Zero-config locale default: `'en-US'` (matches `i18n-error-messages`'s
  `resolveLocale()` fallback chain, already designed).
- Monorepo caveat accepted as a known v1 limitation, not solved further —
  scoped/per-package config deferred to a future feature if a real need
  surfaces.
- `jiti` accepted as a hard (non-peer) runtime dependency — required for
  zero-setup `.ts` config loading, used uniformly for every config file
  extension (not just `.ts`) for implementation simplicity.
