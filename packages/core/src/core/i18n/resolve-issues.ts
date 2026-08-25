import type { z } from "zod";
import type { StructClass } from "../struct-meta.js";
import { logI18n } from "../debug.js";
import { descendPath } from "./descend-path.js";
import { lookupMessage } from "./lookup-message.js";
import { resolveLocale } from "./resolve-locale.js";

export interface ResolvedIssue {
  path: readonly PropertyKey[];
  code: string;
  message: string;
}

/**
 * Walks `zodError.issues`; for each, descends `STRUCT_META.fields` per
 * path segment (recursing through `Embed`/`Ref` targets) and substitutes
 * the issue's message with a registered override when found. Never
 * throws — an issue with no override, or one whose path isn't fully
 * introspectable (a `List` item, `FromZodType` internals), keeps Zod's
 * raw message untouched.
 */
export function resolveIssueMessages(
  zodError: z.ZodError,
  rootStruct: StructClass,
  locale: string = resolveLocale(),
  fallbackLocale?: string,
): ResolvedIssue[] {
  return zodError.issues.map((issue) => {
    const resolved = descendPath(rootStruct, issue.path);
    if (!resolved || resolved.consumed !== issue.path.length) {
      logI18n("no field descriptor for issue at path %o, code=%s — raw message kept", issue.path, issue.code);
      return { path: issue.path, code: issue.code, message: issue.message };
    }

    const override = lookupMessage(resolved.descriptor, issue, locale, fallbackLocale);
    if (override) {
      logI18n("applied message override for path %o, code=%s, locale=%s", issue.path, issue.code, locale);
    } else {
      logI18n("no message override found for path %o, code=%s, locale=%s", issue.path, issue.code, locale);
    }
    return {
      path: issue.path,
      code: issue.code,
      message: override ?? issue.message,
    };
  });
}
