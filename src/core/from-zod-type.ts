import type { z } from 'zod'
import type { FieldDescriptor } from './field-descriptor.js'

/** Wraps an arbitrary Zod schema into a FieldDescriptor (empty meta). */
export function FromZodType<T>(schema: z.ZodType<T>): FieldDescriptor<T> {
  return { zodSchema: schema, meta: {} }
}
