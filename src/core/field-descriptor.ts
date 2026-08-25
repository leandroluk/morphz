import type { z } from "zod";

export type LocaleMap = Record<string, string>;

export type MessageValue = string | LocaleMap;

/**
 * Message override map keyed by Zod issue code. `invalid_format` is special:
 * its value may be a MessageValue directly (shorthand, single-format field)
 * or a map keyed by the issue's `format` (e.g. 'regex', 'email', 'uuid').
 */
export interface MessageMap {
  invalid_type?: MessageValue;
  too_big?: MessageValue;
  too_small?: MessageValue;
  invalid_format?: MessageValue | Record<string, MessageValue>;
  not_multiple_of?: MessageValue;
  unrecognized_keys?: MessageValue;
  invalid_union?: MessageValue;
  invalid_key?: MessageValue;
  invalid_element?: MessageValue;
  invalid_value?: MessageValue;
  custom?: MessageValue;
}

export interface FieldDescriptorMeta<T = unknown> {
  description?: string;
  default?: T | (() => T);
  immutable?: boolean;
  examples?: T[];
  writeOnly?: boolean;
  message?: MessageMap;
  /** Set concretely by DateTime/Timestamp (datetime-codec) for .toJSON(). */
  encode?: (val: T) => unknown;
}

export interface FieldDescriptor<T = unknown> {
  zodSchema: z.ZodType<T>;
  meta: FieldDescriptorMeta<T>;
  /** Set by List() only — lets .toJSON() encode each array item. */
  itemDescriptor?: FieldDescriptor<unknown>;
  /** Set by Embed()/Ref() only — points at the target Struct class. */
  targetStruct?: () => unknown;
}

export type FieldDescriptorFactory<T = unknown, Opts = unknown> = (
  overrides?: Opts,
) => FieldDescriptor<T>;
