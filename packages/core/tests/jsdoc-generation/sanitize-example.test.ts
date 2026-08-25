import { describe, expect, it } from "vitest";
import { sanitizeExample } from "../../src/core/jsdoc/sanitize-example.js";

describe("sanitizeExample", () => {
  it("returns a short scalar string unescaped when there's no @", () => {
    expect(sanitizeExample("John Doe")).toBe("John Doe");
  });

  it("escapes @ in a scalar string (never fences a plain one-liner)", () => {
    const result = sanitizeExample("@Transform decorator");
    expect(result).toContain("&#64;Transform");
    expect(result).not.toContain("```");
  });

  it("fences a multi-line string in a ```ts block", () => {
    const result = sanitizeExample("line1\nline2");
    expect(result).toMatch(/^```ts\n[\s\S]*\n```$/);
  });

  it("JSON-stringifies and fences a structured (object) example", () => {
    const result = sanitizeExample({ role: "ADMIN", active: true });
    expect(result).toMatch(/^```ts\n\{/);
    expect(result).toContain('"role": "ADMIN"');
  });

  it("escapes @ inside a fenced structured example", () => {
    const result = sanitizeExample({ decorator: "@Transform()" });
    expect(result).toContain("&#64;Transform()");
  });
});
