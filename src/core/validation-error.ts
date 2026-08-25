import type { z } from "zod";
import type { StructClass } from "./struct-meta.js";
import { resolveIssueMessages, type ResolvedIssue } from "./i18n/resolve-issues.js";
import { resolveLocale } from "./i18n/resolve-locale.js";

/**
 * Thrown by the constructor / `.parse()` on invalid input. `.issues` is
 * Zod's own issue shape (`path`, `code`, `message`) with `message` already
 * passed through `resolveIssueMessages()` — i18n overrides applied, same
 * shape `.safeParse()`'s `.errors` uses.
 */
export class ValidationError extends Error {
  issues: ResolvedIssue[];

  constructor(zodError: z.ZodError, structClass: StructClass) {
    super("Validation failed");
    this.name = "ValidationError";
    this.issues = resolveIssueMessages(zodError, structClass, resolveLocale());
  }
}
