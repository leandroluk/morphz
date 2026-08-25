import { z } from "zod";
import type { FieldDescriptor } from "./field-descriptor.js";

interface ZodInternalsDef {
  type: string;
  shape?: Record<string, unknown>;
  values?: unknown[];
}

function getDef(schema: unknown): ZodInternalsDef | undefined {
  return (schema as { _zod?: { def?: ZodInternalsDef } })._zod?.def;
}

/** True when the descriptor's zodSchema is a bare ZodObject (raw shape, no pre/post/transform wrapping). */
function isZodObject(schema: unknown): schema is z.ZodObject {
  return getDef(schema)?.type === "object";
}

/**
 * Finds a key present in every member's raw object shape where each
 * member's value at that key is a z.literal with a distinct value. Zero
 * or ambiguous candidates -> null (falls back to plain union).
 */
function detectDiscriminatorKey(objectMembers: z.ZodObject[]): string | null {
  if (objectMembers.length === 0) return null;

  const firstShape = getDef(objectMembers[0])?.shape ?? {};
  const candidateKeys = Object.keys(firstShape);

  for (const key of candidateKeys) {
    const seenValues = new Set<unknown>();
    let isValidCandidate = true;

    for (const member of objectMembers) {
      const shape = getDef(member)?.shape ?? {};
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
 * morphz-specific heuristic. All members Struct-produced object schemas
 * (checked against the bare object shape, not the full pre/post/transform
 * pipeline) sharing one common literal-valued key -> z.discriminatedUnion
 * with an EXPLICIT key. Anything that doesn't structurally qualify (a bare
 * Literal, a missing/non-distinct key) -> plain z.union, same call Zod
 * itself would make with the same member set.
 */
export function Union<T = unknown>(
  members: FieldDescriptor[],
  _options?: unknown,
): FieldDescriptor<T> {
  const schemas = members.map((m) => m.zodSchema);
  const objectMembers = schemas.filter(isZodObject);
  const allAreObjects = objectMembers.length === schemas.length && schemas.length > 0;

  const sharedKey = allAreObjects ? detectDiscriminatorKey(objectMembers) : null;

  const zodSchema = sharedKey
    ? z.discriminatedUnion(sharedKey, objectMembers as [z.ZodObject, ...z.ZodObject[]])
    : z.union(schemas as [z.ZodType, z.ZodType, ...z.ZodType[]]);

  return {
    zodSchema: zodSchema as unknown as FieldDescriptor<T>["zodSchema"],
    meta: {},
  };
}
