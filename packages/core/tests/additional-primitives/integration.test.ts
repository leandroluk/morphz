import { describe, expect, it } from "vitest";
import { Struct } from "../../src/core/struct.js";
import { Boolean } from "../../src/primitives/boolean.js";
import { BigInt as BigIntField } from "../../src/primitives/bigint.js";
import { Decimal } from "../../src/primitives/decimal.js";
import { DateOnly } from "../../src/primitives/date-only.js";
import { TimeOnly } from "../../src/primitives/time-only.js";
import { Duration } from "../../src/primitives/duration.js";
import { Ulid } from "../../src/primitives/ulid.js";
import { Nanoid } from "../../src/primitives/nanoid.js";
import { Cuid2 } from "../../src/primitives/cuid2.js";
import { toJSON } from "../../src/core/to-json.js";
import { attachMock } from "../../src/core/mock.js";
import { STRUCT_META } from "../../src/core/struct-meta.js";
import type { StructConstructor } from "../../src/core/struct.js";

class Account extends Struct({
  isActive: Boolean(),
  balance: BigIntField(),
  price: Decimal(),
  birthDate: DateOnly(),
  opensAt: TimeOnly(),
  ttl: Duration(),
  ulidId: Ulid(),
  nanoId: Nanoid(),
  cuid: Cuid2(),
}) {}

// mock/mockMany are attached by attachMock() inside struct.ts's real
// construction path already, but re-attach defensively in case this test
// file's import order ever bypasses it (keeps the test self-contained).
attachMock(Account as unknown as StructConstructor);

describe("additional-primitives pass 1 — integration with Struct", () => {
  it("parses a real payload across all 9 primitives", () => {
    const account = Account.parse({
      isActive: "true",
      balance: "123456789012345678901234567890",
      price: "150.50",
      birthDate: "1995-08-25",
      opensAt: "08:30:00",
      ttl: "PT15M",
      ulidId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      nanoId: "V1StGXR8_Z5jdHi6B-myT",
      cuid: "clh3am1zz0000356m7g5r8x9p",
    });
    expect(account).toBeInstanceOf(Account);
    expect(account.isActive).toBe(true);
    expect(account.balance).toBe(123456789012345678901234567890n);
  });

  it("toJSON() serializes every field to its wire format", () => {
    const account = Account.parse({
      isActive: true,
      balance: "42",
      price: "19.99",
      birthDate: "2000-01-01",
      opensAt: "09:00:00",
      ttl: "PT1H",
      ulidId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      nanoId: "V1StGXR8_Z5jdHi6B-myT",
      cuid: "clh3am1zz0000356m7g5r8x9p",
    });
    const json = toJSON(account) as Record<string, unknown>;
    expect(json.balance).toBe("42");
    expect(json.price).toBe("19.99");
    expect(json.birthDate).toBe("2000-01-01");
    expect(json.opensAt).toBe("09:00:00");
    expect(json.ttl).toBe("PT1H");
  });

  it("STRUCT_META reflects all 9 fields", () => {
    const meta = Account[STRUCT_META];
    expect(Object.keys(meta.fields)).toHaveLength(9);
  });

  it(".mock() synthesizes valid values for all 9 fields without throwing", () => {
    const mocked = Account.mock() as Account;
    expect(mocked).toBeInstanceOf(Account);
  });

  it(".mock() -> toJSON() -> .parse() round-trips cleanly", () => {
    // Repeated: mock() synthesis is randomized (randexp for regex-driven
    // fields) -- a single run wouldn't reliably exercise edge cases like
    // decimal.js's exponential-notation threshold.
    for (let i = 0; i < 20; i++) {
      const mocked = Account.mock() as Account;
      const json = toJSON(mocked);
      const reparsed = Account.parse(json);
      expect(reparsed).toBeInstanceOf(Account);
    }
  });

  it("Ulid/Nanoid/Cuid2 auto-generate via default when omitted", () => {
    const account = Account.parse({
      isActive: true,
      balance: "1",
      price: "1.00",
      birthDate: "2020-01-01",
      opensAt: "10:00:00",
      ttl: "PT5M",
    });
    expect(typeof account.ulidId).toBe("string");
    expect(account.ulidId.length).toBe(26);
    expect(typeof account.nanoId).toBe("string");
    expect(typeof account.cuid).toBe("string");
  });
});
