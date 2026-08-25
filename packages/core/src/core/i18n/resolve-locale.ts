import { AsyncLocalStorage } from "node:async_hooks";
import { getConfig } from "../config.js";
import { logI18n } from "../debug.js";

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
 * Defaults to reading `project-config`'s singleton directly. Kept
 * injectable (`setConfigLocaleReader`) for tests, or for a future scoped-
 * config need — overriding never throws, `undefined` restores the default.
 */
let configLocaleReader: (() => string | undefined) | undefined = () => getConfig().locale?.default;

export function setConfigLocaleReader(reader: (() => string | undefined) | undefined): void {
  configLocaleReader = reader ?? (() => getConfig().locale?.default);
}

const HARD_FALLBACK_LOCALE = "en-US";

/**
 * AsyncLocalStorage (per-call, highest precedence) -> config.locale.default
 * (project-wide, via the injectable reader) -> 'en-US' hard fallback.
 */
export function resolveLocale(): string {
  const fromContext = localeStorage.getStore()?.locale;
  if (fromContext) {
    logI18n("resolved locale %s from AsyncLocalStorage context", fromContext);
    return fromContext;
  }

  const fromConfig = configLocaleReader?.();
  if (fromConfig) {
    logI18n("resolved locale %s from config", fromConfig);
    return fromConfig;
  }

  logI18n("resolved locale %s from hard fallback", HARD_FALLBACK_LOCALE);
  return HARD_FALLBACK_LOCALE;
}
