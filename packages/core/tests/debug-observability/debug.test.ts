import createDebug from "debug";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Struct } from "../../src/core/struct.js";
import { Text } from "../../src/primitives/text.js";
import { Uuid } from "../../src/primitives/uuid.js";
import { DateTime } from "../../src/primitives/date-time.js";
import { resolveIssueMessages } from "../../src/core/i18n/resolve-issues.js";
import { setConfigLocaleReader } from "../../src/core/i18n/resolve-locale.js";
import { STRUCT_META } from "../../src/core/struct-meta.js";

class Foo extends Struct(
  { id: Uuid({ default: () => "00000000-0000-0000-0000-000000000000" }), name: Text({ min: 2 }) },
  { labels: { entityName: "Foo" } },
) {}

function captureStderr() {
  const chunks: string[] = [];
  const spy = vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
    chunks.push(String(chunk));
    return true;
  });
  return { chunks, spy };
}

describe("debug-observability", () => {
  beforeEach(() => {
    createDebug.enable("");
  });

  afterEach(() => {
    createDebug.enable("");
    vi.restoreAllMocks();
  });

  it("emits morphz:struct logs when that namespace is enabled", () => {
    createDebug.enable("morphz:struct");
    const { chunks, spy } = captureStderr();

    class Bar extends Struct({ name: Text({ min: 2 }) }, { labels: { entityName: "Bar" } }) {}
    void Bar;

    spy.mockRestore();
    expect(chunks.some((c) => c.includes("morphz:struct"))).toBe(true);
  });

  it("emits nothing when no namespace is enabled", () => {
    createDebug.enable("");
    const { chunks, spy } = captureStderr();

    class Baz extends Struct({ name: Text({ min: 2 }) }, { labels: { entityName: "Baz" } }) {}
    new Baz({ name: "ok" });
    Baz.safeParse({ name: "x" });

    spy.mockRestore();
    expect(chunks.length).toBe(0);
  });

  it("morphz:parse logs both success and failure", () => {
    createDebug.enable("morphz:parse");
    const { chunks, spy } = captureStderr();

    new Foo({ id: "11111111-1111-4111-8111-111111111111", name: "ab" });
    Foo.safeParse({ id: "11111111-1111-4111-8111-111111111111", name: "x" });

    spy.mockRestore();
    const joined = chunks.join("\n");
    expect(joined).toContain("morphz:parse");
    expect(joined).toMatch(/safeParse failed/);
  });

  it("morphz:codec logs DateTime decode and encode", () => {
    createDebug.enable("morphz:codec");
    const { chunks, spy } = captureStderr();

    const descriptor = DateTime();
    const decoded = descriptor.zodSchema.parse("2024-01-01T00:00:00Z");
    descriptor.meta.encode?.(decoded);

    spy.mockRestore();
    const joined = chunks.join("\n");
    expect(joined).toContain("morphz:codec");
    expect(joined).toMatch(/decoding DateTime/);
    expect(joined).toMatch(/encoding DateTime/);
  });

  it("morphz:i18n logs when a message override is applied", () => {
    createDebug.enable("morphz:i18n");
    const { chunks, spy } = captureStderr();

    setConfigLocaleReader(() => "pt-BR");
    class WithMsg extends Struct(
      { name: Text({ min: 5, message: { too_small: { "pt-BR": "muito curto" } } }) },
      { labels: { entityName: "WithMsg" } },
    ) {}
    const result = WithMsg[STRUCT_META].schema.safeParse({ name: "ab" });
    expect(result.success).toBe(false);
    if (!result.success) {
      resolveIssueMessages(result.error, WithMsg);
    }
    setConfigLocaleReader(undefined);

    spy.mockRestore();
    const joined = chunks.join("\n");
    expect(joined).toContain("morphz:i18n");
    expect(joined).toMatch(/applied message override|no message override found/);
  });
});
