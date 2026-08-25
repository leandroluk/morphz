import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { createJiti } from "jiti";

// `import.meta.url` is empty in the CJS build (esbuild can't resolve it
// for that output format) — `__filename` is CJS's equivalent, provided by
// esbuild's own CJS shim at runtime. Declared locally (not globally typed
// in an ESM-mode tsconfig) since it only exists in the CJS bundle.
declare const __filename: string | undefined;
const jitiBaseUrl: string = typeof __filename !== "undefined" ? __filename : import.meta.url;

export interface MorphzLabelsConfig {
  entityName?: (ctx: { className: string }) => string;
}

export interface MorphzTemplateConfig {
  delimiter?: string;
}

export interface MorphzLocaleConfig {
  default?: string;
  fallback?: string;
}

export interface MorphzConfig {
  labels?: MorphzLabelsConfig;
  template?: MorphzTemplateConfig;
  locale?: MorphzLocaleConfig;
}

const CONFIG_FILENAMES = [
  "morphz.config.ts",
  "morphz.config.js",
  "morphz.config.mjs",
  "morphz.config.cjs",
];

/**
 * Cosmiconfig-style synchronous upward search from `process.cwd()`. Never
 * throws — a load error in a found config file propagates as-is (a real
 * syntax/runtime error in the user's own config should surface loudly),
 * but "no file found anywhere" is not an error condition.
 */
export function discoverConfig(): MorphzConfig | undefined {
  let dir = process.cwd();

  for (;;) {
    for (const filename of CONFIG_FILENAMES) {
      const candidate = join(dir, filename);
      if (existsSync(candidate)) {
        const jiti = createJiti(jitiBaseUrl);
        // `Jiti` extends `NodeRequire` — calling it directly is the
        // synchronous, require-like load path (vs. the async `.import()`).
        const mod = jiti(candidate) as { default?: MorphzConfig } | MorphzConfig;
        return (mod as { default?: MorphzConfig }).default ?? (mod as MorphzConfig);
      }
    }

    const parent = dirname(dir);
    if (parent === dir) return undefined; // reached filesystem root
    dir = parent;
  }
}

let cachedConfig: MorphzConfig | undefined;
let discovered = false;

/**
 * Process-wide singleton. Lazily runs `discoverConfig()` at most once —
 * subsequent calls (and `morphz/register`'s eager call) are no-ops if
 * discovery already ran, per REQ-005.
 */
export function getConfig(): MorphzConfig {
  if (!discovered) {
    cachedConfig = discoverConfig() ?? {};
    discovered = true;
  }
  return cachedConfig as MorphzConfig;
}

/**
 * Eagerly populates the singleton (used by `morphz/register`). No-op if
 * discovery already ran.
 */
export function primeConfig(): void {
  getConfig();
}
