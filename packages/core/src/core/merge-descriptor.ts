import type { FieldDescriptor, FieldDescriptorMeta, MessageMap } from "./field-descriptor.js";

function mergeMessage(base?: MessageMap, overrides?: MessageMap): MessageMap | undefined {
  if (!base && !overrides) return undefined;
  const result: MessageMap = base ? { ...base } : {};
  for (const [code, value] of Object.entries(overrides ?? {})) {
    const baseValue = (base as Record<string, unknown> | undefined)?.[code];
    if (
      code === "invalid_format" &&
      typeof baseValue === "object" &&
      baseValue !== null &&
      typeof value === "object" &&
      value !== null
    ) {
      // both sides use the per-format nested shape -> merge one level deep
      (result as Record<string, unknown>)[code] = {
        ...(baseValue as object),
        ...(value as object),
      };
    } else {
      (result as Record<string, unknown>)[code] = value;
    }
  }
  return result;
}

/**
 * Shallow-overwrite for scalar meta keys, deep merge (per issue code, and
 * per `format` under `invalid_format`) for `message`. `zodSchema` is never
 * merged here — callers rebuild it separately (regex/refine chaining).
 */
export function mergeDescriptor<T>(
  base: FieldDescriptor<T>,
  overrides?: Partial<FieldDescriptorMeta<T>> & { zodSchema?: FieldDescriptor<T>["zodSchema"] },
): FieldDescriptor<T> {
  if (!overrides) return base;

  const { message, zodSchema, ...rest } = overrides;

  const mergedMeta: FieldDescriptorMeta<T> = {
    ...base.meta,
    ...rest,
    message: mergeMessage(base.meta.message, message),
  };

  return {
    zodSchema: zodSchema ?? base.zodSchema,
    meta: mergedMeta,
    itemDescriptor: base.itemDescriptor,
    targetStruct: base.targetStruct,
  };
}
