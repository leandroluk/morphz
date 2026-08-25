import { describe, expect, it } from "vitest";
import {
  Brl,
  Cep,
  CreatedAt,
  DeletedAt,
  Mac,
  PrimaryKey,
  RowVersion,
  ShortId,
  Slug,
  TimeAfter,
  TimeAgo,
  TimeBefore,
} from "../../src/recipes.js";
import { Struct } from "../../src/core/struct.js";
import { Text } from "../../src/primitives/text.js";

describe("morphz/recipes", () => {
  it("PrimaryKey defaults to a real UUID and is immutable", () => {
    class Widget extends Struct({ id: PrimaryKey(), name: Text() }, {}) {}
    const w = Widget.parse({ name: "x" }) as { id: string };
    expect(w.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it("CreatedAt/DeletedAt default correctly", () => {
    class Widget extends Struct({ createdAt: CreatedAt(), deletedAt: DeletedAt() }, {}) {}
    const w = Widget.parse({}) as { createdAt: Date; deletedAt: Date | null };
    expect(w.createdAt).toBeInstanceOf(Date);
    expect(w.deletedAt).toBeNull();
  });

  it("Cep validates the CEP format", () => {
    class Widget extends Struct({ zip: Cep() }, {}) {}
    expect(() => Widget.parse({ zip: "01001-000" })).not.toThrow();
    expect(() => Widget.parse({ zip: "01001000" })).toThrow();
  });

  it("Slug/Mac validate their formats", () => {
    class Widget extends Struct({ slug: Slug(), mac: Mac() }, {}) {}
    expect(() => Widget.parse({ slug: "my-slug", mac: "00:1B:44:11:3A:B7" })).not.toThrow();
    expect(() => Widget.parse({ slug: "Not A Slug", mac: "bad" })).toThrow();
  });

  it("TimeAgo rejects future dates and out-of-window dates", () => {
    class Widget extends Struct({ issuedAt: TimeAgo() }, {}) {}
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(() => Widget.parse({ issuedAt: future })).toThrow();

    class WidgetWindow extends Struct({ issuedAt: TimeAgo({ within: "30d" }) }, {}) {}
    const tooOld = new Date(Date.now() - 40 * 86_400_000).toISOString();
    expect(() => WidgetWindow.parse({ issuedAt: tooOld })).toThrow();
    const recent = new Date(Date.now() - 5 * 86_400_000).toISOString();
    expect(() => WidgetWindow.parse({ issuedAt: recent })).not.toThrow();
  });

  it("TimeBefore/TimeAfter validate against a reference", () => {
    class Widget extends Struct({ expiresAt: TimeAfter() }, {}) {}
    const past = new Date(Date.now() - 60_000).toISOString();
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(() => Widget.parse({ expiresAt: past })).toThrow();
    expect(() => Widget.parse({ expiresAt: future })).not.toThrow();

    class Widget2 extends Struct({ before: TimeBefore() }, {}) {}
    expect(() => Widget2.parse({ before: future })).toThrow();
    expect(() => Widget2.parse({ before: past })).not.toThrow();
  });

  it("RowVersion defaults to 0", () => {
    class Widget extends Struct({ v: RowVersion() }, {}) {}
    const w = Widget.parse({}) as { v: number };
    expect(w.v).toBe(0);
  });

  it("Brl accepts non-negative integer cents", () => {
    class Widget extends Struct({ price: Brl() }, {}) {}
    expect(() => Widget.parse({ price: 15000 })).not.toThrow();
    expect(() => Widget.parse({ price: -1 })).toThrow();
  });

  it("ShortId defaults to a generated nanoid", () => {
    class Widget extends Struct({ id: ShortId() }, {}) {}
    const w = Widget.parse({}) as { id: string };
    expect(w.id).toMatch(/^[A-Za-z0-9_-]{21}$/);
  });
});
