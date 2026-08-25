# Spec: Config Gaps (`entityName` auto-derivation + `@deprecated`)

**Status: DONE (2026-08-25).** Implemented + tested (239/239 cumulative
pass). Lazy `entityName` resolution wired into `struct.ts` (constructor +
`safeParse`), confirmed memoized exactly once per class regardless of
instance count, confirmed no cross-class leakage between two classes both
using auto-derivation, confirmed working through `.extend()`. `@deprecated`
tag wired into `jsdoc-generation`. **1 more real bug found by QA**:
`extend.ts` resolved new fields' templates with a hardcoded `'#'`
delimiter, ignoring `parentMeta.templateDelimiter` — a project with a
custom `template.delimiter` in `morphz.config.ts` would get fields added
via `.extend()` resolved with the wrong delimiter. Fixed.

## Summary

Two small, unrelated gaps found while auditing `INSIGHT.md` coverage: (1)
`project-config` REQ-002's global `labels.entityName` derivation function
is TYPED but never actually READ by `struct.ts` — the fallback chain is
incomplete. (2) `INSIGHT.md` §10's JSDoc mapping table lists `deprecated:
true` → `@deprecated`, but `FieldDescriptorMeta` has no `deprecated` field
and `jsdoc-generation` never emits that tag.

## Requirements

- REQ-001: `struct.ts`'s label resolution: when a `Struct(...)` call's own
  `options.labels.entityName` is NOT set, AND `getConfig().labels
?.entityName` is a function, call it with `{ className: <the class's own
name> }` and use the result as the effective `entityName` for that
  `Struct`'s template resolution. Explicit per-`Struct` `labels.entityName`
  always wins when present (matches `project-config` REQ-002's already-
  specified precedence — this REQ is purely about actually wiring the
  already-designed behavior, no new design needed).
- REQ-002: Getting the class's own name at `Struct(fields, options)` call
  time is a real constraint — `Struct()` is called BEFORE `class X extends
Struct(...) {}` binds the name `X` to anything, so the class name isn't
  known yet at that point. Needs a resolution: is the class name available
  via a LATER hook (e.g. resolved lazily on first access/parse, reading
  `this.name`/`new.target.name` at that point, matching the same
  lazy-resolution spirit `Struct()` already uses for other cross-cutting
  concerns) rather than eagerly at `Struct()` call time?
- REQ-003: `FieldDescriptorMeta.deprecated?: boolean | string` (`true` for
  a bare `@deprecated` tag, a string for `@deprecated <reason>` per
  INSIGHT.md's table: `@deprecated [motivo opcional]`).
- REQ-004: `jsdoc-generation`'s `buildFieldTags()` emits `@deprecated`
  (with the reason text, if a string) when `meta.deprecated` is truthy.

## Affected Components

`struct.ts` (label resolution timing — REQ-001/002 need real design
thought, not just plumbing), `define-metatypes`'s `FieldDescriptorMeta`
(new field), `jsdoc-generation`'s `build-field-tags.ts`.

## Out of Scope

- Any RUNTIME behavior for `deprecated` (e.g. a console warning on
  access) — INSIGHT.md only specifies it as a JSDoc tag, a build-time/
  documentation concern, not a runtime one.

## Resolved (REQ-002's timing problem)

`class X extends Struct(fields, options) {}` — `X.name` (`"X"`) is bound
the moment this statement finishes evaluating, synchronously, strictly
BEFORE any code could ever call `new X()`/`X.parse()` (those require `X`
to already exist as a binding). This guarantees `new.target.name` is
always the real, correct subclass name by the time the constructor or
`static parse`/`safeParse` first runs — even though it's NOT known at
`Struct()` call time itself.

Resolution: entityName auto-derivation is LAZY, resolved once on FIRST
construction (whichever of constructor/`safeParse` runs first for that
class), memoized after. Concretely: `buildStructClass()` marks
`STRUCT_META` as having a "pending entityName" ONLY when
`options.labels.entityName` was omitted AND `getConfig().labels
?.entityName` is set at build time (config is available synchronously via
the existing `getConfig()` singleton — no laziness needed on THAT part).
On first construction, if pending: call the derivation function with
`{ className: new.target.name }`, re-run template resolution for any
field `description`/`message` string referencing `#entityName` (same
`resolveFieldTemplates()` already used eagerly, called once more here),
patch the cached `STRUCT_META.fields`/`.labels`, clear the pending flag.
Every `Struct` call that explicitly sets `labels.entityName` (the common
case) is COMPLETELY UNAFFECTED — zero new cost, fully eager as before, no
behavior change. Only the auto-derivation path pays a one-time lazy
resolution, exactly once per class, not per instance/parse.
