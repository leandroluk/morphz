import { describe, expect, it } from "vitest";
import { DateOnly } from "../../src/primitives/date-only.js";
import { PlainDate } from "../../src/core/plain-date.js";

describe("DateOnly", () => {
  it("decodes an ISO date string into a PlainDate", () => {
    const result = DateOnly().zodSchema.parse("1995-08-25");
    expect(result).toBeInstanceOf(PlainDate);
    expect(result.year).toBe(1995);
    expect(result.month).toBe(8);
    expect(result.day).toBe(25);
  });

  it("round-trips via encode", () => {
    const descriptor = DateOnly();
    const value = descriptor.zodSchema.parse("2024-01-01");
    expect(descriptor.meta.encode?.(value)).toBe("2024-01-01");
  });

  it("rejects a malformed date string", () => {
    expect(() => DateOnly().zodSchema.parse("not-a-date")).toThrow();
  });

  it("addDays advances correctly across a month boundary", () => {
    expect(new PlainDate("2024-01-31").addDays(1).toString()).toBe("2024-02-01");
  });

  it("addMonths rolls over day-overflow instead of producing an invalid date", () => {
    // Jan 31 + 1 month: February has no 31st (2024 is a leap year, 29 days)
    // -> rolls forward into March, same as native Date.UTC's own overflow.
    expect(new PlainDate("2024-01-31").addMonths(1).toString()).toBe("2024-03-02");
  });

  it("addMonths on a mid-month date stays exact", () => {
    expect(new PlainDate("2024-03-15").addMonths(2).toString()).toBe("2024-05-15");
  });
});
