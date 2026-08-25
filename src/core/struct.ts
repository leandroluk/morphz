import { z } from "zod";
import type { FieldDescriptor } from "./field-descriptor.js";
import { resolveFieldTemplates } from "./template.js";
import { STRUCT_META, type StructHooks, type StructMeta } from "./struct-meta.js";
import { ValidationError } from "./validation-error.js";
import { resolveIssueMessages } from "./i18n/resolve-issues.js";
import { resolveLocale } from "./i18n/resolve-locale.js";
import { toJSON } from "./to-json.js";

export interface StructOptions {
  labels?: Record<string, string>;
  description?: string;
  pre?: (val: unknown) => unknown;
  post?: (val: unknown, ctx: unknown) => void;
  /** Template delimiter override; defaults to '#'. Normally comes from project-config. */
  templateDelimiter?: string;
}

/**
 * Builds a rawObjectSchema (bare z.object, no pre/post/transform) from a
 * field record, applying `meta.default` via Zod's own `.default()` and
 * resolving `#placeholder` templates in description/message using `labels`.
 * Returns the resolved field map alongside the schema (struct.ts's own
 * responsibility per struct-entities/design.md — primitives never bake
 * `.default()` in themselves, per the datetime-codec QA note).
 */
function buildRawObjectSchema(
  fields: Record<string, FieldDescriptor>,
  labels: Record<string, string>,
  delimiter: string,
): { rawObjectSchema: z.ZodObject; resolvedFields: Record<string, FieldDescriptor> } {
  const shape: Record<string, z.ZodType> = {};
  const resolvedFields: Record<string, FieldDescriptor> = {};

  for (const [key, descriptor] of Object.entries(fields)) {
    const resolvedMeta = resolveFieldTemplates(descriptor.meta, labels, delimiter);
    let fieldSchema = descriptor.zodSchema;

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
    resolvedFields[key] = { ...descriptor, meta: resolvedMeta, zodSchema: fieldSchema };
  }

  return { rawObjectSchema: z.object(shape), resolvedFields };
}

/**
 * Assembles pre -> object -> post (validation only, no instantiation
 * transform — see struct-entities/design.md's correction) and returns a
 * real class carrying STRUCT_META. The constructor uses `new.target` so
 * subclasses (class-extensibility's `.extend()`) instantiate correctly.
 */
export function Struct(
  fields: Record<string, FieldDescriptor>,
  options: StructOptions = {},
): StructConstructor {
  const labels = options.labels ?? {};
  const delimiter = options.templateDelimiter ?? "#";
  const { rawObjectSchema, resolvedFields } = buildRawObjectSchema(fields, labels, delimiter);

  let schema: z.ZodType = options.post
    ? rawObjectSchema.superRefine((val, ctx) => options.post!(val, ctx))
    : rawObjectSchema;

  if (options.pre) {
    schema = z.preprocess(options.pre, schema);
  }

  const hooks: StructHooks = { pre: options.pre, post: options.post };

  const meta: StructMeta = {
    fields: resolvedFields,
    labels,
    description: options.description,
    schema,
    rawObjectSchema,
    hooks,
  };

  class GeneratedStruct {
    constructor(input: unknown) {
      const target = (new.target ?? GeneratedStruct) as StructConstructor;
      let data: Record<string, unknown>;
      try {
        data = target[STRUCT_META].schema.parse(input) as Record<string, unknown>;
      } catch (err) {
        if (err instanceof z.ZodError) {
          throw new ValidationError(err, target);
        }
        throw err;
      }
      Object.assign(this, data);
    }

    static [STRUCT_META] = meta;

    static parse(this: StructConstructor, input: unknown): unknown {
      return new this(input);
    }

    /**
     * Validates without throwing. Calls the schema directly (not the
     * constructor) to avoid double-validating, then bypasses the
     * (always-validating) constructor via `Object.create` + assign —
     * `instanceof` still holds since the prototype chain is preserved.
     */
    static safeParse(
      this: StructConstructor,
      input: unknown,
    ): { success: true; data: unknown } | { success: false; errors: ReturnType<typeof resolveIssueMessages> } {
      const result = this[STRUCT_META].schema.safeParse(input);
      if (!result.success) {
        return {
          success: false,
          errors: resolveIssueMessages(result.error, this, resolveLocale()),
        };
      }
      const instance = Object.create(this.prototype) as Record<string, unknown>;
      Object.assign(instance, result.data as Record<string, unknown>);
      return { success: true, data: instance };
    }

    toJSON(): Record<string, unknown> {
      return toJSON(this as unknown as Record<string, unknown>, STRUCT_META);
    }
  }

  return GeneratedStruct as unknown as StructConstructor;
}

export interface StructConstructor {
  new (input: unknown): unknown;
  [STRUCT_META]: StructMeta;
  parse(input: unknown): unknown;
  safeParse(
    input: unknown,
  ): { success: true; data: unknown } | { success: false; errors: unknown };
}
