# Tasks: Debug/Observability Namespaces

**Status: DONE (2026-08-25).** T-001/T-002 implemented + tested (142/142
cumulative pass). 5 namespaces wired into `struct.ts` (compile/hooks/
instance/parse/safeParse), `template.ts` (unresolved placeholder),
`resolve-locale.ts`/`resolve-issues.ts` (locale source, message override
applied/missed), `date-time.ts` (decode/encode). Confirmed zero-overhead
when `DEBUG` unset (both a manual smoke test against the real built
package and automated tests with the namespace enabled/disabled).

## T-001: Namespace loggers module

- **REQ**: REQ-001, REQ-002
- **What**: `src/core/debug.ts` — exports 5 module-level `debug()` instances
  (`morphz:struct`, `morphz:parse`, `morphz:codec`, `morphz:i18n`,
  `morphz:lifecycle`).
- **Where**: `src/core/debug.ts`
- **Depends on**: none
- **Gate**: `npx tsc --noEmit`

## T-002: Wire log calls into existing modules

- **REQ**: REQ-002, REQ-003, REQ-004
- **What**: add `log(...)` calls at meaningful points: `struct.ts`
  (`morphz:struct` — Struct compiled; `morphz:lifecycle` — pre/post hook
  run, instance created; `morphz:parse` — parse/safeParse called,
  success/failure), `resolve-issues.ts`/`resolve-locale.ts`
  (`morphz:i18n` — locale resolved, message override applied/missed),
  `date-time.ts` (`morphz:codec` — decode/encode called).
- **Where**: existing files listed above
- **Depends on**: T-001
- **Done when**: running with `DEBUG=morphz:*` in env produces visible
  output for a basic parse/error/embed flow; running without `DEBUG` set
  produces zero extra output.
- **Gate**: `npx vitest run` (existing 137, no regression) + manual
  `DEBUG=morphz:* node -e "..."` smoke check

**Total**: 2 tasks, sequential.
