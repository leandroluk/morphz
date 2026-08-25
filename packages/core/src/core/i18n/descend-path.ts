import type { FieldDescriptor } from "../field-descriptor.js";
import { STRUCT_META, type StructClass } from "../struct-meta.js";

/**
 * Descends `STRUCT_META.fields` one path segment at a time, following
 * `targetStruct` into `Embed`/`Ref` targets' OWN `STRUCT_META`. Stops the
 * moment a segment lands on something `morphz` has no registered descriptor
 * for (a `List` item index, `FromZodType` internals) — recursion boundary
 * is "introspectable morphz Struct," not "nested at all vs. not."
 *
 * Returns the descriptor for the FIELD the path ultimately resolves to,
 * plus how many leading path segments were consumed getting there. If the
 * resolved descriptor doesn't account for the full path (segments remain
 * unconsumed), the caller must NOT attempt a message lookup — those
 * remaining segments point somewhere `morphz` can't introspect.
 */
export interface DescendResult {
  descriptor: FieldDescriptor;
  consumed: number;
}

export function descendPath(
  rootStruct: StructClass,
  path: readonly PropertyKey[],
): DescendResult | undefined {
  if (path.length === 0) return undefined;

  let currentFields: Record<string, FieldDescriptor> = rootStruct[STRUCT_META].fields;
  let descriptor: FieldDescriptor | undefined;
  let consumed = 0;

  for (const segment of path) {
    if (typeof segment !== "string") break;
    descriptor = currentFields[segment];
    if (!descriptor) return undefined;
    consumed += 1;

    if (consumed === path.length) break;

    const target = descriptor.targetStruct?.();
    if (!target) break; // remaining path is not introspectable — stop here

    currentFields = (target as StructClass)[STRUCT_META].fields;
  }

  return descriptor ? { descriptor, consumed } : undefined;
}
