import { z } from "zod";
import type { FieldDescriptor } from "./field-descriptor.js";
import { STRUCT_META } from "./struct-meta.js";
import { buildStructClass, resolveEntityNameIfPending, type StructConstructor } from "./struct.js";

/**
 * Runtime guard for the mask-object API (`mask-object-derivation`). The
 * variadic / single-array forms were removed — a string or array argument
 * here is almost always old call-site code, so fail with a migration hint
 * rather than letting Zod throw an opaque error two frames down.
 */
function assertMask(
  mask: unknown,
  method: "omit" | "pick" | "partial",
): asserts mask is Record<string, true> {
  if (mask === null || typeof mask !== "object" || Array.isArray(mask)) {
    throw new TypeError(
      `${method}() expects a mask object, e.g. .${method}({ id: true }) — the variadic ` +
        `.${method}("id", "createdAt") / array .${method}(["id"]) forms were removed in morphz 0.2.`,
    );
  }
}

/** Keeps only own-enumerable keys whose value is literally `true`. */
function cleanMask(mask: Record<string, unknown>): Record<string, true> {
  const out: Record<string, true> = {};
  for (const [k, v] of Object.entries(mask)) if (v === true) out[k] = true;
  return out;
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
  keys: string[],
  mode: DeriveMode,
): StructConstructor {
  // Pin the source's entityName (default-entity-name) before its labels are
  // copied onto the derived class, so a DTO built from a zero-config Struct
  // still interpolates against the SOURCE's name where it's already known.
  resolveEntityNameIfPending(source[STRUCT_META], source.name);
  const sourceMeta = source[STRUCT_META];
  const keySet = new Set(keys);

  const newFields: Record<string, FieldDescriptor> =
    mode === "omit"
      ? Object.fromEntries(Object.entries(sourceMeta.fields).filter(([k]) => !keySet.has(k)))
      : Object.fromEntries(Object.entries(sourceMeta.fields).filter(([k]) => keySet.has(k)));

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

function omit(this: StructConstructor, mask: Record<string, true>): StructConstructor {
  assertMask(mask, "omit");
  const clean = cleanMask(mask);
  return deriveVariant(this, (schema) => schema.omit(clean), Object.keys(clean), "omit");
}

function pick(this: StructConstructor, mask: Record<string, true>): StructConstructor {
  assertMask(mask, "pick");
  const clean = cleanMask(mask);
  return deriveVariant(this, (schema) => schema.pick(clean), Object.keys(clean), "pick");
}

function partial(this: StructConstructor, mask?: Record<string, true>): StructConstructor {
  if (mask !== undefined) assertMask(mask, "partial");
  resolveEntityNameIfPending(this[STRUCT_META], this.name);
  const meta = this[STRUCT_META];
  const clean = mask ? cleanMask(mask) : undefined;
  const partialed = clean ? meta.rawObjectSchema.partial(clean) : meta.rawObjectSchema.partial();
  const newRawObjectSchema = stripImmutable(partialed, meta.fields);
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
