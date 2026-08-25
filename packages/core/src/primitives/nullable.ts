import type { FieldDescriptor } from "../core/field-descriptor.js";

/**
 * `inner` is always invoked with ZERO args when it's still a bare factory
 * reference (`Nullable(DateTime)`) — same convention as `Define`'s
 * `BaseTypeArg<T>` — never `FieldDescriptorFactory<T>` (which implies
 * accepting the factory's OWN `Opts`, causing a parameter-contravariance
 * mismatch for any factory whose `Opts` isn't `unknown`, e.g. `DateTime`).
 */
export function Nullable<T>(
  inner: (() => FieldDescriptor<T>) | FieldDescriptor<T>,
): FieldDescriptor<T | null> {
  const descriptor = typeof inner === "function" ? inner() : inner;
  return {
    zodSchema: descriptor.zodSchema.nullable(),
    meta: descriptor.meta as never,
    itemDescriptor: descriptor.itemDescriptor,
    targetStruct: descriptor.targetStruct,
  };
}
