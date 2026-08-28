# Spec: Default `entityName` = Class Name

**Status: DONE (2026-08-28).** Implemented + tested. Shipped in the same
commit as `mask-object-derivation`. Extends `config-gaps` (which added the
opt-in `config.labels.entityName` deriver).

## Summary

`#entityName` in a description template now resolves to the **bare class
name** with zero configuration. Previously it only resolved if the project
supplied a `config.labels.entityName` function in `morphz.config.ts` —
without one, `#entityName` stayed literal in every hover / error message, so
the shipped `morphz/recipes` (`"Unique identifier of #entityName"`) produced
broken text out of the box.

Resolution order (unchanged in structure, new step 3):

1. explicit `labels: { entityName: "User" }` on the `Struct` — always wins,
   resolved eagerly at `Struct()` call time
2. `config.labels.entityName(ctx)` — if defined
3. **the bare class name** (`ctx => ctx.className`) — the new default, used
   when neither 1 nor 2 applies

Steps 2 and 3 run lazily on the first `parse()` / `new` (via
`resolveEntityNameIfPending`, `new.target.name`), so a
`class User extends Struct(...)` subclass resolves to `"User"`, not the
anonymous internal class name.

## Requirements

- REQ-001: With no `morphz.config` anywhere on the discovery path and no
  explicit `labels.entityName`, a `Struct` whose field descriptions contain
  `#entityName` resolves it to the class name on first construction.
- REQ-002: `pendingEntityNameDerivation` becomes `!labels.entityName` — no
  longer gated on a config deriver existing. The lazy, memoized,
  once-per-class resolution from `config-gaps` is otherwise unchanged.
- REQ-003: An explicit `labels: { entityName: ... }` on the `Struct` still
  short-circuits everything (never pending, resolved eagerly) — `config-gaps`
  REQ behavior preserved.
- REQ-004: A `config.labels.entityName` function still overrides the default
  when present — the default is `getConfig().labels?.entityName ?? identity`.
- REQ-005: `.extend()` continues to derive the SUBCLASS's own name
  (`config-gaps` edge-case test) — unchanged, falls out of `new.target.name`.
- REQ-006: `.omit()` / `.pick()` / `.partial()` pin the SOURCE's resolved
  `entityName` onto the derived class before copying its labels
  (`resolveEntityNameIfPending(source[STRUCT_META], source.name)` at derive
  time). A DTO built from a zero-config `Account` Struct interpolates
  `#entityName` → `"Account"`, not `"AccountDto"`, WHEN the source name is
  already resolvable at derive time (i.e. `Account` is a named class /
  already constructed). If the source is still an anonymous `Struct()`
  return not yet assigned/subclassed, the DTO falls back to its own name on
  its own first construction — acceptable edge, documented.
- REQ-007: Mangled / anonymous class names — if `new.target.name` is empty,
  resolution is a no-op (template stays literal, no crash). If it's 1-2
  chars, a `logStruct` line warns (visible under `DEBUG=morphz:struct`) to
  set `labels.entityName` explicitly. No hard failure.
- REQ-008: `npx tsc --noEmit` clean, `npm test` green.

## Affected Components

- `src/core/struct.ts` — `resolveEntityNameIfPending` exported + default
  deriver (`?? identity`) + minified-name warn; `Struct()`'s
  `pendingEntityNameDerivation = !labels.entityName`.
- `src/core/derive-variant.ts` — `resolveEntityNameIfPending(source, ...)`
  call before copying source labels in `deriveVariant()` and `partial()`.
- Docs — `docs/README.md` "Config file" section (config now fully optional,
  `entityName` resolution list), `INSIGHT.md` §9.

## Out of Scope

- Stripping `Entity` / `Model` suffixes by default — that stays an opt-in
  `config.labels.entityName` reshape (the default is pure identity).
- A build-time / bundler plugin to preserve class names through
  minification — the `logStruct` warn + docs note is the mitigation.

## Rejected Alternatives

- **Keep requiring a config deriver.** The status quo; it makes the shipped
  recipes emit broken text with no config, which is a bad first-run.
- **Hard-throw on a mangled 1-char name.** Too aggressive — a minified
  backend bundle that never surfaces `#entityName` to a human shouldn't
  crash. Warn instead.
