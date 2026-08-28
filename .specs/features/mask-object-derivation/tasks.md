# Tasks: Mask-Object Derivation + Default `entityName`

Both features shipped together in one commit (`feat!` → `0.2.0`). All done
2026-08-28.

## mask-object-derivation

- [x] T-001 — `src/core/struct.ts`: add exported `Mask<Shape>` type
      (`{ [K in keyof Shape]?: true }`). Rewrite `StructConstructor` `omit` /
      `pick` signatures to `(mask: M)`; add a second `partial<M>(mask: M)`
      overload alongside the no-arg `partial()`.
- [x] T-002 — `src/core/derive-variant.ts`: delete `normalizeNames()`;
      replace `toMask()` with `cleanMask()` (keep only `=== true` keys); add
      `assertMask()` runtime guard (`TypeError` + migration hint on
      string/array). `omit()` / `pick()` take `(mask)`, derive keys via
      `Object.keys(cleanMask(mask))`. `partial(mask?)` forwards the mask to
      `rawObjectSchema.partial(mask)` or the no-arg `.partial()`.
- [x] T-003 — `src/index.ts`: `export type { Mask }`.
- [x] T-004 — rewrite call sites in 4 test files
      (`class-extensibility/derive-variant.test.ts`,
      `struct-type-inference/basic-inference.test.ts`,
      `struct-type-inference/coverage-extra.test.ts`,
      `recipes-package/recipes-integration.test.ts`) to the mask form.
- [x] T-005 — new tests: `.partial({ ... })` selective (only masked keys
      optional), `assertMask` throws on old variadic/array form.
- [x] T-006 — docs: `docs/README.md#dtos-and-class-extension` (+ `Mask`
      import example, selective partial, "removed in 0.2" note),
      `docs/examples/user-post.md` `## DTOs`, `INSIGHT.md` §8.
- [x] T-007 — amend `class-extensibility/{spec,design}.md` with a
      superseding banner.

## default-entity-name

- [x] T-008 — `src/core/struct.ts`: `export` `resolveEntityNameIfPending`;
      default deriver `getConfig().labels?.entityName ?? (ctx => ctx.className)`;
      drop the `if (typeof deriver !== "function") return`; empty-name no-op +
      `logStruct` warn for names ≤ 2 chars. `Struct()`:
      `pendingEntityNameDerivation = !labels.entityName`.
- [x] T-009 — `src/core/derive-variant.ts`: call
      `resolveEntityNameIfPending(source[STRUCT_META], source.name)` (and
      `this` for `partial`) before copying labels, so DTOs pin the source name.
- [x] T-010 — new test file
      `tests/config-gaps/entity-name-default.test.ts`: zero-config resolution to
      class name, explicit label still wins, `.extend()` uses subclass name,
      `.omit()` pins source name.
- [x] T-011 — docs: `docs/README.md` "Config file" (config now optional +
      `entityName` resolution order), `INSIGHT.md` §9.

## Gate

- [x] `npx tsc --noEmit` clean (core)
- [x] `npx turbo run typecheck` — 4/4 tasks
- [x] `npx vitest run` (core) — 260/260
- [x] ts-plugin 22/22, vscode 6/6 — 288 monorepo-wide
- [ ] commit as `feat!:` so git-cliff `--bump` picks `0.2.0`
