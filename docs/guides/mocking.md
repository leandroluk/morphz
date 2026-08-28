# Mocks and Fixtures

Every field in a `Struct` already carries full semantic metadata (`format`,
`regex`, `min`, `max`, `examples`, `default`), so `morphz` can synthesize
schema-valid instances natively — no external factory library.

## `Entity.mock(overrides?)`

Returns a **real instance** of the entity (passes `instanceof`, domain methods
available), with every field populated per the schema:

- fields with `examples` use one of the declared examples
- fields with `default` use the default generator
- fields with constraints (`min`, `max`, `regex`) get values synthesized within
  the validation bounds

```ts
import { User, UserRole } from "./user.entity";

it("computes permissions for an admin user", () => {
  const admin = User.mock({
    role: UserRole.ADMIN,
    email: "admin@example.com",
  });

  expect(admin).toBeInstanceOf(User);
  expect(admin.isAdmin()).toBe(true);
  expect(typeof admin.id).toBe("string");
  expect(admin.createdAt).toBeInstanceOf(Date);
});
```

Overrides are typed — autocomplete narrows to the entity's fields, and you only
set what the scenario cares about.

## `Entity.mockMany(count, fn?)`

Batch fixtures for seeding or list assertions. The optional callback receives the
index:

```ts
const batch = User.mockMany(10, (index) => ({
  email: `user-${index}@example.com`,
}));

expect(batch).toHaveLength(10);
```

## When to reach for it

- unit tests that need a valid aggregate without hand-writing every field
- E2E setup / database seeding
- property-based style checks where only one or two fields matter per case
