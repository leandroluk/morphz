import { describe, expect, it } from "vitest";
import { defineConfig } from "../../src/core/define-config.js";

describe("defineConfig", () => {
  it("returns its input unchanged (identity)", () => {
    const options = { locale: { default: "pt-BR" } };
    expect(defineConfig(options)).toBe(options);
  });

  it("passes through an empty object", () => {
    expect(defineConfig({})).toEqual({});
  });
});
