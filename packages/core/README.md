# morphz

Zod v4 + a class-based, type-safe OO layer: `Struct` entities, `Define` meta-types,
real class instances out of `.parse()`.

`morphz` keeps Zod as the validation engine and adds the layer Zod deliberately
leaves out — declaring your domain as **classes** with domain methods, real
`instanceof` identity, reusable field meta-types, cascading labels, i18n error
messages, and JSON-Schema-safe date codecs.

## Install

```sh
pnpm add morphz zod
```

`zod@^4` is a peer dependency — bring your own.

## Quick example

```ts
import { Struct, Define, Text, Email, Uuid, Timestamp, Enum } from "morphz";

// A meta-type: lock defaults + a text template once, reuse everywhere.
// `#entityName` is filled from the Struct's labels.
const PrimaryKey = Define(Uuid, {
  description: "Unique identifier of #entityName",
  default: () => crypto.randomUUID(),
  immutable: true,
});

const CreatedAt = Define(Timestamp, {
  description: "Creation date of the #entityName record",
  default: () => new Date(),
  immutable: true,
});

enum UserRole {
  ADMIN = "ADMIN",
  USER = "USER",
}

export class User extends Struct(
  {
    id: PrimaryKey(),
    createdAt: CreatedAt(),
    name: Text({ min: 2, max: 50, description: "Full name" }),
    email: Email({ description: "Corporate email" }),
    role: Enum(UserRole, { default: UserRole.USER }),
  },
  {
    labels: { entityName: "User" },
    description: "A user account",
  },
) {
  isAdmin(): boolean {
    return this.role === UserRole.ADMIN;
  }
}

const user = User.parse({ name: "John Doe", email: "john@example.com" });

user instanceof User; // true
user.id;              // string — filled by the default
user.isAdmin();       // false — a domain method on the instance
user.createdAt;       // Date — the domain value, not a string

// safeParse for controllers / HTTP boundaries:
const result = User.safeParse(req.body);
if (!result.success) {
  // result.error is a ValidationError
}

// Serialization drops writeOnly fields and encodes codecs back to wire form:
const json = user.toJSON();
```

### Dates are representable by construction

`DateTime` / `Timestamp` are Zod v4 `z.codec`s — ISO string on the wire,
real `Date` in memory. `z.toJSONSchema()` never sees a `z.date()`, so
OpenAPI / Swagger generation just works with no per-field patching.

### i18n error messages

`Define(..., { message: { regex: { "pt-BR": "E-mail inválido", "en-US": "Invalid email" } } })`.
Overrides are matched by `(path, code)` against the Zod issue tree — schema-
agnostic, falls back to Zod's raw message when no override is registered.
Active locale comes from `defineConfig({ locale: { default, fallback } })` or a
per-request `localeStorage` context.

## Subpath exports

| Import | What |
|---|---|
| `morphz` | The library — `Struct`, `Define`, primitives, `Embed`, `Ref`, `FieldOf`, `Union`, config, i18n helpers |
| `morphz/register` | Side-effect import for eager, deterministic config load |
| `morphz/recipes` | Optional opinionated `Define` field types (`PrimaryKey`, `CreatedAt`, `UpdatedAt`, `DeletedAt`, …) |
| `morphz/ts-plugin` | The bundled TypeScript Language Service Plugin (used by the `morphz-vscode` extension; add to `tsconfig.json` `compilerOptions.plugins` for plain `tsc`/editors) |

## Editor support

Install the **morphz** extension (`morphz-vscode`) from the VSCode Marketplace or
Open VSX for hover, autocomplete, and diagnostics on `Struct` / `Define` — no
`tsconfig.json` editing required. Under the hood it activates `morphz/ts-plugin`.

## Links

- Repository: https://github.com/leandroluk/morphz
- Changelog: https://github.com/leandroluk/morphz/blob/main/CHANGELOG.md

## License

MIT © Leandro Santiago Gomes
