import { describe, expect, it } from "vitest";
import { zodRangeSatisfiesV4 } from "../../src/cli.js";

describe("zodRangeSatisfiesV4", () => {
  it("accepts v4 ranges", () => {
    for (const r of [
      "^4",
      "~4.2",
      ">=4.0.0",
      "4",
      "4.0.1",
      "v4.0.0",
      "* ",
      "latest",
      "workspace:*",
    ]) {
      expect(zodRangeSatisfiesV4(r)).toBe(true);
    }
  });

  it("rejects non-v4 ranges", () => {
    for (const r of ["^3", "3.x", "~3.22", ">=2 <4", "", "3", "beta"]) {
      expect(zodRangeSatisfiesV4(r)).toBe(false);
    }
  });
});
