import { describe, expect, it } from "vitest";
import {
  localeStorage,
  resolveLocale,
  setConfigLocaleReader,
} from "../../src/core/i18n/resolve-locale.js";

describe("resolveLocale", () => {
  it("falls back to 'en-US' with no AsyncLocalStorage context and no config reader", () => {
    setConfigLocaleReader(undefined);
    expect(resolveLocale()).toBe("en-US");
  });

  it("uses the AsyncLocalStorage context when set, over any config default", () => {
    setConfigLocaleReader(() => "fr-FR");
    let observed: string | undefined;
    localeStorage.run({ locale: "pt-BR" }, () => {
      observed = resolveLocale();
    });
    expect(observed).toBe("pt-BR");
    setConfigLocaleReader(undefined);
  });

  it("uses the injected config reader when no AsyncLocalStorage context is set", () => {
    setConfigLocaleReader(() => "fr-FR");
    expect(resolveLocale()).toBe("fr-FR");
    setConfigLocaleReader(undefined);
  });
});
