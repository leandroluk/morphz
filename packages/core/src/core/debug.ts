import createDebug from "debug";

/** `Struct()` compilation, label/template resolution. */
export const logStruct = createDebug("morphz:struct");
/** Constructor / `.parse()` / `.safeParse()` calls. */
export const logParse = createDebug("morphz:parse");
/** Codec `decode`/`encode` (`DateTime`, and future codec-based primitives). */
export const logCodec = createDebug("morphz:codec");
/** Locale resolution, `message` override lookups. */
export const logI18n = createDebug("morphz:i18n");
/** `pre`/`post` hook execution, instance creation timing. */
export const logLifecycle = createDebug("morphz:lifecycle");
