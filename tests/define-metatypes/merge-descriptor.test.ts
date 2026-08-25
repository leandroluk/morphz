import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { mergeDescriptor } from '../../src/core/merge-descriptor.js'
import type { FieldDescriptor } from '../../src/core/field-descriptor.js'

function textDescriptor(): FieldDescriptor<string> {
  return { zodSchema: z.string(), meta: {} }
}

describe('mergeDescriptor', () => {
  it('shallow-overwrites scalar meta keys', () => {
    const base = mergeDescriptor(textDescriptor(), { description: 'base', immutable: true })
    const merged = mergeDescriptor(base, { description: 'overridden' })
    expect(merged.meta.description).toBe('overridden')
    expect(merged.meta.immutable).toBe(true) // untouched key survives
  })

  it('deep-merges message per issue code — overriding one code does not drop another', () => {
    const base = mergeDescriptor(textDescriptor(), {
      message: { invalid_type: 'must be text', custom: 'bad value' },
    })
    const merged = mergeDescriptor(base, { message: { custom: 'overridden custom' } })
    expect(merged.meta.message?.invalid_type).toBe('must be text')
    expect(merged.meta.message?.custom).toBe('overridden custom')
  })

  it('deep-merges invalid_format sub-key without dropping sibling formats', () => {
    const base = mergeDescriptor(textDescriptor(), {
      message: { invalid_format: { regex: 'bad regex', email: 'bad email' } },
    })
    const merged = mergeDescriptor(base, {
      message: { invalid_format: { regex: 'overridden regex' } },
    })
    const fmt = merged.meta.message?.invalid_format as Record<string, string>
    expect(fmt.regex).toBe('overridden regex')
    expect(fmt.email).toBe('bad email')
  })

  it('returns base unchanged when overrides is undefined', () => {
    const base = mergeDescriptor(textDescriptor(), { description: 'x' })
    expect(mergeDescriptor(base)).toBe(base)
  })

  it('preserves itemDescriptor/targetStruct through merges', () => {
    const item = textDescriptor()
    const base: FieldDescriptor<string[]> = { zodSchema: z.array(z.string()), meta: {}, itemDescriptor: item }
    const merged = mergeDescriptor(base, { description: 'list' })
    expect(merged.itemDescriptor).toBe(item)
  })
})
