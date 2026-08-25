import { describe, expect, it } from "vitest";
import { Url } from "../../src/primitives/url.js";

describe("Url", () => {
  it("accepts a valid URL", () => {
    expect(Url().zodSchema.parse("https://example.com")).toBe("https://example.com");
  });

  it("rejects a non-URL string", () => {
    expect(Url().zodSchema.safeParse("not a url").success).toBe(false);
  });

  it("filters by protocol when protocols option is given", () => {
    const field = Url({ protocols: ["https:"] });
    expect(field.zodSchema.safeParse("https://example.com").success).toBe(true);
    expect(field.zodSchema.safeParse("http://example.com").success).toBe(false);
    expect(field.zodSchema.safeParse("ftp://example.com").success).toBe(false);
  });
});
