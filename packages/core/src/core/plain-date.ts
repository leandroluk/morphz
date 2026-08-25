/**
 * Lightweight date-only domain wrapper — NOT a full calendar-math library.
 * Wraps an ISO "YYYY-MM-DD" string, exposes read accessors and a few
 * immutable arithmetic helpers. Never touches a timezone-aware `Date`
 * internally (that's exactly the off-by-one-day bug this primitive exists
 * to avoid).
 */
export class PlainDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;

  constructor(iso: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!match) throw new Error(`Invalid PlainDate ISO string: ${iso}`);
    this.year = Number(match[1]);
    this.month = Number(match[2]);
    this.day = Number(match[3]);
  }

  static fromParts(year: number, month: number, day: number): PlainDate {
    return new PlainDate(
      `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    );
  }

  private toUtcEpochDay(): number {
    return Date.UTC(this.year, this.month - 1, this.day) / 86_400_000;
  }

  private static fromUtcEpochDay(epochDay: number): PlainDate {
    const d = new Date(epochDay * 86_400_000);
    return PlainDate.fromParts(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }

  addDays(n: number): PlainDate {
    return PlainDate.fromUtcEpochDay(this.toUtcEpochDay() + n);
  }

  addMonths(n: number): PlainDate {
    // Uses Date.UTC's own day-overflow rollover (e.g. "Jan 31" + 1 month
    // has no such day in February, so it rolls into March) rather than
    // blindly re-stamping `this.day` onto the target month, which could
    // otherwise construct an invalid date (e.g. "2024-02-31").
    const totalMonths = this.year * 12 + (this.month - 1) + n;
    const year = Math.floor(totalMonths / 12);
    const month = totalMonths % 12;
    const utcMs = Date.UTC(year, month, this.day);
    const d = new Date(utcMs);
    return PlainDate.fromParts(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }

  toString(): string {
    return `${String(this.year).padStart(4, "0")}-${String(this.month).padStart(2, "0")}-${String(this.day).padStart(2, "0")}`;
  }
}
