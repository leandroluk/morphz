import { describe, expect, it } from "vitest";
import { lookupMessage } from "../../src/core/i18n/lookup-message.js";
import type { FieldDescriptor } from "../../src/core/field-descriptor.js";
import { z } from "zod";

function descriptorWithMessage(message: FieldDescriptor["meta"]["message"]): FieldDescriptor {
  return { zodSchema: z.string(), meta: { message } };
}

function issue(code: string, format?: string): any {
  return { code, format, path: [], message: "raw zod message" };
}

describe("lookupMessage", () => {
  it("returns a fixed string directly", () => {
    const d = descriptorWithMessage({ invalid_type: "Precisa ser texto" });
    expect(lookupMessage(d, issue("invalid_type"), "pt-BR")).toBe("Precisa ser texto");
  });

  it("returns the value for the requested locale from a locale map", () => {
    const d = descriptorWithMessage({ invalid_type: { "pt-BR": "PT msg", "en-US": "EN msg" } });
    expect(lookupMessage(d, issue("invalid_type"), "pt-BR")).toBe("PT msg");
    expect(lookupMessage(d, issue("invalid_type"), "en-US")).toBe("EN msg");
  });

  it("invalid_format shorthand: direct locale map applies regardless of format value", () => {
    const d = descriptorWithMessage({ invalid_format: { "pt-BR": "Formato inválido" } });
    expect(lookupMessage(d, issue("invalid_format", "regex"), "pt-BR")).toBe("Formato inválido");
    expect(lookupMessage(d, issue("invalid_format", "email"), "pt-BR")).toBe("Formato inválido");
  });

  it("invalid_format nested-by-format: only the matching format's map is used", () => {
    const d = descriptorWithMessage({
      invalid_format: {
        regex: { "pt-BR": "CEP inválido" },
        email: { "pt-BR": "Email inválido" },
      },
    });
    expect(lookupMessage(d, issue("invalid_format", "regex"), "pt-BR")).toBe("CEP inválido");
    expect(lookupMessage(d, issue("invalid_format", "email"), "pt-BR")).toBe("Email inválido");
  });

  it("returns undefined (never throws) when no entry matches", () => {
    const d = descriptorWithMessage({ invalid_type: "x" });
    expect(lookupMessage(d, issue("too_small"), "pt-BR")).toBeUndefined();

    const empty = descriptorWithMessage(undefined);
    expect(() => lookupMessage(empty, issue("invalid_type"), "pt-BR")).not.toThrow();
    expect(lookupMessage(empty, issue("invalid_type"), "pt-BR")).toBeUndefined();
  });

  it("falls back to fallbackLocale when requested locale is missing", () => {
    const d = descriptorWithMessage({ invalid_type: { "en-US": "EN msg" } });
    expect(lookupMessage(d, issue("invalid_type"), "pt-BR", "en-US")).toBe("EN msg");
    expect(lookupMessage(d, issue("invalid_type"), "pt-BR")).toBeUndefined();
  });
});
