# Design: Custom Error Messages & i18n

## Architecture Overview
One function, `resolveIssueMessages(zodError, rootStructClass, locale)`,
called by `lifecycle-serialization`'s `.parse()`/`.safeParse()` right after
Zod validation fails, before the error/result is returned to the caller. It
walks `zodError.issues`, and for each issue attempts to find a registered
`message[code]` override by descending `STRUCT_META.fields` one path
segment at a time.

```
error.issues[i] = { path: ['address', 'zipCode'], code: 'invalid_format', format: 'regex', message: 'raw zod msg' }
        │
        ▼
rootStruct[STRUCT_META].fields['address']   — descriptor for `address`
        │  is this an Embed/Ref field (points at another Struct)?
        ▼  yes → descend into its target's STRUCT_META
targetStruct[STRUCT_META].fields['zipCode'] — descriptor for `zipCode`
        │  path exhausted (last segment) → look up message
        ▼
descriptor.meta.message['invalid_format']['regex']?.[locale]
        │  found → substitute issue.message
        │  not found → leave raw Zod message untouched (never throws)
```

## Correction to earlier "Resolved" note in spec.md
The session's earlier resolution said "`List`, `Embed`, `FromZodType`
composite all behave identically [...] fall back to Zod's raw message." That
was **too broad** — worked through more carefully during design, it
conflates two genuinely different cases:

- **`List` items and `FromZodType`-wrapped composite internals**: `morphz`
  has NO structural knowledge of what's at a deeper path (`['tags', 2]`,
  `['coordinates', 0]`) — there is no per-item `Define`, no registered
  field descriptor to look anything up in. Fallback to raw Zod message is
  correct and necessary here — there's genuinely nothing to resolve.
- **`Embed`/`Ref` targets**: these DO point at another `morphz` `Struct`
  with its OWN, fully-populated `STRUCT_META.fields` — `Address`'s
  `zipCode` field has its own `Define`d `message` map exactly like any
  top-level field would. There is no reason to fall back to raw Zod here;
  the information needed to resolve it properly already exists.

**Corrected rule:** resolution recurses through path segments AS LONG AS
each segment's field descriptor points at another introspectable `morphz`
`Struct` (`Embed`/`Ref`/`Optional(Embed(...))`/`Optional(List(Ref(...)))`
unwrapped down to the target). It stops — falls back to raw Zod message —
the moment a path segment lands on something `morphz` doesn't have a
registered descriptor for: a `List` item index, or anywhere inside a
`FromZodType`-wrapped schema's own internal structure. This is still "one
rule, no per-field-type special-casing" — the rule is just "recurse while
introspectable," not "never recurse."

## Required addition to `struct-entities`/`entity-relationships` designs
For the recursion above to work, `Embed()` and `Ref()`'s `FieldDescriptor`
must expose WHICH target `Struct` class they point at, not just the target's
`.zodSchema`:

```ts
interface FieldDescriptor<T> {
  zodSchema: z.ZodType<T>
  meta: { /* ...existing... */ }
  targetStruct?: () => StructClass   // set by Embed()/Ref() only;
                                      // thunk form covers Ref's lazy case,
                                      // Embed can wrap a same-shape thunk
                                      // trivially (`() => TargetStructClass`)
}
```
This is a small, additive change to `struct-entities/design.md`'s `Embed()`
section and `entity-relationships/design.md`'s `Ref()` section — flagged
here rather than silently redesigning those (both already-completed)
designs; apply as a follow-up edit to both files.

## Locale resolution
```ts
function resolveLocale(): string {
  return asyncLocalStorageContext.getStore()?.locale
      ?? loadedConfig?.locale?.default
      ?? 'en-US'  // hard fallback when zero-config AND no request context
}
```
Order: request-scoped `AsyncLocalStorage` (highest precedence, per-call) →
`morphz.config.ts`'s `locale.default` (project-wide) → hard-coded `'en-US'`
(zero-config safety net — resolves `project-config/spec.md`'s open question
on the library-wide default). `fallback` (from config) is used ONLY at
message-lookup time (below), not here — `resolveLocale()` picks the
PREFERRED locale; `fallback` is consulted when that locale's specific key is
missing from a given `message` map.

## Message lookup for one issue
```ts
function lookupMessage(descriptor: FieldDescriptor, issue: ZodIssue, locale: string, fallbackLocale?: string): string | undefined {
  const codeEntry = descriptor.meta.message?.[issue.code]
  if (!codeEntry) return undefined

  // invalid_format issues carry a `format` sub-discriminator (see
  // define-metatypes correction) — codeEntry may itself be a locale map
  // (shorthand, single-format field) OR nested one level under `issue.format`
  const localeMap =
    typeof codeEntry === 'object' && issue.format && issue.format in codeEntry
      ? codeEntry[issue.format]
      : codeEntry

  if (typeof localeMap === 'string') return localeMap  // fixed, locale-independent
  return localeMap[locale] ?? (fallbackLocale ? localeMap[fallbackLocale] : undefined)
  // undefined here → caller leaves Zod's raw message untouched (REQ-004, never throws)
}
```
Resolves the fallback open question from spec.md: if neither `locale` nor
`fallback` has an entry, the function returns `undefined` — the CALLER
(`resolveIssueMessages`) treats that identically to "no override registered
at all," falling through to Zod's raw message. No config error is ever
thrown — consistent with REQ-004's "never throws" guarantee.

## New Components
| Component | Responsibility | Location |
|---|---|---|
| `resolveIssueMessages()` | Top-level entry point, walks `zodError.issues`, called by `lifecycle-serialization` | `src/core/i18n/resolve-issues.ts` |
| `descendPath()` | Recurses through `STRUCT_META.fields` via `targetStruct`, stops at introspectability boundary | `src/core/i18n/descend-path.ts` |
| `lookupMessage()` | `(descriptor, issue, locale) → string \| undefined`, handles `invalid_format`'s `format` sub-key | `src/core/i18n/lookup-message.ts` |
| `resolveLocale()` | `AsyncLocalStorage → config.locale.default → 'en-US'` | `src/core/i18n/resolve-locale.ts` |

## Dependency Paths
- `resolveIssueMessages` → `STRUCT_META.fields` (`struct-entities`) →
  `targetStruct` (new field, `struct-entities`/`entity-relationships`
  addition above).
- `resolveLocale` → `project-config`'s loaded singleton (lazy-discovery or
  `morphz/register`, per that feature's design) — read-only consumer, no
  new coupling.
- Wired into the pipeline by `lifecycle-serialization` (next design) —
  this feature only defines the pure function, not where it's called from.

## Risks
- `descendPath`'s recursion depth is bounded by the entity graph's actual
  nesting (typically 1-3 levels for `Embed`d value objects) — no risk of
  runaway recursion since `Ref`'s lazy thunks still resolve to a FINITE
  concrete class per issue's path, and `STRUCT_META` is built once per class
  (no re-entrant construction during error resolution).
- The `targetStruct` addition to `FieldDescriptor` touches TWO already-
  designed features (`struct-entities`, `entity-relationships`) — flagged
  explicitly above rather than assumed; both design.md files need a small
  follow-up edit before Execute phase treats them as final.

## Decision Log
- Corrected the session's earlier over-broad "List/Embed/FromZodType all
  behave identically" resolution — recursion boundary is "introspectable
  morphz Struct" vs. "opaque to morphz," not "nested at all vs. not."
- `resolveLocale()`'s hard-coded `'en-US'` zero-config fallback resolves
  `project-config/spec.md`'s remaining open question on that point.
- Kept `lookupMessage` a pure function with no side effects/throws — matches
  REQ-004's "never breaks the parse, override is purely additive" contract.
