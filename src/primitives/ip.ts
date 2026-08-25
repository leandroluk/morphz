import { z } from 'zod'
import type { FieldDescriptor, FieldDescriptorMeta } from '../core/field-descriptor.js'

export interface IpOptions extends Partial<FieldDescriptorMeta<string>> {
  version?: 'v4' | 'v6'
}

export function Ip(options: IpOptions = {}): FieldDescriptor<string> {
  const { version, ...meta } = options
  const schema = version === 'v6' ? z.ipv6() : version === 'v4' ? z.ipv4() : z.union([z.ipv4(), z.ipv6()])
  return { zodSchema: schema, meta }
}
