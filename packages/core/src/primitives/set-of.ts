import { z } from "zod";
import type {
  FieldDescriptor,
  FieldDescriptorFactory,
  FieldDescriptorMeta,
} from "../core/field-descriptor.js";
import { logCodec } from "../core/debug.js";

export interface SetOfOptions<T> extends Partial<FieldDescriptorMeta<Set<T>>> {
  minSize?: number;
}

/**
 * Zod v4 DOES have a native `z.set()`, but its wire/input side is itself a
 * JS `Set` -- not JSON-representable (JSON has no Set literal). So this
 * codes wire=array (JSON-safe, uniqueness enforced via `.refine()`) <->
 * domain=real `Set<T>`, matching every other codec-based primitive's
 * wire/domain convention in this codebase, rather than using `z.set()`
 * directly. `itemDescriptor` is set on the returned descriptor (same as
 * `List()`) so `.mock()`'s existing item-synthesis path supplies a valid
 * WIRE array without any extra plumbing.
 */
export function SetOf<T>(
  itemType: FieldDescriptorFactory<T> | FieldDescriptor<T>,
  overrides: SetOfOptions<T> = {},
): FieldDescriptor<Set<T>> {
  const itemDescriptor = typeof itemType === "function" ? itemType() : itemType;
  const { minSize, ...meta } = overrides;

  let wireSchema = z
    .array(itemDescriptor.zodSchema)
    .refine((arr) => new Set(arr).size === arr.length, {
      message: "Items must be unique",
    });
  if (minSize !== undefined) {
    wireSchema = wireSchema.refine((arr) => arr.length >= minSize, {
      message: `Expected at least ${minSize} unique items`,
    }) as typeof wireSchema;
  }

  // z.codec()'s generic inference over `z.instanceof(Set)` collapses to
  // `Set<unknown>`, not `Set<T>` -- loosened to `any` here deliberately,
  // the runtime behavior (decode/encode) is correct regardless.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const codec = z.codec(wireSchema as any, z.instanceof(Set) as any, {
    decode: (arr: T[]) => {
      logCodec("decoding SetOf wire array (%d items)", arr.length);
      return new Set(arr);
    },
    encode: (set: Set<T>) => {
      logCodec("encoding SetOf domain Set (%d items)", set.size);
      return Array.from(set);
    },
  }) as unknown as z.ZodType<Set<T>>;

  return {
    zodSchema: codec as z.ZodType<Set<T>>,
    meta: { ...meta, encode: (set: Set<T>) => Array.from(set) },
    itemDescriptor: itemDescriptor as FieldDescriptor<unknown>,
  };
}
