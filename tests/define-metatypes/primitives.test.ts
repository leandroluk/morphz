import { describe, expect, it } from 'vitest'
import { Text } from '../../src/primitives/text.js'
import { Number } from '../../src/primitives/number.js'
import { Uuid } from '../../src/primitives/uuid.js'
import { Email } from '../../src/primitives/email.js'
import { Password } from '../../src/primitives/password.js'
import { Ip } from '../../src/primitives/ip.js'
import { Enum } from '../../src/primitives/enum.js'
import { Version } from '../../src/primitives/version.js'
import { Nullable } from '../../src/primitives/nullable.js'
import { Optional } from '../../src/primitives/optional.js'
import { List } from '../../src/primitives/list.js'
import { FromZodType } from '../../src/core/from-zod-type.js'
import { z } from 'zod'

describe('primitives', () => {
  it('Text: valid/invalid', () => {
    const t = Text({ min: 2, max: 5 })
    expect(t.zodSchema.safeParse('abc').success).toBe(true)
    expect(t.zodSchema.safeParse('a').success).toBe(false)
  })

  it('Number: valid/invalid', () => {
    const n = Number({ int: true, min: 0 })
    expect(n.zodSchema.safeParse(5).success).toBe(true)
    expect(n.zodSchema.safeParse(-1).success).toBe(false)
    expect(n.zodSchema.safeParse(1.5).success).toBe(false)
  })

  it('Uuid: valid/invalid', () => {
    const u = Uuid()
    expect(u.zodSchema.safeParse('123e4567-e89b-12d3-a456-426614174000').success).toBe(true)
    expect(u.zodSchema.safeParse('not-a-uuid').success).toBe(false)
  })

  it('Email: valid/invalid', () => {
    const e = Email()
    expect(e.zodSchema.safeParse('a@b.com').success).toBe(true)
    expect(e.zodSchema.safeParse('nope').success).toBe(false)
  })

  it('Password: valid/invalid, writeOnly meta round-trips', () => {
    const p = Password({ min: 8, writeOnly: true })
    expect(p.zodSchema.safeParse('longenough').success).toBe(true)
    expect(p.zodSchema.safeParse('short').success).toBe(false)
    expect(p.meta.writeOnly).toBe(true)
  })

  it('Ip: v4/v6/either', () => {
    expect(Ip({ version: 'v4' }).zodSchema.safeParse('1.2.3.4').success).toBe(true)
    expect(Ip({ version: 'v4' }).zodSchema.safeParse('::1').success).toBe(false)
    expect(Ip({ version: 'v6' }).zodSchema.safeParse('::1').success).toBe(true)
    expect(Ip().zodSchema.safeParse('1.2.3.4').success).toBe(true)
    expect(Ip().zodSchema.safeParse('::1').success).toBe(true)
  })

  it('Enum: valid/invalid', () => {
    const Role = { ADMIN: 'ADMIN', USER: 'USER' } as const
    const e = Enum(Role)
    expect(e.zodSchema.safeParse('ADMIN').success).toBe(true)
    expect(e.zodSchema.safeParse('NOPE').success).toBe(false)
  })

  it('Version: defaults to 0, rejects negative', () => {
    const v = Version({ type: 'incr' })
    expect(v.meta.default).toBe(0)
    expect(v.zodSchema.safeParse(3).success).toBe(true)
    expect(v.zodSchema.safeParse(-1).success).toBe(false)
  })

  it('Nullable: accepts null and the inner type, rejects other invalid', () => {
    const n = Nullable(Text())
    expect(n.zodSchema.safeParse(null).success).toBe(true)
    expect(n.zodSchema.safeParse('x').success).toBe(true)
    expect(n.zodSchema.safeParse(5).success).toBe(false)
  })

  it('Optional: accepts undefined and the inner type', () => {
    const o = Optional(Text())
    expect(o.zodSchema.safeParse(undefined).success).toBe(true)
    expect(o.zodSchema.safeParse('x').success).toBe(true)
  })

  it('List: array of inner type, respects min/max, carries itemDescriptor', () => {
    const l = List(Text(), { min: 1, max: 2 })
    expect(l.zodSchema.safeParse(['a']).success).toBe(true)
    expect(l.zodSchema.safeParse([]).success).toBe(false)
    expect(l.zodSchema.safeParse(['a', 'b', 'c']).success).toBe(false)
    expect(l.itemDescriptor).toBeDefined()
  })

  it('FromZodType: wraps an arbitrary schema', () => {
    const coords = FromZodType(z.tuple([z.number(), z.number()]))
    expect(coords.zodSchema.safeParse([1, 2]).success).toBe(true)
    expect(coords.zodSchema.safeParse(['a', 'b']).success).toBe(false)
  })
})
