# Example — User and Post

A full walkthrough: reusable meta-types, an embedded value object, cascading
labels, cross-field hooks, a scalar foreign key with `FieldOf`, a lazy relation
with `Ref`, DTO derivations, and the parse / serialize cycle.

## Meta-types

```ts
import {
  Define,
  Struct,
  Text,
  Email,
  Password,
  Enum,
  Union,
  Literal,
  Uuid,
  Timestamp,
  DateTime,
  Nullable,
  Optional,
  Embed,
  List,
  Ref,
  FieldOf,
} from "morphz";

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

export const Cep = Define(Text, {
  description: "Formatted postal code (CEP)",
  regex: /^\d{5}-\d{3}$/,
  examples: ["01001-000"],
});

export const Slug = Define(Text, {
  description: "Friendly textual identifier (slug) of #entityName",
  regex: /^[a-z0-9-]+$/,
});
```

## Embedded value object

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

## Entities

```ts
export enum UserRole {
  ADMIN = "ADMIN",
  USER = "USER",
}

export class User extends Struct(
  {
    id: PrimaryKey(),
    createdAt: CreatedAt(),
    updatedAt: UpdatedAt(),
    deletedAt: DeletedAt(),

    name: Text({ min: 2, max: 50, description: "Full name" }),
    username: Slug(),
    email: Email({ description: "Corporate email" }),
    password: Password({ description: "Password hash", writeOnly: true }),
    role: Enum(UserRole, { default: UserRole.USER }),

    address: Optional(Embed(Address)),
    tags: List(Text(), { default: () => [] }),
    posts: Optional(List(Ref(() => Post))),
  },
  {
    labels: { entityName: "User", module: "Account Management" },
    description: "User account entity",
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

export class Post extends Struct(
  {
    id: PrimaryKey(),
    createdAt: CreatedAt(),
    updatedAt: UpdatedAt(),
    deletedAt: DeletedAt(),

    userId: FieldOf(User, "id", { description: "Foreign key pointing at the Post author" }),
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

## Parse, instantiate, serialize

```ts
const user = User.parse({
  name: "John Doe",
  username: "JohnDoe", // pre hook lowercases → "johndoe"
  email: "john@company.com",
  password: "secret_hash_value",
  address: { street: "Main St", number: "100", city: "Springfield", zipCode: "01001-000" },
});

user instanceof User; // true
user.id; // uuid — from PrimaryKey default
user.createdAt instanceof Date; // true — Timestamp codec decodes to Date
user.isAdmin(); // false
user.address?.fullAddress; // "Main St, 100 - Springfield (01001-000)"

user.toJSON();
// password is omitted (writeOnly); createdAt/updatedAt encoded to ISO strings
```

## Safe parse at the HTTP boundary

```ts
app.post("/users", (req, res) => {
  const result = User.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.errors });
  }
  const user = result.data; // real User instance
  // ...persist
  res.status(201).json(user.toJSON());
});
```

## DTOs

```ts
// create: strip server-owned fields
export class CreateUserDto extends User.omit(
  "id",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "posts",
) {}

// patch: immutable id/createdAt are already rejected — only drop the secret
export class PatchUserDto extends User.omit("password").partial() {}

// admin variant: real subclass, transitive instanceof
export class AdminUser extends User.extend({
  department: Text({ description: "Admin department" }),
  permissions: List(Text(), { default: () => ["READ", "WRITE"] }),
}) {
  canExecute(action: string): boolean {
    return this.permissions.includes(action) || this.isAdmin();
  }
}
```

## Fixtures

```ts
const admin = AdminUser.mock({ role: UserRole.ADMIN, email: "admin@company.com" });
admin instanceof User; // true
admin.canExecute("DELETE"); // true

const users = User.mockMany(5, (i) => ({ email: `user-${i}@company.com` }));
```
