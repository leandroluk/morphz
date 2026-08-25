import { z } from "zod";
import type { FieldDescriptor, FieldDescriptorMeta } from "../core/field-descriptor.js";

/**
 * `<T>` is COSMETIC/INERT today — `Struct()` itself isn't generic over its
 * `fields` record yet (the project's flagged CRITICAL FINDING: consumers
 * get zero field-level TS inference from any morphz primitive right now),
 * so this type parameter doesn't flow anywhere real. Kept for forward
 * compatibility / documentation intent, and because the runtime behavior
 * (accept arbitrary JSON-object-shaped values) works correctly regardless.
 *
 * Modeled as a string-keyed record of `unknown` (matches INSIGHT.md §15's
 * own example, an object shape) rather than `z.unknown()` bare — keeps
 * `mock.ts`'s existing "record" bare-schema synthesis path applicable with
 * zero extra plumbing (see mock.ts's `synthesizePrimitive`).
 */
export function Json<T = unknown>(
  overrides: Partial<FieldDescriptorMeta<T>> = {},
): FieldDescriptor<T> {
  return { zodSchema: z.record(z.string(), z.unknown()) as unknown as z.ZodType<T>, meta: overrides };
}
