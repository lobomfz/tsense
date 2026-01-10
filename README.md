# TSense

Opinionated, fully-typed Typesense client powered by [Arktype](https://arktype.io/)

## Installation

```bash
bun add tsense arktype
```

## Example

```typescript
import { type } from "arktype";
import { TSense } from "tsense";

const UsersCollection = new TSense({
  name: "users",
  schema: type({
    "id?": "string",
    email: "string",
    age: type("number.integer").configure({ type: "int32", sort: true }),
    "company?": type.enumerated("netflix", "google").configure({ facet: true }),
    "phone?": "string",
    name: type("string").configure({ sort: true }),
    "work_history?": type({
      company: "string",
      date: "string",
    })
      .array()
      .configure({ type: "object[]", index: false }),
  }),
  connection: {
    host: "127.0.0.1",
    port: 8108,
    protocol: "http",
    apiKey: "123",
  },
  defaultSearchField: "name",
  validateOnUpsert: true,
});

type User = typeof UsersCollection.infer;

await UsersCollection.create();

await UsersCollection.upsert([
  { id: "1", email: "john@example.com", age: 30, name: "John Doe", company: "netflix" },
  { id: "2", email: "jane@example.com", age: 25, name: "Jane Smith", company: "google" },
]);

const results = await UsersCollection.search({
  query: "john",
  queryBy: ["name", "email"],
  sortBy: ["age:desc", "name:asc"],
  filter: {
    age: { min: 20 },
    OR: [{ company: "google" }, { company: "netflix" }],
  },
});

const faceted = await UsersCollection.search({
  query: "john",
  facetBy: ["company"],
});

const highlighted = await UsersCollection.search({
  query: "john",
  highlight: true,
});

await UsersCollection.drop();
```

## API Reference

### Schema Configuration

Use `.configure()` to set Typesense field options:

```typescript
type("string").configure({
  type: "string",
  facet: true,
  sort: true,
  index: true,
});
```

### Collection Methods

| Method | Description |
| ------ | ----------- |
| `create()` | Creates the collection in Typesense |
| `drop()` | Deletes the collection |
| `get(id)` | Retrieves a document by ID |
| `delete(id)` | Deletes a document by ID |
| `deleteMany(filter)` | Deletes documents matching filter |
| `update(id, data)` | Updates a document by ID |
| `updateMany(filter, data)` | Updates documents matching filter |
| `upsert(docs)` | Inserts or updates documents |
| `search(options)` | Searches the collection |


### Filter Syntax

```typescript
filter: { name: "John" }                    // Exact match
filter: { age: 30 }                         // Numeric match
filter: { age: [25, 30, 35] }               // IN
filter: { age: { min: 20, max: 40 } }       // Range
filter: { name: { not: "John" } }           // Not equal
filter: { OR: [{ age: 25 }, { age: 30 }] }  // OR conditions
```