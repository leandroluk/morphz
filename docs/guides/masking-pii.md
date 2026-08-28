# Masking PII / LGPD

Personal data must not leak into observability logs (Sentry, CloudWatch,
Datadog) or public endpoint responses. `morphz` adds a `mask` modifier at the
`Define` / `Struct` level plus a `.toMaskedJSON()` serializer.

## Declare reusable masks

```ts
import { Define, Text } from "morphz";

export const Email = Define(Text, {
  format: "email",
  mask: (email: string) => {
    const [user, domain] = email.split("@");
    return `${user.slice(0, 2)}***@${domain}`;
  },
});

export const DocumentCpf = Define(Text, {
  regex: /^\d{3}\.\d{3}\.\d{3}-\d{2}$/,
  mask: (cpf: string) => cpf.replace(/^(\d{3})\.\d{3}\.\d{3}-(\d{2})$/, "$1.***.***-$2"),
});
```

## Serialize

```ts
const user = User.parse({
  name: "John Doe",
  email: "john.doe@example.com",
  password: "super_secret_hash",
});

// A. Standard serialization — hides writeOnly fields (password)
user.toJSON();
// { id: "...", name: "John Doe", email: "john.doe@example.com" }

// B. Masked serialization — applies registered mask functions
user.toMaskedJSON();
// { id: "...", name: "John Doe", email: "jo***@example.com" }

// C. In observability logs
logger.info("User session initialized", { user: user.toMaskedJSON() });
```

## `toJSON` vs `toMaskedJSON`

|                              | `toJSON()`           | `toMaskedJSON()`          |
| ---------------------------- | -------------------- | ------------------------- |
| `writeOnly: true` fields     | dropped              | dropped                   |
| codec fields (`DateTime`, …) | encoded to wire form | encoded to wire form      |
| fields with a `mask`         | passed through as-is | replaced by `mask(value)` |

Use `toJSON()` for API responses to authorized clients; `toMaskedJSON()` for
logs, analytics, and any surface where PII should not appear in the clear.
