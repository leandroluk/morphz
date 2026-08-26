import { describe, expect, it } from "vitest";
import { detectMorphzDependency } from "../src/detect-morphz-dependency.js";

describe("detectMorphzDependency", () => {
  it("detects morphz in dependencies", () => {
    const content = JSON.stringify({ dependencies: { morphz: "^0.1.0" } });
    expect(detectMorphzDependency(content)).toBe(true);
  });

  it("detects morphz in devDependencies", () => {
    const content = JSON.stringify({ devDependencies: { morphz: "^0.1.0" } });
    expect(detectMorphzDependency(content)).toBe(true);
  });

  it("returns false when morphz is absent from both", () => {
    const content = JSON.stringify({ dependencies: { zod: "^4.0.0" } });
    expect(detectMorphzDependency(content)).toBe(false);
  });

  it("returns false when neither dependencies field is present", () => {
    const content = JSON.stringify({ name: "some-package" });
    expect(detectMorphzDependency(content)).toBe(false);
  });

  it("returns false for invalid JSON instead of throwing", () => {
    expect(detectMorphzDependency("{ not valid json")).toBe(false);
  });

  it("returns false for JSON that isn't an object", () => {
    expect(detectMorphzDependency("[]")).toBe(false);
    expect(detectMorphzDependency("null")).toBe(false);
    expect(detectMorphzDependency('"a string"')).toBe(false);
  });
});
