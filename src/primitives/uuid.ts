import { z } from 'zod'
import type { FieldDescriptor, FieldDescriptorMeta } from '../core/field-descriptor.js'

export function Uuid(options: Partial<FieldDescriptorMeta<string>> = {}): FieldDescriptor<string> {
  return { zodSchema: z.uuid(), meta: options }
}
