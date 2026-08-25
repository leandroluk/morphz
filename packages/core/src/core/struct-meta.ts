import type { z } from "zod";
import type { FieldDescriptor } from "./field-descriptor.js";

export const STRUCT_META: unique symbol = Symbol("morphz.structMeta");

export interface StructHooks {
  pre?: (val: unknown) => unknown;
  post?: (val: unknown, ctx: unknown) => void;
}

export interface StructMeta {
  /** Resolved field descriptors (description templates already substituted). */
  fields: Record<string, FieldDescriptor>;
  labels: Record<string, string>;
  description?: string;
  /** pre -> object -> post. Validation only — NEVER instantiates a class. */
  schema: z.ZodType;
  /** Same pipeline, WITHOUT pre/post — bare object shape, for FieldOf/Union to read. */
  rawObjectSchema: z.ZodObject;
  hooks: StructHooks;
  /**
   * `true` only when `labels.entityName` was omitted AND a global
   * `config.labels.entityName` derivation function exists (config-gaps).
   * Resolved LAZILY on first construction (the class name isn't known at
   * `Struct()` call time) — mutated to `false` after resolving once,
   * memoized. Absent/`false` for the common case (explicit `entityName`),
   * zero extra cost.
   */
  pendingEntityNameDerivation?: boolean;
  /** Delimiter used for template resolution — needed to re-run it lazily. */
  templateDelimiter?: string;
}

export interface StructClass {
  new (input: unknown): unknown;
  [STRUCT_META]: StructMeta;
}

/** Generic constructor shape shared by Embed()/Ref()/FieldOf() consumers. */
export interface StructConstructorLike<T = unknown> {
  new (input: unknown): T;
  [STRUCT_META]: StructMeta;
}
