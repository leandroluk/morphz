import { AsyncLocalStorage } from "node:async_hooks";

export interface LocaleContext {
  locale: string;
}

/**
 * Request-scoped locale context — set by the consumer around a request
 * (e.g. Express/Nest middleware), read here without threading `locale`
 * through every `.parse()`/`.safeParse()` call.
 */
export const localeStorage: AsyncLocalStorage<LocaleContext> = new AsyncLocalStorage();

/**
 * `project-config` (a later feature) owns the actual config singleton.
 * Until it exists, this stays an injectable hook — `setConfigLocaleReader`
 * lets that feature wire itself in later without this module depending on
 * one that doesn't exist yet. Never throws if unset.
 */
let configLocaleReader: (() => string | undefined) | undefined;

export function setConfigLocaleReader(reader: (() => string | undefined) | undefined): void {
  configLocaleReader = reader;
}

const HARD_FALLBACK_LOCALE = "en-US";

/**
 * AsyncLocalStorage (per-call, highest precedence) -> config.locale.default
 * (project-wide, via the injectable reader) -> 'en-US' hard fallback.
 */
export function resolveLocale(): string {
  const fromContext = localeStorage.getStore()?.locale;
  if (fromContext) return fromContext;

  const fromConfig = configLocaleReader?.();
  if (fromConfig) return fromConfig;

  return HARD_FALLBACK_LOCALE;
}
