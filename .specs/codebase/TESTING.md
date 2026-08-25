# Testing: morphz

- Framework: `vitest`. Run all: `npm test`. Run one file/pattern: `npm run test -- <pattern>`.
- Type gate (run before/alongside tests): `npx tsc --noEmit`.
- Test files colocated as `src/**/*.test.ts`.
- QA persona responsibility: for each feature, write tests covering every REQ in that feature's `spec.md`, run the full suite (`npm test`), report pass/fail counts and any REQ not covered.
- No test should depend on wall-clock time without controlling it (e.g. `TimeAgo`/`Timestamp` tests should inject or freeze `Date` rather than sleeping).
