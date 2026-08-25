import type { FieldDescriptor } from "./field-descriptor.js";
import type { StructMeta } from "./struct-meta.js";

const wireSlots = new Map<string, symbol>();

/** Per-field-name Symbol, cached and reused across all instances/classes. */
export function getWireSlot(fieldName: string): symbol {
  let slot = wireSlots.get(fieldName);
  if (!slot) {
    slot = Symbol(`morphz:wire:${fieldName}`);
    wireSlots.set(fieldName, slot);
  }
  return slot;
}

/**
 * Defines a get/set accessor pair on `instance` for one field, backed by a
 * non-enumerable wire-value slot. The initial `wireValue` is the field's
 * first (constructor/safeParse-provided) value. `immutable` fields reject
 * any `set` call after that first write.
 */
export function applyFieldValue(
  instance: object,
  fieldName: string,
  descriptor: FieldDescriptor,
  wireValue: unknown,
): void {
  const slot = getWireSlot(fieldName);
  const { get, set, immutable } = descriptor.meta;

  Object.defineProperty(instance, slot, {
    value: undefined,
    writable: true,
    enumerable: false,
    configurable: true,
  });

  let initialized = false;

  Object.defineProperty(instance, fieldName, {
    enumerable: true,
    configurable: true,
    get(this: Record<symbol, unknown>) {
      return get!({ value: this[slot] });
    },
    set(this: Record<symbol, unknown>, val: unknown) {
      if (immutable && initialized) {
        throw new Error(`Field '${fieldName}' is immutable and cannot be reassigned`);
      }
      const accessor = { value: this[slot] };
      set!(val, accessor);
      this[slot] = accessor.value;
      initialized = true;
    },
  });

  (instance as Record<string, unknown>)[fieldName] = wireValue;
}

/**
 * Reads a field's raw WIRE value — bypasses the `get` accessor (which
 * returns the DOMAIN object) for fields with property interceptors, so
 * `.toJSON()`/`.toMaskedJSON()` always serialize the wire representation.
 */
export function readWireValue(
  instance: object,
  fieldName: string,
  descriptor: FieldDescriptor,
): unknown {
  if (descriptor.meta.get && descriptor.meta.set) {
    return (instance as Record<symbol, unknown>)[getWireSlot(fieldName)];
  }
  return (instance as Record<string, unknown>)[fieldName];
}

/**
 * Assigns parsed field data onto a fresh instance — plain enumerable
 * properties for ordinary fields, get/set accessor pairs (via
 * `applyFieldValue`) for fields declaring both `meta.get` and `meta.set`.
 */
export function assignFields(
  instance: object,
  data: Record<string, unknown>,
  structMeta: StructMeta,
): void {
  for (const [name, value] of Object.entries(data)) {
    const descriptor = structMeta.fields[name];
    if (descriptor?.meta.get && descriptor?.meta.set) {
      applyFieldValue(instance, name, descriptor, value);
    } else {
      (instance as Record<string, unknown>)[name] = value;
    }
  }
}
