import { z } from "zod";
import type {
  FieldDescriptor,
  FieldDescriptorFactory,
  FieldDescriptorMeta,
} from "../core/field-descriptor.js";

export interface ListOptions<T> extends Partial<FieldDescriptorMeta<T[]>> {
  min?: number;
  max?: number;
}

export function List<T>(
  itemType: FieldDescriptorFactory<T> | FieldDescriptor<T>,
  options: ListOptions<T> = {},
): FieldDescriptor<T[]> {
  const itemDescriptor = typeof itemType === "function" ? itemType() : itemType;
  const { min, max, ...meta } = options;
  let schema = z.array(itemDescriptor.zodSchema);
  if (min !== undefined) schema = schema.min(min);
  if (max !== undefined) schema = schema.max(max);
  return { zodSchema: schema, meta, itemDescriptor: itemDescriptor as FieldDescriptor<unknown> };
}
