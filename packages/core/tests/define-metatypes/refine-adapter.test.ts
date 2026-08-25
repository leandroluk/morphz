import { describe, expect, it } from "vitest";
import { z } from "zod";
import { toZodRefine } from "../../src/core/refine-adapter.js";

describe("toZodRefine", () => {
  it("passes when refine returns true", () => {
    const { check, params } = toZodRefine<string>(() => true);
    const schema = z.string().refine(check, params);
    expect(schema.safeParse("anything").success).toBe(true);
  });

  it("fails with the returned string as the custom issue message", () => {
    const { check, params } = toZodRefine<string>((val) =>
      val === "ok" ? true : `bad value: ${val}`,
    );
    const schema = z.string().refine(check, params);
    const result = schema.safeParse("nope");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.code).toBe("custom");
      expect(result.error.issues[0]?.message).toBe("bad value: nope");
    }
  });

  it("passes runtime opts through to the refine function", () => {
    const withinDays = (val: Date, opts?: { withinDays?: number }) => {
      if (!opts?.withinDays) return true;
      const ms = Date.now() - val.getTime();
      return ms <= opts.withinDays * 86_400_000 || "too old";
    };
    const { check, params } = toZodRefine<Date, { withinDays?: number }>(withinDays, {
      withinDays: 1,
    });
    const schema = z.date().refine(check, params as never);
    const old = new Date(Date.now() - 5 * 86_400_000);
    const result = schema.safeParse(old);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe("too old");
    expect(schema.safeParse(new Date()).success).toBe(true);
  });
});
