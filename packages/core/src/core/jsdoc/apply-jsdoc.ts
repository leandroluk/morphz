import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Project } from "ts-morph";
import { getConfig } from "../config.js";
import { STRUCT_META, type StructMeta } from "../struct-meta.js";
import { buildFieldTags } from "./build-field-tags.js";

export interface ApplyJsDocOptions {
  /** Path to the already-built JS entry point (e.g. `./dist/index.js`). */
  jsEntryPath: string;
  /** Path to the already-built `.d.ts` for the same entry (e.g. `./dist/index.d.ts`). */
  dtsPath: string;
}

// `STRUCT_META` (`Symbol("morphz.structMeta")`) is imported statically —
// this MUST resolve to the same module instance the consumer's own build
// used for `morphz`, which holds in the real scenario (their bundler
// treats `morphz` as an external dependency, resolved once via
// node_modules, same module cache as `applyJsDoc` itself — both part of
// the SAME installed `morphz` package). It only breaks if the consumer's
// bundler INLINES its own copy of morphz's code rather than externalizing
// it — a real but narrower risk than initially assumed, worth a docs
// callout, not a runtime workaround (see report).
function hasStructMeta(value: unknown): value is { [STRUCT_META]: StructMeta } {
  return (
    (typeof value === "function" || typeof value === "object") &&
    value !== null &&
    STRUCT_META in (value as object)
  );
}

/**
 * Post-build step (gated on `getConfig().jsdoc === true`): imports the
 * already-built JS, walks each exported `Struct`-produced class's REAL,
 * fully-resolved `STRUCT_META`, and mirrors it onto the matching `.d.ts`
 * declaration as JSDoc via `ts-morph`. No-op when the flag is off, so
 * consumers can call it unconditionally from their own build script.
 */
export async function applyJsDoc(options: ApplyJsDocOptions): Promise<void> {
  const config = getConfig();
  if (config.jsdoc !== true) return;

  const locale = config.locale?.default ?? "en-US";
  const fallbackLocale = config.locale?.fallback;

  // `pathToFileURL` (not manual `file://${cwd}` string-building) — the
  // latter breaks on Windows, whose `\`-separated `process.cwd()` isn't a
  // valid file:// URL on its own (`new URL('./x', 'file://C:\\a\\b/')`
  // throws `Invalid URL`).
  const moduleUrl = pathToFileURL(resolve(process.cwd(), options.jsEntryPath)).href;
  const built: Record<string, unknown> = await import(moduleUrl);

  // Absolute, resolved NOW (against the CURRENT cwd) — ts-morph/TypeScript's
  // own file-system layer can resolve a relative path against a cwd it
  // captured at its own module-load time rather than the caller's current
  // `process.cwd()`, so a bare relative `dtsPath` can silently miss.
  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(resolve(process.cwd(), options.dtsPath));

  for (const [exportName, exportValue] of Object.entries(built)) {
    if (!hasStructMeta(exportValue)) continue;

    const classDeclaration = sourceFile.getClass(exportName);
    if (!classDeclaration) continue;

    const meta = exportValue[STRUCT_META];
    for (const [fieldName, descriptor] of Object.entries(meta.fields)) {
      const property = classDeclaration.getProperty(fieldName);
      if (!property) continue;

      const { description, tags } = buildFieldTags(descriptor, locale, fallbackLocale);
      property.addJsDoc({
        description: description || undefined,
        tags: tags.length > 0 ? tags : undefined,
      });
    }
  }

  sourceFile.saveSync();
}
