import { type } from "arktype";
import { TSense } from "tsense";
import { createFilterBuilder } from "tsense/filters";

const UserSchema = type({
  "id?": "string",
  owner_id: type("string").configure({ type: "string", index: true }),
  name: type("string").configure({ type: "string", sort: true, index: true }),
  email: type("string").configure({
    type: "string",
    sort: true,
    index: true,
  }),
  age: type("number.integer").configure({
    type: "int32",
    sort: true,
    index: true,
  }),
  company: type.enumerated("netflix", "google", "apple").configure({
    type: "string",
    facet: true,
    index: true,
  }),
  active: type("boolean").configure({ type: "bool", facet: true, index: true }),
  "joined_at?": "Date",
});

export type User = typeof UserSchema.infer;

export const collection = new TSense({
  name: "users",
  schema: UserSchema,
  connection: {
    host: "127.0.0.1",
    port: 8108,
    protocol: "http",
    apiKey: "xyz123",
  },
  defaultSearchField: "name",
});

export const builder = createFilterBuilder(collection, {
  name: { label: "Name" },
  email: { label: "Email" },
  age: {
    label: "Age",
    presets: {
      "Over 18": { age: { gte: 18 } },
      "Under 30": { age: { lt: 30 } },
    },
  },
  company: {
    label: "Company",
    labels: { netflix: "Netflix", google: "Google", apple: "Apple" },
  },
  active: { label: "Active" },
  joined_at: { label: "Joined At" },
});
