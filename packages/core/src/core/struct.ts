import { z } from "zod";
import type { FieldDescriptor } from "./field-descriptor.js";
import { resolveFieldTemplates } from "./template.js";
import { STRUCT_META, type StructHooks, type StructMeta } from "./struct-meta.js";
import { ValidationError } from "./validation-error.js";
import { resolveIssueMessages } from "./i18n/resolve-issues.js";
import { resolveLocale } from "./i18n/resolve-locale.js";
import { toJSON } from "./to-json.js";
import { toMaskedJSON } from "./to-masked-json.js";
import { attachExtend } from "./extend.js";
import { attachDeriveVariant } from "./derive-variant.js";
import { attachMock } from "./mock.js";
import { assignFields } from "./property-interceptor.js";
import { getConfig } from "./config.js";
import { logLifecycle, logParse, logStruct } from "./debug.js";

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

export interface BuildStructClassParams {
  rawObjectSchema: z.ZodObject;
  hooks: StructHooks;
  fields: Record<string, FieldDescriptor>;
  labels: Record<string, string>;
  description?: string;
  /**
   * When set, the result is a REAL `class extends extendsClass` (superset
   * derivation — `.extend()`) so `instanceof` holds transitively through
   * the whole chain, standard JS semantics, no extra constructor/statics
   * needed (all inherited). When absent, a fully self-contained,
   * INDEPENDENT class is built (base `Struct()`, and `.omit()`/`.pick()`/
   * `.partial()`'s subset/reshape derivations) — `instanceof` the source
   * deliberately does NOT hold for that branch.
   */
  extendsClass?: StructConstructor;
  pendingEntityNameDerivation?: boolean;
  templateDelimiter?: string;
}

/**
 * Resolves the pending auto-derived `entityName` (config-gaps), once, on
 * first construction — `className` is only reliably known by now (`class X
 * extends Struct(...) {}` binds `X.name` synchronously before any `new
 * X()`/`X.parse()` could ever run). No-op if not pending. Mutates `meta` in
 * place — every other reader of `STRUCT_META` (i18n, toJSON, FieldOf,
 * Union, ...) reads it live, so the patch propagates for free.
 */
function resolveEntityNameIfPending(meta: StructMeta, className: string): void {
  if (!meta.pendingEntityNameDerivation) return;
  const deriver = getConfig().labels?.entityName;
  meta.pendingEntityNameDerivation = false;
  if (typeof deriver !== "function") return;

  const entityName = deriver({ className });
  const newLabels = { ...meta.labels, entityName };
  const delimiter = meta.templateDelimiter ?? "#";
  const newFields: Record<string, FieldDescriptor> = {};
  for (const [key, descriptor] of Object.entries(meta.fields)) {
    newFields[key] = {
      ...descriptor,
      meta: resolveFieldTemplates(descriptor.meta, newLabels, delimiter),
    };
  }
  meta.labels = newLabels;
  meta.fields = newFields;
  logStruct("lazily resolved entityName=%s for %s", entityName, className);
}

/**
 * Shared class-building core. `Struct()` is a thin wrapper calling this
 * with `extendsClass` absent. `.extend()` calls it WITH `extendsClass` set
 * (real subclassing). `.omit()`/`.pick()`/`.partial()` call it without,
 * same as `Struct()` itself (independent class, no instanceof source).
 */
export function buildStructClass(params: BuildStructClassParams): StructConstructor {
  const {
    rawObjectSchema,
    hooks,
    fields,
    labels,
    description,
    extendsClass,
    pendingEntityNameDerivation,
    templateDelimiter,
  } = params;

  let schema: z.ZodType = hooks.post
    ? rawObjectSchema.superRefine((val, ctx) => {
        logLifecycle("running post hook");
        hooks.post!(val, ctx);
      })
    : rawObjectSchema;

  if (hooks.pre) {
    schema = z.preprocess((val) => {
      logLifecycle("running pre hook");
      return hooks.pre!(val);
    }, schema);
  }

  const meta: StructMeta = {
    fields,
    labels,
    description,
    schema,
    rawObjectSchema,
    hooks,
    pendingEntityNameDerivation,
    templateDelimiter,
  };
  logStruct(
    "compiled Struct with %d field(s), pre=%s post=%s",
    Object.keys(fields).length,
    Boolean(hooks.pre),
    Boolean(hooks.post),
  );

  if (extendsClass) {
    // Real JS subclassing: constructor, static parse/safeParse, and
    // .toJSON() are all inherited unchanged from extendsClass's prototype
    // chain — `new.target`/`this` inside them still resolve to WHICHEVER
    // class was actually instantiated/called on, so polymorphism keeps
    // working with zero extra code here. Only STRUCT_META differs per class.
    class GeneratedSubStruct extends (extendsClass as unknown as new (input: unknown) => object) {
      static [STRUCT_META] = meta;
    }
    return attachDerivationMethods(GeneratedSubStruct as unknown as StructConstructor);
  }

  class GeneratedStruct {
    constructor(input: unknown) {
      const target = (new.target ?? GeneratedStruct) as StructConstructor;
      resolveEntityNameIfPending(target[STRUCT_META], target.name);
      logParse("parsing input for %s", target.name);
      let data: Record<string, unknown>;
      try {
        data = target[STRUCT_META].schema.parse(input) as Record<string, unknown>;
      } catch (err) {
        if (err instanceof z.ZodError) {
          logParse("parse failed for %s with %d issue(s)", target.name, err.issues.length);
          throw new ValidationError(err, target);
        }
        throw err;
      }
      assignFields(this, data, target[STRUCT_META]);
      logLifecycle("created instance of %s", target.name);
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
    ):
      | { success: true; data: unknown }
      | { success: false; errors: ReturnType<typeof resolveIssueMessages> } {
      resolveEntityNameIfPending(this[STRUCT_META], this.name);
      const result = this[STRUCT_META].schema.safeParse(input);
      if (!result.success) {
        logParse("safeParse failed for %s with %d issue(s)", this.name, result.error.issues.length);
        return {
          success: false,
          errors: resolveIssueMessages(result.error, this, resolveLocale()),
        };
      }
      const instance = Object.create(this.prototype) as Record<string, unknown>;
      assignFields(instance, result.data as Record<string, unknown>, this[STRUCT_META]);
      logParse("safeParse succeeded for %s", this.name);
      logLifecycle("created instance of %s", this.name);
      return { success: true, data: instance };
    }

    toJSON(): Record<string, unknown> {
      return toJSON(this as unknown as Record<string, unknown>, STRUCT_META);
    }

    toMaskedJSON(): Record<string, unknown> {
      return toMaskedJSON(this as unknown as Record<string, unknown>, STRUCT_META);
    }
  }

  return attachDerivationMethods(GeneratedStruct as unknown as StructConstructor);
}

function attachDerivationMethods(klass: StructConstructor): StructConstructor {
  attachExtend(klass);
  attachDeriveVariant(klass);
  attachMock(klass);
  return klass;
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
  const delimiter = options.templateDelimiter ?? getConfig().template?.delimiter ?? "#";
  const { rawObjectSchema, resolvedFields } = buildRawObjectSchema(fields, labels, delimiter);
  const hooks: StructHooks = { pre: options.pre, post: options.post };
  const entityNameDeriver = getConfig().labels?.entityName;
  const pendingEntityNameDerivation = !labels.entityName && typeof entityNameDeriver === "function";

  return buildStructClass({
    rawObjectSchema,
    hooks,
    fields: resolvedFields,
    labels,
    description: options.description,
    pendingEntityNameDerivation,
    templateDelimiter: delimiter,
  });
}

export interface StructConstructor {
  // NOTE: return type is `object`, not a per-field-inferred shape — real
  // per-field type inference (mapping `Record<string, FieldDescriptor<T>>`
  // to a concrete instance type) is a substantial, separate TS-generics
  // problem, out of scope for the jsdoc-generation fix that widened this
  // from `unknown` (which made `class X extends Struct(...) {}` fail to
  // typecheck for EVERY consumer with TS2509 — `tests/` was never covered
  // by `tsc --noEmit`'s `include: ["src"]`, so this was never caught).
  new (input: unknown): object;
  [STRUCT_META]: StructMeta;
  parse(input: unknown): unknown;
  safeParse(input: unknown): { success: true; data: unknown } | { success: false; errors: unknown };
  extend(newFields: Record<string, FieldDescriptor>): StructConstructor;
  omit(...names: string[] | [string[]]): StructConstructor;
  pick(...names: string[] | [string[]]): StructConstructor;
  partial(): StructConstructor;
  mock(overrides?: Record<string, unknown>): unknown;
  mockMany(count: number, factory?: (index: number) => Record<string, unknown>): unknown[];
}
