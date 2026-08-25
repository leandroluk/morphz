import { z } from "zod";
import type { FieldDescriptor } from "./field-descriptor.js";
import { STRUCT_META } from "./struct-meta.js";
import { buildStructClass, type StructConstructor } from "./struct.js";

function normalizeNames(names: string[] | [string[]]): string[] {
  return names.length === 1 && Array.isArray(names[0]) ? names[0] : (names as string[]);
}

function toMask(names: string[]): Record<string, true> {
  const mask: Record<string, true> = {};
  for (const name of names) mask[name] = true;
  return mask;
}

/**
 * Patches every field still present in `rawSchema.shape` that's marked
 * `meta.immutable` to `z.undefined().optional()` — accepts ONLY absence,
 * rejects any concrete value (Zod's own `invalid_type` issue). Applied
 * unconditionally by `.omit()`/`.pick()`/`.partial()`, order never matters.
 */
function stripImmutable(
  rawSchema: z.ZodObject,
  fields: Record<string, FieldDescriptor>,
): z.ZodObject {
  const patch: Record<string, z.ZodType> = {};
  for (const [name, descriptor] of Object.entries(fields)) {
    if (descriptor.meta.immutable && name in rawSchema.shape) {
      patch[name] = z.undefined().optional();
    }
  }
  return Object.keys(patch).length > 0 ? rawSchema.extend(patch) : rawSchema;
}

type DeriveMode = "omit" | "pick";

function deriveVariant(
  source: StructConstructor,
  transform: (schema: z.ZodObject) => z.ZodObject,
  names: string[],
  mode: DeriveMode,
): StructConstructor {
  const sourceMeta = source[STRUCT_META];
  const nameSet = new Set(names);

  const newFields: Record<string, FieldDescriptor> =
    mode === "omit"
      ? Object.fromEntries(Object.entries(sourceMeta.fields).filter(([k]) => !nameSet.has(k)))
      : Object.fromEntries(Object.entries(sourceMeta.fields).filter(([k]) => nameSet.has(k)));

  let newRawObjectSchema = transform(sourceMeta.rawObjectSchema);
  newRawObjectSchema = stripImmutable(newRawObjectSchema, newFields);

  return buildStructClass({
    // No extendsClass: independent class, `instanceof` source deliberately
    // does NOT hold (a subset/reshape is not an IS-A relationship).
    rawObjectSchema: newRawObjectSchema,
    hooks: sourceMeta.hooks,
    fields: newFields,
    labels: sourceMeta.labels,
    description: sourceMeta.description,
    pendingEntityNameDerivation: sourceMeta.pendingEntityNameDerivation,
    templateDelimiter: sourceMeta.templateDelimiter,
  });
}

function omit(this: StructConstructor, ...names: string[] | [string[]]): StructConstructor {
  const flat = normalizeNames(names);
  return deriveVariant(this, (schema) => schema.omit(toMask(flat)), flat, "omit");
}

function pick(this: StructConstructor, ...names: string[] | [string[]]): StructConstructor {
  const flat = normalizeNames(names);
  return deriveVariant(this, (schema) => schema.pick(toMask(flat)), flat, "pick");
}

function partial(this: StructConstructor): StructConstructor {
  const meta = this[STRUCT_META];
  const newRawObjectSchema = stripImmutable(meta.rawObjectSchema.partial(), meta.fields);
  return buildStructClass({
    rawObjectSchema: newRawObjectSchema,
    hooks: meta.hooks,
    fields: meta.fields,
    labels: meta.labels,
    description: meta.description,
    pendingEntityNameDerivation: meta.pendingEntityNameDerivation,
    templateDelimiter: meta.templateDelimiter,
  });
}

export function attachDeriveVariant(klass: StructConstructor): void {
  const target = klass as unknown as {
    omit: typeof omit;
    pick: typeof pick;
    partial: typeof partial;
  };
  target.omit = omit;
  target.pick = pick;
  target.partial = partial;
}
