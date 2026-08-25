import { describe, expect, it } from 'vitest'
import { Timestamp } from '../../src/primitives/timestamp.js'

describe('Timestamp', () => {
  it('carries a default that stamps close to now (applied later by Struct, not here)', () => {
    const descriptor = Timestamp()
    expect(typeof descriptor.meta.default).toBe('function')
    const stamped = (descriptor.meta.default as () => Date)()
    expect(stamped).toBeInstanceOf(Date)
    expect(Math.abs(stamped.getTime() - Date.now())).toBeLessThan(1000)
  })

  it('an explicit default override replaces the "now" default', () => {
    const fixed = new Date('2020-01-01T00:00:00Z')
    const descriptor = Timestamp({ default: () => fixed })
    expect((descriptor.meta.default as () => Date)()).toBe(fixed)
  })

  it('still uses the SAME DateTime codec for actual parsing (Z-strict ISO string in, Date out)', () => {
    const descriptor = Timestamp()
    const result = descriptor.zodSchema.parse('2024-01-01T00:00:00Z')
    expect(result).toBeInstanceOf(Date)
  })
})
