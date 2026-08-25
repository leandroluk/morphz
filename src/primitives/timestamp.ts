import { Define } from '../core/define.js'
import { DateTime } from './date-time.js'

/** `DateTime` + a baked "stamp now" default — same wire/domain codec, not a separate primitive. */
export const Timestamp = Define(DateTime, {
  default: () => new Date(),
})
