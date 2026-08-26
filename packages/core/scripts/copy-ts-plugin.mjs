import { existsSync, cpSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "..", "..", "ts-plugin", "dist");
const dest = resolve(here, "..", "dist", "ts-plugin");

if (!existsSync(src)) {
  throw new Error(
    `packages/ts-plugin/dist not found at ${src} — its build must run before packages/core's (see turbo.json's "morphz#build" task override).`,
  );
}

cpSync(src, dest, { recursive: true });
