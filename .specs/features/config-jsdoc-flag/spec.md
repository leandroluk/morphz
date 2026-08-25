# Spec: `jsdoc` Config Flag

## Summary

Per `INSIGHT.md` §9: `morphz.config.ts`'s `defineConfig({ jsdoc: true })`
toggles `jsdoc-generation`'s build step on. This spec covers ONLY the
config surface (the boolean flag on `MorphzConfig`); the actual generation
behavior is `jsdoc-generation`'s spec.

## Requirements

- REQ-001: `MorphzConfig.jsdoc?: boolean` (default `false` — generation is
  opt-in, not automatic, since it's a build-time cost every consumer
  wouldn't necessarily want).
- REQ-002: `getConfig().jsdoc` is the single read-point `jsdoc-generation`'s
  build step checks before running — no new discovery/loading mechanism,
  reuses `project-config`'s existing `getConfig()`/`discoverConfig()`
  unchanged.

## Affected Components

`project-config`'s `MorphzConfig` interface (`src/core/config.ts` in
`packages/core` post-`monorepo-architecture`) — one new optional field.

## Out of Scope

Everything about WHAT gets generated when the flag is on — that's
`jsdoc-generation`'s spec entirely. This spec is deliberately tiny; kept
separate from `jsdoc-generation` only so the trivial config-surface change
can land (and be gated) independently of the much larger generation
engine, per the build-order recommendation in `ts-language-service-plugin`
(small wins first).

## Open Questions

None.
