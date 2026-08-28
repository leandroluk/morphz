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

/**
 * Derives a plain instance shape from a field-descriptor record —
 * `Define`/every primitive already correctly carries its own domain type
 * `T` per field (`FieldDescriptor<T>`); this is the piece that was never
 * propagated upward through `Struct`/derivation methods (struct-type-
 * inference retrofit).
 */
export type InferShape<Fields extends Record<string, FieldDescriptor<any>>> = {
  [K in keyof Fields]: Fields[K] extends FieldDescriptor<infer T> ? T : never;
};

/**
 * A `{ [K in keyof Shape]?: true }` selection object — Zod v4's own mask
 * shape, taken by `.omit()` / `.pick()` / `.partial()` (mask-object-derivation).
 * Exported so consumers can build reusable masks:
 * `const SERVER_FIELDS = { id: true, createdAt: true } satisfies Mask<UserShape>`.
 */
export type Mask<Shape> = { [K in keyof Shape]?: true };

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
 * Resolves the pending auto-derived `entityName`, once, on first
 * construction — `className` is only reliably known by now (`class X
 * extends Struct(...) {}` binds `X.name` synchronously before any `new
 * X()`/`X.parse()` could ever run). No-op if not pending. Mutates `meta` in
 * place — every other reader of `STRUCT_META` (i18n, toJSON, FieldOf,
 * Union, ...) reads it live, so the patch propagates for free.
 *
 * The default deriver (`default-entity-name`) is the identity —
 * `entityName` falls back to the bare class name so `#entityName` templates
 * work with zero config. A `config.labels.entityName` function overrides it;
 * an explicit `labels.entityName` on the `Struct` short-circuits this
 * entirely (never pending). Exported so `.omit()`/`.pick()`/`.partial()` can
 * pin the source's name before copying its labels onto a derived class.
 */
export function resolveEntityNameIfPending(meta: StructMeta, className: string): void {
  if (!meta.pendingEntityNameDerivation) return;
  const deriver = getConfig().labels?.entityName ?? ((ctx: { className: string }) => ctx.className);
  meta.pendingEntityNameDerivation = false;

  const entityName = deriver({ className });
  // Anonymous class / mangled-away name — nothing meaningful to interpolate.
  if (!entityName) return;
  if (entityName.length <= 2) {
    logStruct(
      "entityName %o looks minified for %o — set labels.entityName explicitly",
      entityName,
      className,
    );
  }
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
export function Struct<Fields extends Record<string, FieldDescriptor<any>>>(
  fields: Fields,
  options: StructOptions = {},
): StructConstructor<InferShape<Fields>> {
  const labels = options.labels ?? {};
  const delimiter = options.templateDelimiter ?? getConfig().template?.delimiter ?? "#";
  const { rawObjectSchema, resolvedFields } = buildRawObjectSchema(fields, labels, delimiter);
  const hooks: StructHooks = { pre: options.pre, post: options.post };
  // Pending unless the caller pinned `entityName` outright — the deriver
  // (config override or the identity default) runs lazily on first
  // construction, when the real subclass name is known (default-entity-name).
  const pendingEntityNameDerivation = !labels.entityName;

  return buildStructClass({
    rawObjectSchema,
    hooks,
    fields: resolvedFields,
    labels,
    description: options.description,
    pendingEntityNameDerivation,
    templateDelimiter: delimiter,
  }) as StructConstructor<InferShape<Fields>>;
}

/**
 * `Shape` is the ALREADY-COMPUTED plain instance shape (via `InferShape`),
 * not the raw field-descriptor record — this is what makes every
 * derivation method below a simple TS utility-type application
 * (`Omit`/`Pick`/`Partial`) instead of re-deriving from a field map each
 * time (struct-type-inference retrofit).
 *
 * `parse`/`safeParse`/`mock`/`mockMany` use the standard "polymorphic
 * `this`" TS idiom (`this: T extends new (...) => any`) so a subclass
 * (`AdminUser extends User` or `AdminUser extends User.extend(...)`)
 * gets back its OWN type from these static factory methods, not the base
 * `Shape` — this works because these are real `static` methods on a real
 * TS class (not stringified/dynamically typed).
 *
 * The runtime implementations (`struct.ts`'s constructor/`static parse`/
 * `safeParse`, `extend.ts`, `derive-variant.ts`, `mock.ts`) are UNCHANGED
 * by this — they keep operating on loosely-typed `Record<string,
 * FieldDescriptor>`/`unknown` internally and are attached via `as unknown
 * as` casts, same pattern already used throughout this file. Only this
 * PUBLIC interface (what a consumer's `tsc` actually checks against)
 * became precise.
 */
export interface StructConstructor<Shape = unknown> {
  new (input: unknown): Shape;
  [STRUCT_META]: StructMeta;
  parse<T extends abstract new (input: unknown) => unknown>(
    this: T,
    input: unknown,
  ): InstanceType<T>;
  safeParse<T extends abstract new (input: unknown) => unknown>(
    this: T,
    input: unknown,
  ):
    | { success: true; data: InstanceType<T> }
    | { success: false; errors: ReturnType<typeof resolveIssueMessages> };
  /**
   * Reads the FULL calling class's instance type via polymorphic `this`
   * (`InstanceType<T>`), not just `Shape` — `Shape` alone would lose the
   * calling class's own declared methods/getters (e.g. `isAdmin()`), since
   * real JS subclassing (this method's runtime behavior) inherits them but
   * `Shape` only ever tracked the field portion.
   */
  extend<
    T extends abstract new (input: unknown) => unknown,
    NewFields extends Record<string, FieldDescriptor<any>>,
  >(
    this: T,
    newFields: NewFields,
  ): StructConstructor<Omit<InstanceType<T>, keyof NewFields> & InferShape<NewFields>>;
  /**
   * Derive a DTO class with the masked fields removed. Takes Zod v4's own
   * mask shape — `.omit({ id: true, createdAt: true })` (mask-object-derivation;
   * the variadic / array forms were removed in 0.2).
   */
  omit<M extends Mask<Shape>>(mask: M): StructConstructor<Omit<Shape, keyof M>>;
  /** Derive a DTO class keeping ONLY the masked fields. `.pick({ name: true })`. */
  pick<M extends Mask<Shape>>(mask: M): StructConstructor<Pick<Shape, keyof M & keyof Shape>>;
  /** Every remaining field becomes optional. */
  partial(): StructConstructor<Partial<Shape>>;
  /**
   * Only the masked fields become optional, the rest keep their optionality.
   * `.partial({ name: true })` (Zod v4 selective `.partial(mask)`).
   */
  partial<M extends Mask<Shape>>(
    mask: M,
  ): StructConstructor<Omit<Shape, keyof M> & Partial<Pick<Shape, keyof M & keyof Shape>>>;
  mock<T extends abstract new (input: unknown) => unknown>(
    this: T,
    overrides?: Partial<InstanceType<T>>,
  ): InstanceType<T>;
  mockMany<T extends abstract new (input: unknown) => unknown>(
    this: T,
    count: number,
    factory?: (index: number) => Partial<InstanceType<T>>,
  ): InstanceType<T>[];
}
