import { type } from "arktype";
import { TSense } from "../src/index.js";
import { connection } from "./config.js";

const UserSchema = type({
  "id?": "string",
  "email?": type("string").configure({
    sort: true,
  }),
  age: type("number.integer").configure({
    type: "int32",
    facet: false,
    sort: true,
    index: true,
  }),
  "company?": type.enumerated("netflix", "google").configure({
    type: "string",
    facet: true,
    sort: false,
    index: true,
  }),
  "phone?": "string",
  "active?": "boolean",
  "created_at?": "Date",
  name: type("string").configure({
    type: "string",
    facet: false,
    sort: true,
    index: true,
  }),
  "work_history?": type({
    company: "string",
    date: "string",
  })
    .array()
    .configure({
      type: "object[]",
      facet: false,
      sort: false,
      index: false,
    }),
});

export const UsersCollection = new TSense({
  name: "users",
  schema: UserSchema,
  connection,
  defaultSearchField: "name",
  timezone: "America/Sao_Paulo",
});

export type User = typeof UserSchema.infer;
