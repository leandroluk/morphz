import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Define } from "../../src/core/define.js";
import { Text } from "../../src/primitives/text.js";
import { Ip } from "../../src/primitives/ip.js";
import type { FieldDescriptor } from "../../src/core/field-descriptor.js";

describe("Define", () => {
  it("accepts a bare factory as BaseType (calls it with no args)", () => {
    const Cep = Define(Text, { description: "CEP", regex: /^\d{5}-\d{3}$/ });
    const descriptor = Cep();
    expect(descriptor.zodSchema.safeParse("01001-000").success).toBe(true);
    expect(descriptor.zodSchema.safeParse("abc").success).toBe(false);
    expect(descriptor.meta.description).toBe("CEP");
  });

  it("accepts an already-invoked descriptor as BaseType", () => {
    const PublicIp = Define(Ip({ version: "v4" }), { description: "public ipv4" });
    const descriptor = PublicIp();
    expect(descriptor.zodSchema.safeParse("1.2.3.4").success).toBe(true);
    expect(descriptor.zodSchema.safeParse("::1").success).toBe(false);
  });

  it("per-instance options override the Define-level description without losing other meta", () => {
    const Slug = Define(Text, { description: "default", regex: /^[a-z0-9-]+$/ });
    const descriptor = Slug({ description: "custom" });
    expect(descriptor.meta.description).toBe("custom");
    expect(descriptor.zodSchema.safeParse("abc-123").success).toBe(true);
  });

  it("binds instance-call runtime opts into refine (TimeAfter-style)", () => {
    const DateBase: FieldDescriptor<Date> = { zodSchema: z.date(), meta: {} };
    const TimeAfter = Define(DateBase, {
      refine: (val: Date, opts?: { ref?: Date }) => {
        const ref = opts?.ref ?? new Date();
        return val > ref || `must be after ${ref.toISOString()}`;
      },
    });
    const fixedRef = new Date("2020-01-01T00:00:00Z");
    const descriptor = TimeAfter({ ref: fixedRef });
    expect(descriptor.zodSchema.safeParse(new Date("2021-01-01T00:00:00Z")).success).toBe(true);
    const failResult = descriptor.zodSchema.safeParse(new Date("2019-01-01T00:00:00Z"));
    expect(failResult.success).toBe(false);
  });

  it("zero-arg call works when no refine/opts are needed", () => {
    const Cep = Define(Text, { regex: /^\d{5}-\d{3}$/ });
    expect(Cep().zodSchema.safeParse("01001-000").success).toBe(true);
  });
});
