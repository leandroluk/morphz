# Design: Property Interceptors (`get`/`set`)

## Architecture Overview
A shared helper, `applyFieldValue(instance, fieldName, descriptor, wireValue)`,
replaces the plain `Object.assign`-style write for ANY field carrying
`meta.get`/`meta.set` — used at BOTH points `struct.ts` currently assigns
fields directly (constructor's `Object.assign(this, data)` and
`safeParse`'s `Object.assign(instance, result.data)`). For fields WITHOUT
`get`/`set`, behavior is unchanged (plain enumerable property).

```
constructor(input) / safeParse(input)
   │  schema.parse()/.safeParse() already validated — `data` is WIRE-typed
   ▼
for each [fieldName, value] in data:
   has get/set?  ──no──▶ instance[fieldName] = value  (unchanged)
        │yes
        ▼
   applyFieldValue(instance, fieldName, descriptor, value)
        │
        ├─ backing slot: Symbol.for(`morphz:wire:${fieldName}`), one per
        │    field NAME (module-level, stable across instances — safe
        │    because it's namespaced by field name, not shared globally)
        │
        ├─ Object.defineProperty(instance, fieldName, { get, set, ... })
        │    get()  → descriptor.meta.get({ value: instance[backingSlot] })
        │    set(v) → immutable+already-initialized? throw
        │             else: descriptor.meta.set(v, accessor-proxy),
        │             write accessor-proxy.value back to instance[backingSlot]
        │
        └─ first call is the INITIAL write (from parse), marks initialized
```

## Backing slot: per-field-name `Symbol`, not a `WeakMap`
Simpler and cheap: `const WIRE_SLOT = new Map<string, symbol>()` (module-
level cache) — `getWireSlot(fieldName)` returns (or creates once)
`Symbol(`morphz:wire:${fieldName}`)`. Reusing the SAME symbol across all
instances of all classes for a given field NAME is safe because:
- it's a non-enumerable, non-colliding property key (real `Symbol`, not a
  string) — never appears in `Object.keys()`/JSON serialization/spread.
- two DIFFERENT classes both having a field literally named `id` with
  `get`/`set` would share the symbol KEY, but each INSTANCE stores its own
  VALUE under that key — no cross-instance leakage, symbols are just
  property keys, not shared storage.

## Constructor/`safeParse` integration
Both call sites currently do a single `Object.assign(target, data)`. Replace
with a loop: `for (const [name, value] of Object.entries(data)) { const d =
target[STRUCT_META].fields[name]; if (d?.meta.get && d?.meta.set)
applyFieldValue(this, name, d, value); else (this as any)[name] = value }`.
Extracted as one shared function (`assignFields(instance, data,
structMeta)`) called from both sites — avoids duplicating the branch logic
twice.

## Resolves REQ-004 (`.toJSON()`/`.toMaskedJSON()` read WIRE, not domain)
`to-json.ts`/`to-masked-json.ts` currently read `instance[fieldName]`
directly for every field — for a `get`/`set` field this would now trigger
the `get` ACCESSOR (returning the DOMAIN object), which is wrong per
REQ-004. Fix: both call a new shared `readWireValue(instance, fieldName,
descriptor)` — returns `instance[getWireSlot(fieldName)]` when
`descriptor.meta.get`/`.set` are present, else `instance[fieldName]`
(unchanged plain read) — one new small helper, two existing call sites
updated to use it instead of direct property access.

## Resolves REQ-005 (immutable + set throws post-construction)
Each `get`/`set` field gets a per-INSTANCE `initialized` flag — simplest
storage: reuse the SAME backing-symbol pattern with a second symbol
(`morphz:init:${fieldName}`) holding a boolean, or (simpler, chosen) close
over a per-`Object.defineProperty`-call local `let initialized = false` in
the accessor closure itself (each instance gets its OWN closure when
`applyFieldValue` runs per-instance, per-field — no shared state risk,
no second symbol needed). The FIRST `set` call (from the constructor/
`safeParse`'s initial assignment) sets `initialized = true`; the field's
OWN normal Zod-schema-level immutability (from `class-extensibility`,
unrelated mechanism) still governs `.parse()`-time re-validation on
derived DTOs — this closure-level guard is the NEW, ADDITIONAL protection
against direct runtime mutation (`user.id = ...`) that REQ-005 asked for.

## Resolves open question (STRUCT_META bookkeeping)
No new `STRUCT_META`-level bookkeeping needed — every consumer
(`assignFields`, `readWireValue`, `mock.ts`, `apply-jsdoc.ts` if relevant)
just checks `descriptor.meta.get`/`.meta.set` directly off the already-
existing `STRUCT_META.fields` entries. Confirmed the simpler path is
sufficient.

## `mock-fixtures` interaction
`.mock()` synthesizes the WIRE value (unchanged — it already produces
wire-shaped data that gets fed through the SAME validating constructor
path) — `set`'s normalization runs naturally as part of that constructor
call, no special-casing needed in `mock.ts` itself.

## New Components
| Component | Responsibility | Location |
|---|---|---|
| `applyFieldValue()` | Defines the get/set accessor pair + backing slot on one instance/field | `src/core/property-interceptor.ts` |
| `getWireSlot()` | Per-field-name Symbol cache | `src/core/property-interceptor.ts` |
| `readWireValue()` | Uniform wire-value read for `.toJSON()`/`.toMaskedJSON()` | `src/core/property-interceptor.ts` |
| `assignFields()` | Shared constructor/`safeParse` field-assignment loop (branches on get/set presence) | `src/core/property-interceptor.ts` |

## Dependency Paths
- `struct.ts`'s constructor and `static safeParse()` both switch from bare
  `Object.assign` to `assignFields()`.
- `to-json.ts`/`to-masked-json.ts` switch from `instance[fieldName]` to
  `readWireValue(instance, fieldName, descriptor)`.
- `define-metatypes`'s `FieldDescriptorMeta` gains `get?`/`set?` (small
  additive edit, same tier as `mask`/`encode`).

## Risks
- This is the SECOND feature (after `debug-observability`) whose primary
  deliverable is editing several already-shipped core files
  (`struct.ts`, `to-json.ts`, `to-masked-json.ts`) rather than adding new
  ones — real regression risk on the WHOLE test suite, not just new
  tests. Gate must be the FULL 208-test suite, not just new
  `property-interceptors` tests.
- `Object.defineProperty` per get/set field, per instance, has real
  (small but nonzero) construction-time cost vs. a plain assignment —
  acceptable given this is opt-in per field, not a universal default.

## Decision Log
- Per-field-name `Symbol` (not `WeakMap`/private class fields) for the
  backing slot — simplest mechanism that satisfies non-enumerability
  without extra data-structure bookkeeping, safe by construction (symbols
  are unique property keys regardless of value-sharing concerns).
- Immutable-post-construction guard implemented via closure state (`let
  initialized`) captured per-instance at `applyFieldValue()` call time,
  not a second backing symbol — simpler, equally correct (each call to
  `applyFieldValue` is already per-instance).
