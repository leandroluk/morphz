import { describe, expect, it } from "vitest";
import { Struct } from "../../src/core/struct.js";
import { Url } from "../../src/primitives/url.js";
import { Json } from "../../src/primitives/json.js";
import { Record } from "../../src/primitives/record.js";
import { Binary } from "../../src/primitives/binary.js";
import { Tuple } from "../../src/primitives/tuple.js";
import { SetOf } from "../../src/primitives/set-of.js";
import { Text } from "../../src/primitives/text.js";
import { Number } from "../../src/primitives/number.js";
import { toJSON } from "../../src/core/to-json.js";

class Doc extends Struct({
  website: Url(),
  metadata: Json(),
  flags: Record(Text, Number),
  payload: Binary(),
  coordinates: Tuple([Number, Number]),
  tags: SetOf(Text),
}) {}

describe("additional-primitives pass 2 — integration with Struct", () => {
  it("parses a real payload across all 6 primitives", () => {
    const doc = Doc.parse({
      website: "https://example.com",
      metadata: { a: 1 },
      flags: { x: 1, y: 2 },
      payload: Buffer.from([1, 2, 3]).toString("base64"),
      coordinates: [10.5, -20.5],
      tags: ["a", "b"],
    });
    expect(doc).toBeInstanceOf(Doc);
    expect(doc.tags).toBeInstanceOf(Set);
  });

  it("toJSON() serializes every field to its wire format", () => {
    const doc = Doc.parse({
      website: "https://example.com",
      metadata: { a: 1 },
      flags: { x: 1 },
      payload: Buffer.from([9]).toString("base64"),
      coordinates: [1, 2],
      tags: ["z"],
    });
    const json = toJSON(doc) as Record<string, unknown>;
    expect(Array.isArray(json.tags)).toBe(true);
    expect(json.coordinates).toEqual([1, 2]);
  });

  it(".mock() synthesizes valid values for all 6 fields without throwing", () => {
    const mocked = Doc.mock() as Doc;
    expect(mocked).toBeInstanceOf(Doc);
  });

  it(".mock() -> toJSON() -> .parse() round-trips cleanly", () => {
    for (let i = 0; i < 10; i++) {
      const mocked = Doc.mock() as Doc;
      const json = toJSON(mocked);
      const reparsed = Doc.parse(json);
      expect(reparsed).toBeInstanceOf(Doc);
    }
  });
});
