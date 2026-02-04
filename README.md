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

| Method/Property | Description |
| --------------- | ----------- |
| `create()` | Creates the collection in Typesense |
| `drop()` | Deletes the collection |
| `get(id)` | Retrieves a document by ID |
| `delete(id)` | Deletes a document by ID |
| `deleteMany(filter)` | Deletes documents matching filter |
| `update(id, data)` | Updates a document by ID |
| `updateMany(filter, data)` | Updates documents matching filter |
| `upsert(docs)` | Inserts or updates documents |
| `search(options)` | Searches the collection |
| `syncSchema()` | Syncs schema (creates/patches collection) |
| `syncData(options)` | Syncs data from external source |
| `fields` | Array of generated field schemas |

### Schema Sync

Automatically sync schema before the first operation:

```typescript
const Collection = new TSense({
  // ...
  autoSyncSchema: true,
});
```

Or manually:

```typescript
await Collection.syncSchema();
```

### Data Sync

Sync documents from an external source (database, API, etc.):

```typescript
const Collection = new TSense({
  // ...
  dataSync: {
    getAllIds: async () => {
      return db.selectFrom("users").select("id").execute().then(rows => rows.map(r => r.id));
    },
    getItems: async (ids) => {
      return db.selectFrom("users").where("id", "in", ids).execute();
    },
    chunkSize: 100, // optional, default 500
  },
});

// Full sync
await Collection.syncData();

// Partial sync (specific IDs)
await Collection.syncData({ ids: ["id1", "id2"] });

// Full sync + remove orphan documents
await Collection.syncData({ purge: true });

// Override chunk size
await Collection.syncData({ chunkSize: 50 });
```

### Filter Syntax

```typescript
filter: { name: "John" }                    // Exact match
filter: { age: 30 }                         // Numeric match
filter: { age: [25, 30, 35] }               // IN
filter: { age: { min: 20, max: 40 } }       // Range
filter: { name: { not: "John" } }           // Not equal
filter: { OR: [{ age: 25 }, { age: 30 }] }  // OR conditions
```