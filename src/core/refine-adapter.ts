/**
 * Adapts morphz's `refine` convention — `(val, opts?) => true | string`,
 * where the returned string IS the failure message — to Zod v4's REAL
 * native `.refine(check, params)` shape.
 *
 * IMPORTANT: Zod v4's `.refine()` second argument is `string |
 * $ZodCustomParams` (see node_modules/zod/v4/core/api.d.ts /
 * schemas.d.ts) — `$ZodCustomParams.error` is the message-customization
 * key, NOT `message`, and when given as a function it receives the ISSUE
 * (`{ input, ... }`), not the raw value, and returns `{ message } | string
 * | undefined`. An earlier version of this adapter used a `{ message }`-
 * returning function keyed as `params` directly (based on Context7 docs
 * for Zod's v3-compat page, which does NOT match the real v4 runtime
 * types) — that shape is silently ignored by the real `.refine()`,
 * producing Zod's generic "Invalid input" fallback instead of the
 * intended message. Fixed here: `error` is a function of the ISSUE,
 * recomputing the refine result from `issue.input`.
 */
export type MorphzRefine<T, Opts = undefined> = (val: T, opts?: Opts) => true | string;

export interface ZodRefineArgs<T> {
  check: (val: T) => boolean;
  params: { error: (issue: { input: unknown }) => string };
}

export function toZodRefine<T, Opts = undefined>(
  refineFn: MorphzRefine<T, Opts>,
  opts?: Opts,
): ZodRefineArgs<T> {
  return {
    check: (val: T) => refineFn(val, opts) === true,
    params: {
      error: (issue: { input: unknown }) => {
        const result = refineFn(issue.input as T, opts);
        return typeof result === "string" ? result : "Invalid value";
      },
    },
  };
}
