import { z } from "zod";
import type { FieldDescriptor } from "./field-descriptor.js";
import { STRUCT_META, type StructClass } from "./struct-meta.js";

interface ZodInternalsDef {
  type: string;
  shape?: Record<string, unknown>;
  values?: unknown[];
}

function getDef(schema: unknown): ZodInternalsDef | undefined {
  return (schema as { _zod?: { def?: ZodInternalsDef } })._zod?.def;
}

/**
 * The raw object shape to inspect for discriminator detection. A bare
 * ZodObject member (e.g. FromZodType(z.object({...}))) is used as-is. An
 * Embed()/Ref() member's `zodSchema` is a .transform()-wrapped pipe (see
 * struct-entities/entity-relationships design — STRUCT_META.schema is
 * validation-only, Embed/Ref append their own instantiation transform), so
 * its `targetStruct` is followed to the underlying Struct class's
 * STRUCT_META.rawObjectSchema instead — the real object shape hiding
 * behind the pipe.
 */
function rawObjectShapeOf(member: FieldDescriptor): unknown {
  const target = member.targetStruct?.() as StructClass | undefined;
  if (target) return target[STRUCT_META].rawObjectSchema;
  return member.zodSchema;
}

/** True when a schema's underlying shape is a bare ZodObject. */
function isZodObject(schema: unknown): schema is z.ZodObject {
  return getDef(schema)?.type === "object";
}

/**
 * Finds a key present in every member's raw object shape where each
 * member's value at that key is a z.literal with a distinct value. Zero
 * or ambiguous candidates -> null (falls back to plain union).
 */
function detectDiscriminatorKey(objectShapes: z.ZodObject[]): string | null {
  if (objectShapes.length === 0) return null;

  const firstShape = getDef(objectShapes[0])?.shape ?? {};
  const candidateKeys = Object.keys(firstShape);

  for (const key of candidateKeys) {
    const seenValues = new Set<unknown>();
    let isValidCandidate = true;

    for (const shapeSchema of objectShapes) {
      const shape = getDef(shapeSchema)?.shape ?? {};
      const fieldSchema = shape[key];
      const fieldDef = fieldSchema ? getDef(fieldSchema) : undefined;

      if (
        !fieldDef ||
        fieldDef.type !== "literal" ||
        !fieldDef.values ||
        fieldDef.values.length !== 1
      ) {
        isValidCandidate = false;
        break;
      }

      const literalValue = fieldDef.values[0];
      if (seenValues.has(literalValue)) {
        isValidCandidate = false;
        break;
      }
      seenValues.add(literalValue);
    }

    if (isValidCandidate) return key;
  }

  return null;
}

/**
 * Mirrors Zod's OWN applicability rule for discriminatedUnion exactly — no
 * morphz-specific heuristic. All members whose underlying object shape
 * (bare ZodObject, or an Embed/Ref member's target's rawObjectSchema)
 * shares one common literal-valued key -> z.discriminatedUnion, built from
 * the members' ORIGINAL zodSchema (Embed/Ref's .transform()-wrapped pipe
 * included — confirmed via probing the installed zod v4: $ZodPipe forwards
 * `propValues` from its `in` side, so z.discriminatedUnion accepts and
 * correctly parses/transforms pipe-wrapped members, still producing real
 * Struct instances for Embed/Ref members). Anything that doesn't
 * structurally qualify (a bare Literal, a missing/non-distinct key) ->
 * plain z.union, same call Zod itself would make with the same member set.
 */
export function Union<T = unknown>(
  members: FieldDescriptor[],
  _options?: unknown,
): FieldDescriptor<T> {
  const schemas = members.map((m) => m.zodSchema);
  const rawShapes = members.map(rawObjectShapeOf);
  const objectShapes = rawShapes.filter(isZodObject);
  const allAreObjects = objectShapes.length === rawShapes.length && rawShapes.length > 0;

  const sharedKey = allAreObjects ? detectDiscriminatorKey(objectShapes) : null;

  const zodSchema = sharedKey
    ? z.discriminatedUnion(
        sharedKey,
        schemas as unknown as [z.core.$ZodTypeDiscriminable, ...z.core.$ZodTypeDiscriminable[]],
      )
    : z.union(schemas as [z.ZodType, z.ZodType, ...z.ZodType[]]);

  return {
    zodSchema: zodSchema as unknown as FieldDescriptor<T>["zodSchema"],
    meta: {},
  };
}
