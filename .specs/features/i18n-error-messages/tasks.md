# Tasks: Custom Error Messages & i18n

_(PO breakdown, from spec.md + design.md)_

## T-001: `resolveLocale()`

- **REQ**: REQ-003
- **What**: `AsyncLocalStorage → getConfig().locale?.default → 'en-US'`.
- **Where**: `src/core/i18n/resolve-locale.ts`
- **Depends on**: `project-config`'s `getConfig()` (stub to `{}` if not yet
  implemented — don't hard-block)
- **Done when**: no context + no config → `'en-US'`; config default wins
  over hard fallback; `AsyncLocalStorage` wins over config.
- **Gate**: `npm run test -- resolve-locale`

## T-002: `lookupMessage()`

- **REQ**: REQ-001, REQ-002, REQ-004
- **What**: `(descriptor, issue, locale, fallbackLocale?) => string | undefined`.
  Handles `invalid_format`'s `format` sub-key shorthand (direct locale-map OR
  nested under `issue.format`). Never throws.
- **Where**: `src/core/i18n/lookup-message.ts`
- **Depends on**: `define-metatypes` (`FieldDescriptor`)
- **Done when**: a field with `message: { invalid_type: {...} }` matches on
  `invalid_type` issues; a field with `message: { invalid_format: {...} }`
  matches regex/email/etc. failures regardless of `format` value (shorthand
  case); missing entry → `undefined`, not a throw.
- **Gate**: `npm run test -- lookup-message`

## T-003: `descendPath()` / `resolveIssueMessages()`

- **REQ**: REQ-004, REQ-005, REQ-006 (+ the Embed/Ref recursion refinement)
- **What**: walks `zodError.issues`; per issue, descends `STRUCT_META.fields`
  one path segment at a time, following `targetStruct` into `Embed`/`Ref`
  targets' OWN `STRUCT_META`; stops (falls back to raw message) the moment a
  segment has no matching field descriptor (`List` item index,
  `FromZodType` internals).
- **Where**: `src/core/i18n/descend-path.ts`, `src/core/i18n/resolve-issues.ts`
- **Depends on**: T-001, T-002, `struct-entities` (`STRUCT_META`)
- **Done when**: top-level field override works; `['address','zipCode']`
  (Embed) resolves against `Address`'s own registered message; `['tags',2]`
  (List) and a `FromZodType` composite's deep path both fall back to raw
  Zod message untouched.
- **Gate**: `npm run test -- resolve-issues`

**Total**: 3 tasks, mostly sequential (T-001/T-002 parallelizable `[P]`,
both before T-003).
