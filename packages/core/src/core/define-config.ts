import type { MorphzConfig } from "./config.js";

/**
 * Pure type-level identity helper — exists only so `morphz.config.ts`
 * authors get autocomplete/type-checking on `options`. Never registers
 * anything itself; discovery is driven by `getConfig()`/`morphz/register`,
 * which then loads (imports) the config file — not the other way around.
 */
export function defineConfig(options: MorphzConfig): MorphzConfig {
  return options;
}
