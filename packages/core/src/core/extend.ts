import { z } from "zod";
import type { FieldDescriptor } from "./field-descriptor.js";
import { resolveFieldTemplates } from "./template.js";
import { STRUCT_META } from "./struct-meta.js";
import { buildStructClass, type StructConstructor } from "./struct.js";

/**
 * Superset derivation: `BaseStruct.extend(newFields)` returns a class that
 * literally `extends` `BaseStruct` — real JS subclassing, so `instanceof`
 * holds transitively through the whole chain (`admin instanceof AdminUser`
 * AND `admin instanceof User`). Redeclaring an existing field name silently
 * overrides the parent's (falls out of Zod's own `ZodObject.extend()`
 * semantics, not a morphz-specific rule).
 */
function extend(
  this: StructConstructor,
  newFields: Record<string, FieldDescriptor>,
): StructConstructor {
  const parentMeta = this[STRUCT_META];

  const shape: Record<string, z.ZodType> = {};
  const resolvedNewFields: Record<string, FieldDescriptor> = {};
  for (const [key, descriptor] of Object.entries(newFields)) {
    const resolvedMeta = resolveFieldTemplates(
      descriptor.meta,
      parentMeta.labels,
      parentMeta.templateDelimiter ?? "#",
    );
    let fieldSchema = descriptor.zodSchema;

    // Primitives never bake `.default()` in themselves (see struct.ts's
    // buildRawObjectSchema) — new fields added via `.extend()` need the
    // same treatment, otherwise `meta.default` would be silently ignored.
    if (resolvedMeta.default !== undefined) {
      const def = resolvedMeta.default;
      fieldSchema =
        typeof def === "function"
          ? (fieldSchema as unknown as { default: (d: () => unknown) => z.ZodType }).default(
              def as () => unknown,
            )
          : (fieldSchema as unknown as { default: (d: unknown) => z.ZodType }).default(def);
    }

    shape[key] = fieldSchema;
    resolvedNewFields[key] = { ...descriptor, meta: resolvedMeta, zodSchema: fieldSchema };
  }

  const rawObjectSchema = parentMeta.rawObjectSchema.extend(shape);

  return buildStructClass({
    extendsClass: this,
    rawObjectSchema,
    hooks: parentMeta.hooks,
    fields: { ...parentMeta.fields, ...resolvedNewFields },
    labels: parentMeta.labels,
    description: parentMeta.description,
    pendingEntityNameDerivation: parentMeta.pendingEntityNameDerivation,
    templateDelimiter: parentMeta.templateDelimiter,
  });
}

export function attachExtend(klass: StructConstructor): void {
  (klass as unknown as { extend: typeof extend }).extend = extend;
}
