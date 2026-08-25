/** Lightweight time-only domain wrapper — wraps "HH:mm" or "HH:mm:ss". */
export class PlainTime {
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  private readonly hasSeconds: boolean;

  constructor(iso: string) {
    const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(iso);
    if (!match) throw new Error(`Invalid PlainTime string: ${iso}`);
    this.hour = Number(match[1]);
    this.minute = Number(match[2]);
    this.second = match[3] ? Number(match[3]) : 0;
    this.hasSeconds = match[3] !== undefined;
  }

  toString(): string {
    const hh = String(this.hour).padStart(2, "0");
    const mm = String(this.minute).padStart(2, "0");
    const ss = String(this.second).padStart(2, "0");
    return this.hasSeconds ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`;
  }
}
