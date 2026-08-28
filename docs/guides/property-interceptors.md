# Property Interceptors

Zod's `z.preprocess()` runs **once** during `.parse()` and produces a static
plain object. Mutate a property afterwards (`user.id = "..."`) and nothing
intercepts it.

Because `morphz` instantiates **real classes**, meta-types built with `Define`
support `get` / `set` accessors, applied via `Object.defineProperty` in the
`Struct` constructor.

## Wire-format vs domain object

- **Wire-format** — the API and OpenAPI see a 100% serializable type (e.g. `Text`
  with a 24-hex-char regex).
- **Domain object** — your code manipulates a rich instance (e.g. MongoDB
  `ObjectId`, `Decimal`, a class of your own).

## Example — MongoDB `ObjectId`

```ts
import { ObjectId } from "mongodb";
import { Define, Text, Struct } from "morphz";

export const MongoId = Define(Text({ regex: /^[0-9a-fA-F]{24}$/ }), {
  description: "MongoDB ObjectId identifier for #entityName",
  // get: turn the raw stored value into a rich domain instance
  get: (accessor) => new ObjectId(accessor.value),
  // set: accept ObjectId or string, normalize what's stored internally
  set: (val: string | ObjectId, accessor) => {
    accessor.value = typeof val === "string" ? val : val.toHexString();
  },
});

export class User extends Struct({
  id: MongoId,
  name: Text({ min: 2 }),
}) {}
```

## Lifecycle

```ts
// 1. parse — validates the wire string, instantiates
const user = User.parse({ id: "507f1f77bcf86cd799439011", name: "John Doe" });

// 2. read (get) — returns the authentic ObjectId instance
user.id instanceof ObjectId; // true
user.id.getTimestamp(); // 2012-10-15T00:14:47.000Z

// 3. mutate (set) — accepts ObjectId or a compatible string
user.id = new ObjectId();
user.id = "507f191e810c19729de860ea";

// 4. serialize (toJSON) — back to the plain JSON-Schema-safe string
user.toJSON();
// { id: "507f191e810c19729de860ea", name: "John Doe" }
```

The accessor fires on **every** read and write, not just at parse time — so
encapsulation survives mutation.
