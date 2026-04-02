# TSense

Fully-typed Typesense client powered by [Arktype](https://arktype.io/).

Define your schema once. Get type-safe search, filtering, and automatic filter UIs — all from the same source of truth.

```bash
bun add tsense arktype
```

## Define a collection

```typescript
import { type } from "arktype";
import { TSense } from "tsense";

const Users = new TSense({
  name: "users",
  schema: type({
    "id?": "string",
    name: type("string").configure({ sort: true, index: true }),
    age: type("number.integer").configure({ type: "int32", sort: true }),
    company: type
      .enumerated("netflix", "google", "apple")
      .configure({ facet: true }),
    active: type("boolean").configure({ facet: true }),
    "joined_at?": "Date",
  }),
  connection: {
    host: "127.0.0.1",
    port: 8108,
    protocol: "http",
    apiKey: "xyz123",
  },
  defaultSearchField: "name",
});
```

## Search with typed filters

Operators are restricted per field type — the compiler catches invalid combinations.

```typescript
await Users.search({
  filter: {
    age: { gte: 18, lte: 40 },
    company: ["netflix", "google"],
    name: { not: "admin" },
  },
});
```

## Paginated lists

```typescript
const page1 = await Users.searchList({
  sortBy: "age:asc",
  filter: { active: true },
  limit: 20,
});

const page2 = await Users.searchList({
  sortBy: "age:asc",
  filter: { active: true },
  limit: 20,
  cursor: page1.nextCursor!,
});
```

## Count

```typescript
const total = await Users.count();
const active = await Users.count({ active: true });
```

## Multi-tenancy with scoped

`scoped()` returns a narrowed instance where a base filter is merged into every operation. The caller cannot override it.

```typescript
const myUsers = Users.scoped({ owner_id: currentUser.id });

await myUsers.search({ filter: { active: true } });
// filter_by = "active:=true && owner_id:=`user-1`"

await myUsers.count({ active: true });
await myUsers.deleteMany({ active: false });
```

## Build filter UIs from the schema

Declare which fields are filterable. tsense introspects the arktype schema, detects enums, and produces a descriptor that travels to the frontend as JSON.

```typescript
import { createFilterBuilder } from "tsense/filters";

const filters = createFilterBuilder(Users, {
  name: { label: "Name" },
  age: {
    label: "Age",
    presets: { "Over 18": { age: { gte: 18 } } },
  },
  company: {
    label: "Company",
    labels: { netflix: "Netflix", google: "Google", apple: "Apple" },
  },
  active: { label: "Active" },
  joined_at: { label: "Joined At" },
});

const descriptor = filters.describe();
```

## Render it

Drop the descriptor into the React component. The user picks columns, conditions, and values. You get a typed `FilterFor<User>` back.

```tsx
import { FilterBuilder } from "tsense/react";

<FilterBuilder descriptor={descriptor} onChange={(filter) => search(filter)} />;
```

Every slot is replaceable via render props — or use the headless `useFilterBuilder` hook for full control.

## Wire it end-to-end

Backend validates input with the filter builder schema, scopes results by user, and exposes the descriptor. Frontend renders the builder and fires queries.

```typescript
// backend
const filters = createFilterBuilder(Users, config);

const authed = base.use(({ context, next }) => {
  if (!context.user) throw new ORPCError("UNAUTHORIZED");
  return next({ context: { user: context.user } });
});

const router = base.router({
  search: authed
    .input(filters.schema())
    .handler(({ input, context }) =>
      Users.scoped({ owner_id: context.user.id }).search(input),
    ),
});
```

```tsx
// frontend
import { describe } from "./api/describe" with { type: "macro" };

const descriptor = describe();
const [filter, setFilter] = useState<typeof descriptor.infer>({});

<FilterBuilder descriptor={descriptor} onChange={setFilter} />;

const { data: results } = useQuery(api.search, { filter });
```

The descriptor is inlined at build time via [Bun macros](https://bun.sh/docs/bundler/macros) — no RPC call needed.

A working example with docker-compose, seed data, and a full UI lives in [`examples/`](./examples).
