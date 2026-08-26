import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const CONFIG_FILENAMES = ["morphz.config.json", "morphz.config.js", "morphz.config.mjs"];

/**
 * Best-effort, synchronous read of `morphz.config.ts`'s `locale.default`
 * — searches upward from `startDir` for a `morphz.config.*` file. Only
 * `.json`/`.js`/`.mjs` are attempted here (no `jiti`/TS-loader dependency
 * inside the plugin — a `.ts` config is silently skipped, same "degrade,
 * never throw" philosophy as every other wrapper in this package). Looks
 * for a top-level `locale: { default: "..." }` shape via a light regex
 * scan rather than executing the file (executing an arbitrary consumer
 * file synchronously inside `tsserver` is a real risk not worth taking
 * for a "nice to have" locale hint).
 */
function readConfiguredLocale(startDir: string): string | undefined {
  let dir = startDir;
  for (;;) {
    for (const filename of CONFIG_FILENAMES) {
      const candidate = join(dir, filename);
      if (existsSync(candidate)) {
        try {
          const text = readFileSync(candidate, "utf8");
          const match = text.match(/locale\s*:\s*\{[^}]*default\s*:\s*["']([^"']+)["']/);
          if (match?.[1]) return match[1];
        } catch {
          // unreadable/unparsable config — fall through to the next candidate
        }
      }
    }
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/**
 * Locale cascade (REQ-005): `morphz.config.*`'s `locale.default`
 * (best-effort, `.ts` configs skipped — see `readConfiguredLocale`) →
 * `Intl.DateTimeFormat().resolvedOptions().locale` (Node's own OS locale
 * — `vscode.env.language` is unreachable from a bare `tsserver` plugin
 * process) → `'en-US'` hard fallback. Never throws.
 */
export function resolveLocale(startDir: string = process.cwd()): string {
  try {
    const configured = readConfiguredLocale(startDir);
    if (configured) return configured;
  } catch {
    // fall through
  }

  try {
    const osLocale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (osLocale) return osLocale;
  } catch {
    // fall through
  }

  return "en-US";
}
