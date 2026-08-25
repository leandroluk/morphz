import type { FieldDescriptor, FieldDescriptorFactory, FieldDescriptorMeta } from './field-descriptor.js'
import { mergeDescriptor } from './merge-descriptor.js'
import { toZodRefine, type MorphzRefine } from './refine-adapter.js'

export interface DefineOptions<T, Opts = undefined> extends Partial<FieldDescriptorMeta<T>> {
  regex?: RegExp
  refine?: MorphzRefine<T, Opts>
}

type BaseTypeArg<T, Opts> = FieldDescriptorFactory<T, unknown> | FieldDescriptor<T>

/**
 * Normalizes BaseType (call if it's still a bare factory, use as-is if
 * it's already an invoked descriptor), merges `options` onto it, and
 * returns a specialized factory. `refine`'s runtime opts are bound at
 * `specialized(instanceOverrides)` time, not here — Define-time only
 * captures the refine FUNCTION.
 */
export function Define<T, Opts = undefined>(
  base: BaseTypeArg<T, Opts>,
  options: DefineOptions<T, Opts> = {},
): FieldDescriptorFactory<T, Partial<DefineOptions<T, Opts>>> {
  const baseDescriptor: FieldDescriptor<T> = typeof base === 'function' ? base() : base

  const { regex, refine, ...meta } = options

  let mergedSchema = baseDescriptor.zodSchema
  if (regex) {
    mergedSchema = (mergedSchema as unknown as { regex: (r: RegExp) => typeof mergedSchema }).regex(regex)
  }

  const merged = mergeDescriptor(baseDescriptor, { ...meta, zodSchema: mergedSchema })

  return function specialized(instanceOverrides?: Partial<DefineOptions<T, Opts>>): FieldDescriptor<T> {
    const { regex: instRegex, refine: instRefine, ...instMeta } = instanceOverrides ?? {}

    let schema = merged.zodSchema
    if (instRegex) {
      schema = (schema as unknown as { regex: (r: RegExp) => typeof schema }).regex(instRegex)
    }

    const effectiveRefine = instRefine ?? refine
    if (effectiveRefine) {
      const { check, params } = toZodRefine(effectiveRefine, instanceOverrides as Opts | undefined)
      schema = (
        schema as unknown as {
          refine: (c: (v: T) => boolean, p: { error: (issue: { input: unknown }) => string }) => typeof schema
        }
      ).refine(check, params)
    }

    return mergeDescriptor(merged, { ...instMeta, zodSchema: schema })
  }
}
