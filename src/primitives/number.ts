import { z } from 'zod'
import type { FieldDescriptor, FieldDescriptorMeta } from '../core/field-descriptor.js'

export interface NumberOptions extends Partial<FieldDescriptorMeta<number>> {
  int?: boolean
  min?: number
  max?: number
}

export function Number(options: NumberOptions = {}): FieldDescriptor<number> {
  const { int, min, max, ...meta } = options
  let schema = z.number()
  if (int) schema = schema.int()
  if (min !== undefined) schema = schema.min(min)
  if (max !== undefined) schema = schema.max(max)
  return { zodSchema: schema, meta }
}
