import { z } from "zod";
import type { FieldDescriptor, FieldDescriptorMeta } from "../core/field-descriptor.js";

export interface UrlOptions extends Partial<FieldDescriptorMeta<string>> {
  protocols?: string[];
}

/**
 * z.url()'s own `protocol` param takes a RegExp, natively — no hand-rolled
 * URL parsing / refine needed (this replaces the define-metatypes §1
 * hand-rolled `Url` recipe now that a first-class primitive exists).
 */
export function Url(overrides: UrlOptions = {}): FieldDescriptor<string> {
  const { protocols, ...meta } = overrides;

  // z.url()'s `protocol` regex matches against the scheme WITHOUT its
  // trailing colon (confirmed empirically -- `/^https:$/` never matches,
  // `/^https$/` does) -- strip any trailing `:` callers pass (INSIGHT.md's
  // own example uses `["http:", "https:"]`) before building the pattern.
  const protocol = protocols
    ? new RegExp(
        `^(${protocols.map((p) => p.replace(/:$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})$`,
      )
    : undefined;

  return { zodSchema: z.url({ protocol }), meta };
}
