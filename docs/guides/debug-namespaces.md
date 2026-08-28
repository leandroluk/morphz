# Debug Namespaces

`morphz` is **silent by default** — it never writes to `console` at runtime. For
diagnosing schema compilation, parsing, and message resolution it uses the
`DEBUG` environment variable convention (same as Express, Prisma, `debug`).

## Namespaces

| Namespace          | Logs                                                                      |
| ------------------ | ------------------------------------------------------------------------- |
| `morphz:struct`    | entity registration & compilation, inheritance, label/template resolution |
| `morphz:parse`     | parse cycle, input validation, input transforms                           |
| `morphz:codec`     | bidirectional encode/decode (e.g. ISO string ↔ `Date`)                    |
| `morphz:i18n`      | error-message resolution, active locale, fallbacks triggered              |
| `morphz:lifecycle` | instance creation, `pre` / `post` hook execution, timings                 |

## Activate

```bash
# everything
DEBUG=morphz:* npm run dev

# only parsing and i18n
DEBUG=morphz:parse,morphz:i18n npm run dev

# everything except one namespace
DEBUG=morphz:*,-morphz:cache npm run dev
```

Or in `.env`:

```env
DEBUG=morphz:*
```

## Zero overhead when off

When `DEBUG` is unset or doesn't match `morphz:*`, the log functions are no-ops
(`() => {}`), so V8 elides string formatting and console I/O entirely. Safe to
leave the call sites in production.
