# Spec: Debug/Observability Namespaces (`DEBUG=morphz:*`, §17)

## Summary

Per `INSIGHT.md` §17: opt-in, zero-overhead-when-off debug logging via the
Node.js-ecosystem-standard `DEBUG` environment variable convention (the
`debug` npm package), with 5 documented namespaces
(`morphz:struct`/`parse`/`codec`/`i18n`/`lifecycle`).

## Requirements

- REQ-001: Uses the `debug` npm package (the de facto standard this
  convention comes from — Express/Prisma/etc. all use it; INSIGHT.md's
  own wording explicitly invokes this ecosystem convention, not a custom
  logger).
- REQ-002: 5 namespaced loggers, one per documented area:
  `morphz:struct` (`Struct()` compilation, label/template resolution —
  `struct-entities`'s `template.ts`/`buildStructClass()`), `morphz:parse`
  (constructor/`.parse()`/`.safeParse()` — `lifecycle-serialization`),
  `morphz:codec` (`DateTime`/`BigInt`/`Decimal` encode/decode —
  `datetime-codec` + any codec-based primitive from `additional-
primitives`), `morphz:i18n` (`resolveIssueMessages`/`resolveLocale` —
  `i18n-error-messages`), `morphz:lifecycle` (`pre`/`post` hook execution,
  instance creation timing — `struct-entities`/`lifecycle-serialization`).
- REQ-003: Each namespace's logger is a MODULE-LEVEL singleton
  (`const log = debug('morphz:struct')`) created once per module, called
  inline at the relevant points in each already-shipped feature's code —
  this is an ADDITIVE cross-cutting change touching multiple already-
  completed features' source files (not a new isolated module), unlike
  every other feature so far.
- REQ-004: Zero overhead when off (REQ from INSIGHT.md, and `debug`'s own
  documented behavior) — `debug`'s own implementation already guarantees
  this (a disabled namespace's logger function short-circuits before
  string interpolation), no additional work needed to satisfy this beyond
  using the library correctly (no manual string concatenation BEFORE
  calling `log(...)` — always pass the template/args to `debug`'s own
  function, let IT decide whether to format).

## Affected Components

Touches: `struct.ts`/`template.ts` (`struct-entities`), the constructor/
`static parse`/`safeParse` (`lifecycle-serialization`), `resolve-issues.ts`/
`resolve-locale.ts` (`i18n-error-messages`), `date-time.ts` + any future
codec primitive (`datetime-codec`, `additional-primitives`). This is the
FIRST feature in the whole project that modifies several already-shipped
features' source files as its PRIMARY deliverable (every other feature so
far only ADDED new files, only editing shared internals when a real bug
was found) — flagged explicitly since it changes the usual "one feature =
mostly new files" pattern.

## Out of Scope

- Log AGGREGATION/shipping to external tools (Sentry, Datadog, etc.) —
  `DEBUG`-style logging is local/console-only by convention; anything
  beyond that is the consumer's own observability stack's job.
- Performance/cache-related namespaces — INSIGHT.md's own example
  (`DEBUG=morphz:*,-morphz:cache`) references a `morphz:cache` namespace
  that ISN'T in the documented table of 5 — likely an inconsistency in
  INSIGHT.md's own example rather than an intentional 6th namespace; not
  implementing `morphz:cache` unless the user confirms it's wanted (no
  caching mechanism exists anywhere in `morphz` today to log about).

## Open Questions

- INSIGHT.md's example references `morphz:cache` but the documented table
  only lists 5 namespaces (no `cache`) — flagging the inconsistency
  rather than silently picking one interpretation. Recommend treating it
  as a documentation slip in INSIGHT.md (5 real namespaces, no cache
  concept exists in the codebase) unless the user says otherwise.
- Exact log CONTENT per call site (what gets logged, at what
  verbosity) isn't specified beyond the namespace's general purpose —
  Design/Execute will need to pick concrete, useful messages per call
  site (e.g. `morphz:struct` logs "compiled Struct <name> with N fields"
  once per `Struct()` call — reasonable default, confirm no objection).
