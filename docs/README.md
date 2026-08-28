<h1 align="center">morphz</h1>

<p align="center">
  Zod v4 + a class-based, type-safe OO layer for your domain model.
</p>

<div align="center">
  <a href="https://www.npmjs.com/package/morphz">
    <img src="https://img.shields.io/npm/v/morphz.svg" alt="NPM Version" />
  </a>
  <a href="https://github.com/leandroluk/morphz/blob/main/LICENSE">
    <img src="https://img.shields.io/npm/l/morphz.svg" alt="License" />
  </a>
  <a href="https://www.npmjs.com/package/morphz">
    <img src="https://img.shields.io/npm/dw/morphz.svg" alt="Downloads" />
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=leandroluk.morphz-vscode">
    <img src="https://img.shields.io/visual-studio-marketplace/v/leandroluk.morphz-vscode?label=VS%20Marketplace" alt="VS Marketplace" />
  </a>
  <a href="https://open-vsx.org/extension/leandroluk/morphz-vscode">
    <img src="https://img.shields.io/open-vsx/v/leandroluk/morphz-vscode?label=Open%20VSX" alt="Open VSX" />
  </a>
</div>

<br>

`morphz` keeps [Zod v4](https://zod.dev/) as the validation engine and adds the
layer Zod deliberately leaves out — declaring your domain as **classes** with
domain methods, real `instanceof` identity, reusable field meta-types, cascading
labels, i18n error messages, JSON-Schema-safe date codecs, and first-class editor
tooling.

```ts
import { Struct, Define, Text, Email, Uuid, Timestamp, Enum } from "morphz";

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
user.id; // string — filled by the default
user.isAdmin(); // false — a domain method on the instance
user.createdAt; // Date — the domain value, not a string
```

## Why this exists

Zod is an excellent validation library, but it stops at the schema. `.parse()`
returns an anonymous plain object — no class identity, no domain methods, no
reuse of a field's rules across entities, and `z.date()` breaks
`z.toJSONSchema()` so OpenAPI generation needs per-field patching.

`morphz` wraps Zod behind a class-first API:

- Define your domain as **decorated classes** (`Struct(fields, options)`) and get
  real instances out of `.parse()` — `instanceof` holds, domain methods are on
  the instance.
- Lock a field's defaults, constraints, description template and error messages
  **once** with `Define(...)`, then reuse that meta-type everywhere.
- Labels declared on a `Struct` cascade into every child field's description
  template (`#entityName` → `"User"`).
- `DateTime` / `Timestamp` are Zod v4 `z.codec`s — ISO string on the wire, real
  `Date` in memory — so `z.toJSONSchema()` never sees a `z.date()`.
- A bundled TypeScript Language Service Plugin (`morphz/ts-plugin`) resolves
  hover / autocomplete / diagnostics straight from your schema.

## Features

- Class-based entities via `Struct(fields, options)` — real instances, `instanceof`, domain methods
- Reusable field meta-types via `Define(base, meta)` — defaults, constraints, `regex`, `refine`, description templates, i18n `message` maps
- Cascading labels — `labels` on a `Struct` interpolate `#placeholder` templates in child field descriptions
- Embedded value objects (`Embed`) and lazy references (`Ref(() => Other)`)
- Scalar foreign keys via `FieldOf(Entity, "field")` — reuse a field's type without importing the entity's shape
- Cross-field validation via `pre` / `post` hooks (Zod `preprocess` / `superRefine` under the hood)
- Class extension — `.extend()` (real subclassing, transitive `instanceof`), `.pick()`, `.omit()`, `.partial()` for DTOs
- `immutable: true` fields are rejected by update DTOs automatically — no manual `.omit()` per entity
- Dates representable by construction — `DateTime` / `Timestamp` / `DateOnly` / `TimeOnly` / `Duration` as codecs, zero timezone drift
- i18n error messages resolved by `(path, code)` against the Zod issue tree — schema-agnostic, always falls back to Zod's raw message
- Serialization control — `.toJSON()` drops `writeOnly` fields and encodes codecs; `.toMaskedJSON()` applies registered `mask` functions for PII / LGPD
- Native fixtures — `Entity.mock(overrides?)` / `Entity.mockMany(n, fn?)` synthesize schema-valid instances
- Property interceptors — `get` / `set` accessors on meta-types for wire-format ↔ rich domain object separation
- Automatic JSDoc — semantic metadata propagated to generated types for IDE hover (`jsdoc: true`)
- Silent by default — namespaced debug logging via `DEBUG=morphz:*`
- Project config via `morphz.config.ts` (`defineConfig`)

## Requirements

- Node.js ≥ 22
- TypeScript 5.6+
- `zod@^4` as a peer dependency — bring your own

## Get started

```bash
pnpm add morphz zod
```

`zod@^4` is a peer dependency.

### tsconfig.json

`morphz` uses the class-fields / decorators-free `Struct(...)` form, so no
`experimentalDecorators` flag is required. To enable schema-driven hover in plain
`tsc` / editors, add the bundled plugin:

```json
{
  "compilerOptions": {
    "strict": true,
    "plugins": [{ "name": "morphz/ts-plugin" }]
  }
}
```

VS Code-family editors can skip the `tsconfig.json` entry and install the
extension instead — see below.

## Editor support

`morphz` bundles a **TypeScript Language Service Plugin** (`morphz/ts-plugin`)
that gives you, right inside `Struct` / `Define` declarations:

- **Hover** — the resolved description, `regex` / `format` and `examples` for a
  field, pulled through its whole `Define` origin chain, with `#label` templates
  already interpolated
- **Completions** — `#label` template references, and the real field keys of the
  target entity inside `FieldOf(User, "…")`
- **Diagnostics** — broken template references and invalid `post`-hook
  `ctx.addIssue({ path })` targets, in the Problems panel

Two ways to turn it on:

|                             | How                                                                                                                                                                                               | Editors                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Extension** (zero-config) | Install **morphz** from the [VS Marketplace](https://marketplace.visualstudio.com/items?itemName=leandroluk.morphz-vscode) or [Open VSX](https://open-vsx.org/extension/leandroluk/morphz-vscode) | VS Code, Cursor, VSCodium, Windsurf, Gitpod, Theia            |
| **`tsconfig.json`**         | `"plugins": [{ "name": "morphz/ts-plugin" }]`                                                                                                                                                     | any `tsserver` host — Neovim, JetBrains, Sublime, plain `tsc` |

Both routes load the same plugin inside your editor's existing `tsserver` — no
extra language server, no background process. Full details, i18n behavior and the
`jsdoc: true` fallback are in the [Editor tooling guide](guides/editor-tooling.md).

## Meta-types with Define

`Define(base, meta)` produces a reusable field factory. `base` is a primitive
(`Text`, `Uuid`, `Number`, …) or another `Define`; `meta` locks defaults,
constraints, a description template, and error messages.

```ts
import { Define, Uuid, Timestamp, DateTime, Nullable, Text, Number, Ip, Version } from "morphz";

// immutable belongs on the meta-type — it's a property of the PK, not a per-entity choice
export const PrimaryKey = Define(Uuid, {
  description: "Unique identifier of #entityName",
  default: () => crypto.randomUUID(),
  immutable: true,
});

export const CreatedAt = Define(Timestamp, {
  description: "Creation date of the #entityName record",
  default: () => new Date(),
  immutable: true,
});

export const UpdatedAt = Define(Timestamp, {
  description: "Last update date of the #entityName record",
});

export const DeletedAt = Define(Nullable(DateTime()), {
  description: "Soft-delete date of #entityName",
  default: null,
});

// Domain types — lock a regex + description once, reuse everywhere
export const Cep = Define(Text, {
  description: "Formatted postal code (CEP)",
  regex: /^\d{5}-\d{3}$/,
  examples: ["01001-000"],
});

export const Slug = Define(Text, {
  description: "Friendly textual identifier (slug) of #entityName",
  regex: /^[a-z0-9-]+$/,
});

// Define on top of a configured primitive
export const PublicIp = Define(Ip({ version: "v4" }), {
  description: "Public IPv4 address of the request origin",
});
```

### `refine` — single-field custom validation

`refine` is the escape hatch for validation that only needs the field's own
value (equivalent to `.refine()` on an isolated Zod schema). It can take an
options bag so the same meta-type covers several cases:

```ts
export const TimeAfter = Define(DateTime, {
  description: "Date after a reference point (default: now)",
  refine: (val: Date, opts?: { ref?: Date | (() => Date) }) => {
    const ref = typeof opts?.ref === "function" ? opts.ref() : (opts?.ref ?? new Date());
    return val > ref || `Must be after ${ref.toISOString()}`;
  },
});

// usage:
//   expiresAt: TimeAfter()
//   scheduledFor: TimeAfter({ ref: () => addMinutes(new Date(), 5) })
```

Comparing two fields of the **same** `Struct` (`startDate < endDate`) never goes
here — that is always a `post` hook on the `Struct` options, because `refine`
only sees its own field's value.

Many of these well-known recipes ship ready-made under
[`morphz/recipes`](#morphzrecipes).

## Structs and label propagation

`Struct(fields, options)` builds the base class. `options.labels` values are
interpolated into every child field's `#placeholder` templates.

```ts
import { Struct, Text, Email, Password, Enum, Optional, Embed, List, Ref } from "morphz";

export class User extends Struct(
  {
    id: PrimaryKey(), // description → "Unique identifier of User"
    createdAt: CreatedAt(), // description → "Creation date of the User record"
    updatedAt: UpdatedAt(),
    deletedAt: DeletedAt(),

    name: Text({ min: 2, max: 50, description: "Full name" }),
    username: Slug(), // description → "Friendly textual identifier (slug) of User"
    email: Email({ description: "Corporate email" }),
    password: Password({ description: "Password hash", writeOnly: true }),
    role: Enum(UserRole, { default: UserRole.USER }),

    address: Optional(Embed(Address)), // nested value object
    tags: List(Text(), { default: () => [] }),
    posts: Optional(List(Ref(() => Post))), // lazy 1:N relation
  },
  {
    labels: {
      entityName: "User",
      module: "Account Management",
    },
    description: "User account entity",

    // cross-field normalization / validation — the z.preprocess / z.superRefine slots
    pre: (val) => ({ ...val, username: val.username?.toLowerCase() }),
    post: (val, ctx) => {
      if (val.role === UserRole.ADMIN && !val.email.endsWith("@company.com")) {
        ctx.addIssue({
          code: "custom",
          path: ["email"],
          message: "Admin requires a corporate email",
        });
      }
    },
  },
) {
  isAdmin(): boolean {
    return this.role === UserRole.ADMIN;
  }

  isDeleted(): boolean {
    return this.deletedAt !== null;
  }
}
```

## Embedded value objects

`Embed(Class)` nests another `Struct` as a value object. The embedded class keeps
its own methods and label context.

```ts
export class Address extends Struct(
  {
    street: Text({ description: "Street", min: 3 }),
    number: Text({ description: "Number" }),
    city: Text({ description: "City" }),
    zipCode: Cep(),
  },
  {
    labels: { entityName: "Address" },
    description: "Physical address value object",
  },
) {
  get fullAddress(): string {
    return `${this.street}, ${this.number} - ${this.city} (${this.zipCode})`;
  }
}
```

Use it inside a parent with `Embed(Address)`, wrap in `Optional(...)` when the
field is nullable.

## References — Ref and FieldOf

- **`Ref(() => Other)`** — a lazy reference to another entity, for 1:N / N:1
  relations. The thunk defers evaluation so circular imports resolve.
- **`FieldOf(Entity, "field", meta?)`** — reuses the _type_ of a single field of
  another entity as a scalar foreign key, without pulling in the entity's shape.

```ts
import { Struct, Text, Union, Literal, FieldOf } from "morphz";

export class Post extends Struct(
  {
    id: PrimaryKey(),
    createdAt: CreatedAt(),
    updatedAt: UpdatedAt(),
    deletedAt: DeletedAt(),

    userId: FieldOf(User, "id", {
      description: "Foreign key pointing at the Post author",
    }),

    title: Text({ min: 5, max: 120, description: "Post title" }),
    body: Text({ description: "Markdown content" }),
    status: Union([Literal("DRAFT"), Literal("PUBLISHED"), Literal("ARCHIVED")], {
      default: "DRAFT",
    }),
  },
  {
    labels: { entityName: "Post", module: "Content" },
    description: "Blog posts",
  },
) {}
```

The `morphz/ts-plugin` autocompletes the `"id"` argument to `FieldOf` with the
real field keys of `User`.

## Lifecycle — parse, instantiate, serialize

Every parse produces a **real class instance**, not a plain object.

```ts
// A. Direct parse — throws ValidationError on failure
const user = User.parse({
  name: "John Doe",
  username: "johndoe",
  email: "john@example.com",
  password: "secret_hash_value",
});
// or: const user = new User({ ... })

user instanceof User; // true
user.id; // string — filled by the default
user.isAdmin(); // domain method on the instance

// B. Safe parse — for controllers / HTTP boundaries
const result = User.safeParse(req.body);
if (!result.success) {
  return res.status(400).json({ errors: result.errors });
}
const validUser: User = result.data; // a real, typed User instance

// C. Serialization — drops writeOnly fields, encodes codecs back to wire form
const json = user.toJSON();
// { id: "...", name: "John Doe", email: "john@example.com" }  — no password
```

`safeParse` returns `{ success: true; data }` or `{ success: false; errors }`,
where `errors` is the resolved (i18n-applied) issue list.

## DTOs and class extension

```ts
// A. Extend — real subclassing, transitive instanceof
export class AdminUser extends User.extend({
  department: Text({ description: "Admin department" }),
  permissions: List(Text(), { default: () => ["READ", "WRITE"] }),
}) {
  canExecute(action: string): boolean {
    return this.permissions.includes(action) || this.isAdmin();
  }
}

const admin = AdminUser.parse({/* ... */});
admin instanceof AdminUser; // true
admin instanceof User; // true — polymorphism preserved

// B. DTO derivations — independent classes (instanceof does NOT hold back to the source)
//    .omit() / .pick() take a mask object — Zod v4's own shape.
export class CreatePostDto extends Post.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
}) {}
export class UpdateUserDto extends User.pick({ name: true, address: true }).partial() {}

// C. immutable fields (id, createdAt) are rejected by update DTOs already —
//    you only strip what isn't part of the public surface
export class PatchUserDto extends User.omit({ password: true }).partial() {}

// D. selective partial — only the masked fields become optional
export class ReplaceUserDto extends User.omit({ password: true }).partial({ address: true }) {}

// reusable mask, typed against the shape:
import type { Mask } from "morphz";
const SERVER_FIELDS = { id: true, createdAt: true, updatedAt: true } satisfies Mask<UpdateUserDto>;
```

`.extend()` produces a genuine `class extends`, so constructor, `static parse` /
`safeParse` and `.toJSON()` are inherited. `.omit()` / `.pick()` / `.partial()`
build independent classes — `instanceof` the source does not hold. All three take
a **mask object** (`{ field: true }`), matching Zod v4 — the pre-`0.2` variadic
(`.omit("id", "createdAt")`) and array (`.omit(["id"])`) forms were removed.

## i18n error messages

The base is Zod's issue tree (`error.issues`: `path`, `code`, `message`).
`Define` accepts a `message` map to override the default text per validation
rule — a fixed string or a locale map resolved against the active locale.

```ts
export const Email = Define(Text, {
  regex: /^[^@]+@[^@]+\.[^@]+$/,
  message: {
    invalid_type: { "pt-BR": "Precisa ser texto", "en-US": "Must be text" },
    regex: { "pt-BR": "E-mail inválido", "en-US": "Invalid email" },
  },
});

// per-field override at declaration:
email: Email({ message: { regex: { "pt-BR": "Formato de e-mail incorreto" } } });
```

The override mechanism is **schema-agnostic**: after a parse, `morphz` walks
`error.issues` and, for each issue, looks up `message[code]` on the `Define` of
the field named by `path`. No entry → Zod's raw message is kept (it never
breaks). Active locale comes from `morphz.config.ts`
(`locale: { default, fallback }`) or a per-request context via `localeStorage`.

Because it works by `(path, code)`, wrapping an arbitrary Zod schema with
`FromZodType` gets the same behaviour for free at the field's root path. Deeper
issues inside a composite wrapped schema (`['coords', 0]`) fall back to Zod's raw
message — `message` covers the field as a unit, not the whole tree.

## Dates by construction

`z.toJSONSchema()` treats `z.date()` as unrepresentable. `morphz`'s date types
are Zod v4 `z.codec`s instead — a wire schema (ISO string) and a domain schema
(`Date`), with `decode` / `encode`:

```ts
// reference implementation of the primitive — not public API, shows the idea:
const DateTime = z.codec(
  z.iso.datetime(), // wire: ISO 8601 string — fully representable in JSON Schema
  z.date(), // domain: real Date
  {
    decode: (s) => new Date(s), // parse:     string → Date
    encode: (d) => d.toISOString(), // serialize: Date → string
  },
);
```

`z.toJSONSchema()` only ever sees the wire side, so it emits
`{ type: "string", format: "date-time" }` with no override. The same holds for
`DateOnly` (`"YYYY-MM-DD"`), `TimeOnly` (`"HH:mm[:ss]"`) and `Duration`
(ISO 8601 or `"30d"` / `"5m"` shorthand) — see
[Primitives](#primitives-reference).

## Config file

Drop a `morphz.config.ts` (also `.js` / `.mjs` / `.cjs`) at the project root.
Discovery runs once, lazily; `import "morphz/register"` forces an eager,
deterministic load.

```ts
// morphz.config.ts
import { defineConfig } from "morphz";

export default defineConfig({
  labels: {
    // OPTIONAL — overrides the default. `entityName` already falls back to
    // the bare class name; supply a function only to reshape it, e.g. strip
    // an `Entity` / `Model` suffix:
    entityName: (ctx) => ctx.className.replace(/(Entity|Model)$/, ""),
  },
  template: {
    delimiter: "#", // '#entityName' — change to '{' etc. if you prefer
  },
  locale: {
    default: "en-US",
    fallback: "en-US",
  },
  jsdoc: true, // propagate semantic metadata into generated types for IDE hover
});
```

### `entityName` resolution

`#entityName` in a description template resolves, in order:

1. an explicit `labels: { entityName: "User" }` on the `Struct` — always wins
2. a `config.labels.entityName(ctx)` function, if you defined one
3. **the bare class name** — the zero-config default (`class User` → `"User"`),
   resolved lazily on the first `parse()` / `new` so subclass names are correct

The whole config file is optional. Bundlers that mangle class names are the one
caveat — set `labels.entityName` explicitly on those Structs.

## Primitives reference

All primitives are field factories — call them (`Text({ ... })`) inside a
`Struct` or pass them to `Define`.

### Strings & identifiers

| Primitive  | Wire type | Notes                                                |
| ---------- | --------- | ---------------------------------------------------- |
| `Text`     | string    | `min` / `max` / `regex` / `format`                   |
| `Email`    | string    | email `format`                                       |
| `Password` | string    | pair with `writeOnly: true`                          |
| `Uuid`     | string    | uuid `format`                                        |
| `Ulid`     | string    | lexicographically sortable, 128-bit Crockford Base32 |
| `Nanoid`   | string    | `length`, URL-safe                                   |
| `Cuid2`    | string    | collision-resistant, non-sequential                  |
| `Ip`       | string    | `{ version: "v4" \| "v6" }`                          |
| `Url`      | string    | `{ protocols: [...] }` filter                        |
| `Literal`  | literal   | `Literal("DRAFT")`                                   |
| `Enum`     | enum      | `Enum(MyEnum, { default })`                          |

### Numbers

| Primitive | Wire type | Notes                                                                     |
| --------- | --------- | ------------------------------------------------------------------------- |
| `Number`  | number    | `{ int?, min?, max? }`                                                    |
| `BigInt`  | bigint    | 64-bit ids (Snowflakes, PG `BIGINT`) — `min: 0n`                          |
| `Decimal` | string    | exact precision — `{ precision, scale, min, max }`, maps to SQL `DECIMAL` |
| `Boolean` | boolean   | coerces `"true"` / `"0"` from querystrings                                |
| `Version` | number    | optimistic row version — `Version({ type: "incr" })`                      |

### Dates & time (codecs — zero timezone drift)

| Primitive                 | Wire                        | Domain      | Notes                                     |
| ------------------------- | --------------------------- | ----------- | ----------------------------------------- |
| `DateTime`                | ISO 8601 string             | `Date`      | `{ type: "string", format: "date-time" }` |
| `Timestamp`               | ISO 8601 string             | `Date`      | same shape as `DateTime`                  |
| `DateOnly`                | `"YYYY-MM-DD"`              | date        | no time component                         |
| `TimeOnly`                | `"HH:mm[:ss]"`              | time        | no date component                         |
| `Duration`                | ISO 8601 / `"30d"` / `"5m"` | duration    | friendly shorthand accepted               |
| `PlainDate` / `PlainTime` | string                      | plain value | calendar values without an instant        |

### Structures

| Primitive                              | Notes                                                 |
| -------------------------------------- | ----------------------------------------------------- |
| `List(item, { default? })`             | array                                                 |
| `Tuple([A, B, ...])`                   | fixed positional heterogeneous types                  |
| `SetOf(item, { minSize? })`            | uniqueness guaranteed, deserializes to `Set<T>`       |
| `Record(KeyType, ValueType)`           | strongly-typed key/value dictionary                   |
| `Json<T>()`                            | arbitrary object / array payloads with a generic type |
| `Binary({ maxBytes? \| exactBytes? })` | `Uint8Array` / `Buffer` / Base64                      |
| `Optional(field)` / `Nullable(field)`  | modifiers                                             |
| `Embed(Class)`                         | nest a `Struct` as a value object                     |
| `Ref(() => Class)`                     | lazy reference to another entity                      |
| `Union([A, B, ...])`                   | discriminated / plain union                           |
| `FieldOf(Entity, "field", meta?)`      | reuse one field's type as a scalar FK                 |

### Composition helpers

| Export                    | Purpose                                          |
| ------------------------- | ------------------------------------------------ |
| `Define(base, meta)`      | build a reusable meta-type                       |
| `FromZodType(zodSchema)`  | wrap an arbitrary Zod schema as a `morphz` field |
| `Struct(fields, options)` | build the entity base class                      |

## Subpath exports

| Import             | What                                                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `morphz`           | the library — `Struct`, `Define`, primitives, `Embed`, `Ref`, `FieldOf`, `Union`, config, i18n helpers                      |
| `morphz/register`  | side-effect import for eager, deterministic config load                                                                     |
| `morphz/recipes`   | optional opinionated `Define` field types (`PrimaryKey`, `CreatedAt`, …)                                                    |
| `morphz/ts-plugin` | the bundled TypeScript Language Service Plugin — add to `tsconfig.json` `compilerOptions.plugins` for plain `tsc` / editors |

## morphz/recipes

An optional, opinionated starter set of `Define`-based field types — so you don't
hand-write the well-known ones. Not part of the main entry point.

```ts
import { PrimaryKey, CreatedAt, UpdatedAt, DeletedAt, Slug, Cep } from "morphz/recipes";
```

| Recipe                                 | Base                            | Purpose                                                    |
| -------------------------------------- | ------------------------------- | ---------------------------------------------------------- |
| `PrimaryKey`                           | `Uuid`                          | `immutable` UUID with `crypto.randomUUID()` default        |
| `CreatedAt`                            | `Timestamp`                     | `immutable`, defaults to `new Date()`                      |
| `UpdatedAt`                            | `Timestamp`                     | last-update timestamp                                      |
| `DeletedAt`                            | `Nullable(DateTime())`          | soft-delete marker, defaults to `null`                     |
| `Cep`                                  | `Text`                          | Brazilian postal code `NNNNN-NNN`                          |
| `Slug`                                 | `Text`                          | `^[a-z0-9-]+$`                                             |
| `PublicIp`                             | `Ip({ version: "v4" })`         | request-origin IPv4                                        |
| `TimeAgo` / `TimeBefore` / `TimeAfter` | `DateTime`                      | temporal `refine` guards, `{ within }` / `{ ref }` options |
| `RowVersion`                           | `Version({ type: "incr" })`     | optimistic record version                                  |
| `Mac`                                  | `Text`                          | MAC address                                                |
| `Domain`                               | `Text`                          | domain name without protocol                               |
| `Phone`                                | `Text`                          | E.164                                                      |
| `Brl`                                  | `Number({ int: true, min: 0 })` | monetary value in cents                                    |
| `ShortId`                              | `Text`                          | 21-char URL-safe id, `nanoid()` default                    |

## License

MIT © Leandro Santiago Gomes — see [LICENSE](https://github.com/leandroluk/morphz/blob/main/LICENSE).
