# Design: Lifecycle — Parsing, Instantiation, Serialization

## Architecture Overview

This feature is where `STRUCT_META.schema` (validation-only, per the
correction applied to `struct-entities/design.md` during this design) gets
turned into actual instances, using JS static-method polymorphism (`this`/
`new.target`) so subclasses (`AdminUser extends User.extend(...)`,
`class-extensibility`) instantiate correctly without `Struct()` ever having
had to know about them in advance.

```
StructClass.parse(input)          StructClass.safeParse(input)
       │                                    │
       ▼                                    ▼
new StructClass(input)   this[STRUCT_META].schema.safeParse(input)
       │                              │              │
       ▼                         success         failure
constructor runs:                    │              │
new.target[STRUCT_META]              ▼              ▼
  .schema.parse(input)      bypass ctor (already   resolveIssueMessages()
  → throws ValidationError    validated), attach     → { success:false,
    OR assigns validated       to new.target's         errors }
    data onto `this`           prototype directly
       │                              │
       ▼                              ▼
  real instance               { success:true, data: real instance }
```

## `constructor(input)` — the single validating entry point

```ts
class GeneratedBase {
  constructor(input: unknown) {
    const target = new.target as typeof GeneratedBase;
    const data = target[STRUCT_META].schema.parse(input);
    // pipeline may itself throw ZodError — caught and re-thrown as
    // ValidationError with i18n-resolved messages, see below
    Object.assign(this, data);
  }
}
```

`new.target` (not `this.constructor`) is used deliberately: it resolves to
whatever class `new` was actually invoked on, correctly, even inside a
`super()` call chain from a subclass constructor that adds its own fields
via `.extend()` (`class-extensibility`) — `this.constructor` would work too
in the common case, but `new.target` is the semantically-precise tool for
"which class is being constructed right now," matching Node/V8's own
documented use case for this exact scenario.

**Resolves REQ-002 (constructor vs. `.parse()` equivalence):** `new
StructClass(input)` and `StructClass.parse(input)` are fully equivalent —
`.parse()` is implemented as literally `return new this(input)`. INSIGHT.md
§7A's "Ou via construtor" comment is taken at face value: one validating
code path, not two.

## `ValidationError`

```ts
class ValidationError extends Error {
  issues: ResolvedIssue[]; // same shape as ZodError.issues, messages
  // already passed through resolveIssueMessages()
  constructor(zodError: z.ZodError, structClass: StructClass) {
    super("Validation failed");
    this.issues = resolveIssueMessages(zodError, structClass, resolveLocale());
  }
}
```

The constructor above catches the `ZodError` `schema.parse()` throws and
re-throws `ValidationError` instead — `i18n-error-messages`'s
`resolveIssueMessages()` (already designed) is the ONLY place messages get
localized/overridden; `ValidationError.issues` is Zod's shape with `message`
fields already substituted, so callers never need to know the override
mechanism exists.

## `static safeParse(input)` — avoids double validation

```ts
static safeParse(input: unknown) {
  const result = this[STRUCT_META].schema.safeParse(input)
  if (!result.success) {
    return {
      success: false,
      errors: resolveIssueMessages(result.error, this, resolveLocale())
    }
  }
  // data is ALREADY validated — do not re-run it through the constructor
  // (which would re-validate). Bypass: attach directly to this class's
  // prototype instead of calling `new this(...)`.
  const instance = Object.create(this.prototype)
  Object.assign(instance, result.data)
  return { success: true, data: instance }
}
```

This resolves `spec.md`'s open question about a "trusted fast-path
constructor" WITHOUT adding one to the public API (INSIGHT.md never asks
for a second public constructor mode, and REQ-002 above commits the public
constructor to always validating) — the optimization is entirely internal
to `safeParse`, invisible to callers, `instance instanceof StructClass`
still holds (`Object.create(this.prototype)` preserves the prototype
chain), and domain methods work identically since they live on the
prototype, not per-instance.

## `.toJSON()`

```ts
toJSON(): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, descriptor] of Object.entries(
    (this.constructor as StructClass)[STRUCT_META].fields
  )) {
    if (descriptor.meta.writeOnly) continue
    out[key] = encodeFieldValue(this[key], descriptor)
  }
  return out
}

function encodeFieldValue(value: unknown, descriptor: FieldDescriptor): unknown {
  if (value == null) return value
  if (Array.isArray(value)) return value.map(v => encodeFieldValue(v, descriptor.itemDescriptor!))
  if (descriptor.targetStruct && typeof (value as any).toJSON === 'function') {
    return (value as { toJSON(): unknown }).toJSON()   // recurse into Embed/Ref instances
  }
  return descriptor.meta.encode ? descriptor.meta.encode(value) : value
}
```

- `writeOnly` fields (e.g. `Password`) are skipped entirely — resolves
  `spec.md`'s open question on where `writeOnly` lives: it's a `meta` flag
  on `FieldDescriptor` (same tier as `immutable`), set by whichever core
  primitive/`Define` call declares it (`Password({ writeOnly: true })`),
  NOT a `Struct`-level annotation — belongs conceptually to
  `define-metatypes`, flagged as a small addition to that (already-
  completed) design: `FieldDescriptor.meta.writeOnly?: boolean`.
- **New dependency surfaced on `datetime-codec`** (not yet designed):
  `.toJSON()` needs `descriptor.meta.encode?: (val) => unknown` to turn a
  `DateTime`/`Timestamp` field's in-memory `Date` back into an ISO string —
  same codec `encode` function `datetime-codec/spec.md` REQ-004 already
  requires to exist; this design just names the exact hook `.toJSON()` calls
  it through. `datetime-codec`'s own design (still pending) must set
  `meta.encode` when building the `DateTime` `FieldDescriptor`.
- `descriptor.itemDescriptor` (for `List`) is a small necessary addition to
  `List()`'s `FieldDescriptor` in `define-metatypes` — needed so
  `.toJSON()` knows how to encode EACH item (plain value vs. `Embed`/`Ref`
  instance vs. codec-encoded value), not just the list itself. Flagged as
  a follow-up to that design.

## New Components

| Component                               | Responsibility                                                           | Location                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `GeneratedBase` constructor             | Single validating entry point using `new.target` polymorphism            | `src/core/struct.ts` (extends the class `struct-entities` already builds) |
| `ValidationError`                       | Thrown by constructor/`.parse()` on failure, i18n-resolved issues        | `src/core/validation-error.ts`                                            |
| `static parse()` / `static safeParse()` | Public entry points, `safeParse` bypasses double-validation              | `src/core/struct.ts`                                                      |
| `.toJSON()`                             | Recursive serialization, `writeOnly` masking, codec `encode` application | `src/core/to-json.ts`                                                     |

## Dependency Paths

- `constructor`/`parse`/`safeParse` → `STRUCT_META.schema` (`struct-
entities`, corrected to exclude instantiation) → `resolveIssueMessages()`
  (`i18n-error-messages`, already designed).
- `.toJSON()` → `FieldDescriptor.meta.writeOnly` (new, `define-metatypes`
  follow-up), `meta.encode` (new, `datetime-codec` — still pending design),
  `meta.itemDescriptor` (new, `define-metatypes`'s `List()` follow-up),
  `descriptor.targetStruct` (`i18n-error-messages`'s earlier follow-up,
  reused here for recursive `Embed`/`Ref` serialization — same field,
  second consumer).

## Risks

- Three small additive follow-ups now owed to `define-metatypes`
  (`writeOnly`, `List`'s `itemDescriptor`) and ONE to the still-undesigned
  `datetime-codec` (`encode`) — none change existing shape, all are new
  optional fields on `FieldDescriptor`/`meta`, so no risk of breaking
  already-completed designs, but they DO need to land before Execute phase
  treats `define-metatypes` as fully final. Recommend a consolidated pass
  over `define-metatypes/design.md`'s `FieldDescriptor` interface once
  `datetime-codec` design is also done, to apply all pending additions in
  one edit instead of piecemeal.
- `new.target` inside a constructor is correct but easy to get wrong during
  Execute if a future maintainer instinctively reaches for `this.constructor`
  instead — worth a one-line comment in the actual implementation, not just
  this doc.

## Decision Log

- Instantiation deliberately excluded from `STRUCT_META.schema` (correction
  applied retroactively to `struct-entities/design.md`) — the ROOT decision
  this whole feature's design turns on. Without it, subclass polymorphism
  (`class-extensibility`'s core promise) silently breaks.
- Chose `new.target` over `this.constructor` for the constructor's
  self-lookup — more precise under inheritance, standard idiom for this
  exact "which subclass is being built" problem.
- `safeParse`'s double-validation avoidance is an internal-only
  optimization (`Object.create(this.prototype)`), never exposed as a public
  "trusted construct" API — keeps the public surface exactly what
  INSIGHT.md documents (constructor + `.parse()` + `.safeParse()`, nothing
  else).
