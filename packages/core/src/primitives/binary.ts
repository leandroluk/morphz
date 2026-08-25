import { z } from "zod";
import type { FieldDescriptor, FieldDescriptorMeta } from "../core/field-descriptor.js";
import { logCodec } from "../core/debug.js";

export interface BinaryOptions extends Partial<FieldDescriptorMeta<Uint8Array>> {
  maxBytes?: number;
  exactBytes?: number;
}

/**
 * Wire is a base64 string (JSON has no native binary type). Domain is a
 * real Uint8Array -- portable across runtimes (not Node's Buffer), though
 * decode/encode use Buffer internally since the rest of this codebase
 * already assumes a Node environment.
 */
export function Binary(overrides: BinaryOptions = {}): FieldDescriptor<Uint8Array> {
  const { maxBytes, exactBytes, ...meta } = overrides;

  const codec = z.codec(z.base64(), z.instanceof(Uint8Array), {
    decode: (value: string, payload) => {
      logCodec("decoding Binary wire value (%d chars)", value.length);
      const buf = Buffer.from(value, "base64");
      if (exactBytes !== undefined && buf.byteLength !== exactBytes) {
        payload.issues.push({
          code: "custom",
          message: `Expected exactly ${exactBytes} bytes, got ${buf.byteLength}`,
          input: value,
        });
        return z.NEVER;
      }
      if (maxBytes !== undefined && buf.byteLength > maxBytes) {
        payload.issues.push({
          code: "custom",
          message: `Expected at most ${maxBytes} bytes, got ${buf.byteLength}`,
          input: value,
        });
        return z.NEVER;
      }
      return new Uint8Array(buf);
    },
    encode: (value: Uint8Array) => {
      logCodec("encoding Binary domain value (%d bytes)", value.byteLength);
      return Buffer.from(value).toString("base64");
    },
  });

  return {
    zodSchema: codec,
    meta: {
      // Always mockable out of the box, without requiring the caller to
      // declare `examples` -- a short, always-valid binary blob.
      examples: [new Uint8Array([1, 2, 3])],
      ...meta,
      encode: (value: Uint8Array) => Buffer.from(value).toString("base64"),
    },
  };
}
