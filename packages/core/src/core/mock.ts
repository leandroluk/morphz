import RandExp from "randexp";
import type { FieldDescriptor } from "./field-descriptor.js";
import { STRUCT_META, type StructConstructorLike } from "./struct-meta.js";
import type { StructConstructor } from "./struct.js";

interface ZodCheckDef {
  check?: string;
  format?: string;
  pattern?: RegExp;
  value?: number;
  minimum?: number;
  maximum?: number;
}

interface ZodDef {
  type: string;
  format?: string;
  innerType?: unknown;
  in?: unknown;
  out?: unknown;
  entries?: Record<string, unknown>;
  values?: unknown[];
  options?: unknown[];
  checks?: { _zod?: { def?: ZodCheckDef } }[];
}

function getDef(schema: unknown): ZodDef | undefined {
  return (schema as { _zod?: { def?: ZodDef } })._zod?.def;
}

function findCheck(schema: unknown, checkName: string): ZodCheckDef | undefined {
  for (const c of getDef(schema)?.checks ?? []) {
    if (c._zod?.def?.check === checkName) return c._zod.def;
  }
  return undefined;
}

const CANONICAL_FORMAT_EXAMPLES: Record<string, () => unknown> = {
  email: () => "user@example.com",
  uuid: () => crypto.randomUUID(),
  guid: () => crypto.randomUUID(),
  ipv4: () => "192.0.2.1",
  ipv6: () => "2001:db8::1",
  url: () => "https://example.com",
  datetime: () => new Date().toISOString(),
  date: () => new Date().toISOString().slice(0, 10),
  time: () => new Date().toISOString().slice(11, 19),
};

function mockError(fieldName: string): Error {
  return new Error(
    `morphz .mock(): cannot synthesize a value for field "${fieldName}" — no examples, ` +
      `default, regex, or recognized primitive shape found. Declare \`examples\` on this ` +
      `field's Define()/primitive to make it mockable.`,
  );
}

/** Best-effort synthesis from a bare Zod schema's own shape (no FieldDescriptor context). */
function synthesizePrimitive(schema: unknown, fieldName: string): unknown {
  const def = getDef(schema);
  if (!def) throw mockError(fieldName);

  switch (def.type) {
    case "optional":
    case "nullable":
      return synthesizePrimitive(def.innerType, fieldName);
    case "pipe": {
      // Two distinct pipe shapes share `type: "pipe"` in Zod v4:
      // - a real bidirectional codec (z.codec, e.g. DateTime/BigInt): `in`
      //   is a genuine wire-format schema — synthesize FROM it, since
      //   that's what raw input to .parse() must actually satisfy.
      // - a preprocess pipe (z.preprocess, e.g. Boolean's coercion): `in`
      //   is an opaque `transform` schema (just the preprocess function,
      //   no shape to synthesize from) — synthesize from `out` instead,
      //   since preprocess's input isn't format-constrained the way a
      //   codec's wire side is.
      const inDef = getDef(def.in);
      if (inDef && inDef.type !== "transform") return synthesizePrimitive(def.in, fieldName);
      if (def.out) return synthesizePrimitive(def.out, fieldName);
      throw mockError(fieldName);
    }
    case "string": {
      const topExample = def.format ? CANONICAL_FORMAT_EXAMPLES[def.format] : undefined;
      if (topExample) return topExample();

      const formatCheck = findCheck(schema, "string_format");
      const checkExample = formatCheck?.format
        ? CANONICAL_FORMAT_EXAMPLES[formatCheck.format]
        : undefined;
      if (checkExample) return checkExample();

      if (formatCheck?.pattern) {
        return new RandExp(formatCheck.pattern).gen();
      }
      return "mock-string";
    }
    case "number": {
      const min = findCheck(schema, "greater_than")?.value;
      const max = findCheck(schema, "less_than")?.value;
      const lo = min ?? 0;
      const hi = max ?? lo + 100;
      return Math.round((lo + hi) / 2);
    }
    case "boolean":
      return true;
    case "enum": {
      const values = def.entries ? Object.values(def.entries) : (def.values ?? []);
      if (values.length === 0) throw mockError(fieldName);
      return values[0];
    }
    case "literal":
      if (!def.values?.length) throw mockError(fieldName);
      return def.values[0];
    case "union":
      if (def.options?.[0]) return synthesizePrimitive(def.options[0], fieldName);
      throw mockError(fieldName);
    default:
      throw mockError(fieldName);
  }
}

interface MockContext {
  /** Struct classes currently being synthesized in this call chain — cycle guard. */
  inProgress: Set<unknown>;
  depth: number;
}

const MAX_MOCK_DEPTH = 5;

function synthesizeField(
  descriptor: FieldDescriptor,
  fieldName: string,
  ctx: MockContext,
): unknown {
  // `examples`/`default` are DOMAIN-typed (FieldDescriptorMeta<T>'s own
  // generic), but the value synthesized here is fed as RAW constructor
  // input, which for a codec field must be WIRE-typed (it goes through
  // decode). `meta.encode` (domain -> wire) already exists for exactly
  // this direction (used by toJSON()) — reuse it here so a codec field's
  // declared `examples`/`default` doesn't silently hand a domain object
  // (a bigint, a Decimal instance, a Date) to a decoder expecting a string.
  if (descriptor.meta.examples && descriptor.meta.examples.length > 0) {
    const example = descriptor.meta.examples[0];
    return descriptor.meta.encode ? descriptor.meta.encode(example) : example;
  }
  if (descriptor.meta.default !== undefined) {
    const def = descriptor.meta.default;
    const value = typeof def === "function" ? (def as () => unknown)() : def;
    return descriptor.meta.encode ? descriptor.meta.encode(value) : value;
  }

  if (descriptor.targetStruct) {
    const Target = descriptor.targetStruct() as StructConstructorLike;
    if (ctx.inProgress.has(Target) || ctx.depth >= MAX_MOCK_DEPTH) {
      const acceptsUndefined = descriptor.zodSchema.safeParse(undefined).success;
      if (acceptsUndefined) return undefined;
      throw new Error(
        `morphz .mock(): circular or too-deep Ref/Embed chain synthesizing field ` +
          `"${fieldName}" (target has no way to terminate) — make this field ` +
          `Optional(...) so mock() can stop here, or pass an explicit override.`,
      );
    }
    ctx.inProgress.add(Target);
    const instance = mockInstance(Target, {}, { inProgress: ctx.inProgress, depth: ctx.depth + 1 });
    ctx.inProgress.delete(Target);
    return instance;
  }

  if (descriptor.itemDescriptor) {
    const count = findCheck(descriptor.zodSchema, "min_length")?.minimum ?? 0;
    const items: unknown[] = [];
    for (let i = 0; i < count; i++) {
      items.push(synthesizeField(descriptor.itemDescriptor, `${fieldName}[${i}]`, ctx));
    }
    return items;
  }

  return synthesizePrimitive(descriptor.zodSchema, fieldName);
}

function mockInstance<T>(
  StructClassCtor: StructConstructorLike<T>,
  overrides: Record<string, unknown>,
  ctx: MockContext,
): T {
  const meta = StructClassCtor[STRUCT_META];
  const data: Record<string, unknown> = {};
  for (const [key, descriptor] of Object.entries(meta.fields)) {
    data[key] = key in overrides ? overrides[key] : synthesizeField(descriptor, key, ctx);
  }
  return new StructClassCtor(data as never);
}

function mock(this: StructConstructor, overrides: Record<string, unknown> = {}): unknown {
  return mockInstance(this as unknown as StructConstructorLike, overrides, {
    inProgress: new Set([this]),
    depth: 0,
  });
}

function mockMany(
  this: StructConstructor,
  count: number,
  factory?: (index: number) => Record<string, unknown>,
): unknown[] {
  const results: unknown[] = [];
  for (let i = 0; i < count; i++) {
    results.push(mock.call(this, factory?.(i) ?? {}));
  }
  return results;
}

export function attachMock(klass: StructConstructor): void {
  (klass as unknown as { mock: typeof mock }).mock = mock;
  (klass as unknown as { mockMany: typeof mockMany }).mockMany = mockMany;
}
