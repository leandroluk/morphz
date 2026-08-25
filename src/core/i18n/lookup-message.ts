import type { z } from "zod";
import type { FieldDescriptor, MessageValue } from "../field-descriptor.js";

type AnyIssue = z.core.$ZodIssue;

/**
 * Resolves the override message for one Zod issue against one field's
 * descriptor. `invalid_format` issues carry a `format` sub-discriminator
 * (regex/email/uuid/...) — the registered value may be given directly
 * (shorthand, single-format field) or nested one level under the format
 * name. Never throws — an unmatched lookup returns `undefined`, and the
 * caller falls back to Zod's own raw message.
 */
export function lookupMessage(
  descriptor: FieldDescriptor,
  issue: AnyIssue,
  locale: string,
  fallbackLocale?: string,
): string | undefined {
  const codeEntry = descriptor.meta.message?.[issue.code as keyof typeof descriptor.meta.message];
  if (codeEntry === undefined) return undefined;

  const format = issue.code === "invalid_format" ? (issue as { format?: string }).format : undefined;

  let localeMap: MessageValue | undefined;
  if (format && typeof codeEntry === "object" && codeEntry !== null && format in codeEntry) {
    localeMap = (codeEntry as Record<string, MessageValue>)[format];
  } else {
    localeMap = codeEntry as MessageValue;
  }

  if (localeMap === undefined) return undefined;
  if (typeof localeMap === "string") return localeMap;

  return localeMap[locale] ?? (fallbackLocale ? localeMap[fallbackLocale] : undefined);
}
