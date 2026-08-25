/**
 * Side-effect module: `import 'morphz/register'` (or `node -r
 * morphz/register`) triggers config discovery eagerly, instead of waiting
 * for the first config-needing API call. No-op if discovery already ran
 * (via a prior `morphz/register` import, or lazy discovery already having
 * fired) — `primeConfig()`/`getConfig()` share the same singleton guard.
 */
import { primeConfig } from "./core/config.js";

primeConfig();
