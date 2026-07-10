import { afterEach, describe, expect, it } from "bun:test";
import { type } from "arktype";
import redaxios from "redaxios";
import { TSense } from "../src/index";
import { connection } from "./config";

const axios = (redaxios as { default?: typeof redaxios }).default ?? redaxios;

const baseURL = `${connection.protocol}://${connection.host}:${connection.port}`;
const headers = { "X-TYPESENSE-API-KEY": connection.apiKey };

const dropCollection = async (name: string) => {
  await axios({
    method: "DELETE",
    baseURL,
    url: `/collections/${name}`,
    headers,
  }).catch(() => null);
};

const getCollection = async (name: string) => {
  return await axios<{ fields: { name: string; type: string }[] }>({
    method: "GET",
    baseURL,
    url: `/collections/${name}`,
    headers,
  })
    .then((res) => res.data)
    .catch(() => null);
};

describe("sync", () => {
  const collectionName = "sync_test";

  afterEach(async () => {
    await dropCollection(collectionName);
  });

  it("creates collection if not exists", async () => {
    const schema = type({
      "id?": "string",
      name: "string",
      age: "number.integer",
    });

    const collection = new TSense({
      name: collectionName,
      schema,
      connection,
      defaultSearchField: "name",
    });

    await collection.syncSchema();

    expect(await collection.health()).toBe(true);

    const info = await collection.retrieve();
    const remote = await getCollection(collectionName);
    expect(info?.name).toBe(collectionName);
    expect(remote).not.toBeNull();
    expect(remote?.fields.some((f) => f.name === "name")).toBe(true);
    expect(remote?.fields.some((f) => f.name === "age")).toBe(true);
  });

  it("does nothing if schema matches", async () => {
    const schema = type({
      "id?": "string",
      name: "string",
      age: "number.integer",
    });

    const collection = new TSense({
      name: collectionName,
      schema,
      connection,
      defaultSearchField: "name",
    });

    await collection.syncSchema();
    await collection.syncSchema();

    const remote = await getCollection(collectionName);
    expect(remote).not.toBeNull();
  });

  it("patches schema when fields are added", async () => {
    const initialSchema = type({
      "id?": "string",
      name: "string",
    });

    const initialCollection = new TSense({
      name: collectionName,
      schema: initialSchema,
      connection,
      defaultSearchField: "name",
    });

    await initialCollection.syncSchema();

    const updatedSchema = type({
      "id?": "string",
      name: "string",
      email: "string",
    });

    const updatedCollection = new TSense({
      name: collectionName,
      schema: updatedSchema,
      connection,
      defaultSearchField: "name",
    });

    await updatedCollection.syncSchema();

    const remote = await getCollection(collectionName);
    expect(remote?.fields.some((f) => f.name === "email")).toBe(true);
  });

  it("patches schema when fields are removed", async () => {
    const initialSchema = type({
      "id?": "string",
      name: "string",
      email: "string",
    });

    const initialCollection = new TSense({
      name: collectionName,
      schema: initialSchema,
      connection,
      defaultSearchField: "name",
    });

    await initialCollection.syncSchema();

    const updatedSchema = type({
      "id?": "string",
      name: "string",
    });

    const updatedCollection = new TSense({
      name: collectionName,
      schema: updatedSchema,
      connection,
      defaultSearchField: "name",
    });

    await updatedCollection.syncSchema();

    const remote = await getCollection(collectionName);
    expect(remote?.fields.some((f) => f.name === "email")).toBe(false);
  });

  it("patches schema when fields are modified", async () => {
    const initialSchema = type({
      "id?": "string",
      name: "string",
      count: type("number.integer").configure({
        type: "int32",
        facet: false,
      }),
    });

    const initialCollection = new TSense({
      name: collectionName,
      schema: initialSchema,
      connection,
      defaultSearchField: "name",
    });

    await initialCollection.syncSchema();

    const updatedSchema = type({
      "id?": "string",
      name: "string",
      count: type("number.integer").configure({
        type: "int32",
        facet: true,
      }),
    });

    const updatedCollection = new TSense({
      name: collectionName,
      schema: updatedSchema,
      connection,
      defaultSearchField: "name",
    });

    await updatedCollection.syncSchema();

    const remote = await getCollection(collectionName);
    const countField = remote?.fields.find((f) => f.name === "count");
    expect((countField as { facet?: boolean })?.facet).toBe(true);
  });

  it("requires an explicit recreate if patch fails", async () => {
    const initialSchema = type({
      "id?": "string",
      name: "string",
      count: "string",
    });

    const initialCollection = new TSense({
      name: collectionName,
      schema: initialSchema,
      connection,
      defaultSearchField: "name",
    });

    await initialCollection.syncSchema();

    await initialCollection.upsert({ id: "1", name: "test", count: "ten" });

    const updatedSchema = type({
      "id?": "string",
      name: "string",
      count: type("number.integer").configure({
        type: "int32",
      }),
    });

    const updatedCollection = new TSense({
      name: collectionName,
      schema: updatedSchema,
      connection,
      defaultSearchField: "name",
    });

    expect(() => updatedCollection.syncSchema()).toThrow(
      "SCHEMA_RECREATE_REQUIRED",
    );

    const remote = await getCollection(collectionName);
    const countField = remote?.fields.find((f) => f.name === "count");
    expect(countField?.type).toBe("string");

    const document = await initialCollection.get("1");
    expect(document?.name).toBe("test");
  });

  it("requires an explicit recreate when default sorting field changes", async () => {
    const schema = type({
      "id?": "string",
      name: type("string").configure({ sort: true }),
      age: type("number.integer").configure({ sort: true }),
    });

    const initialCollection = new TSense({
      name: collectionName,
      schema,
      connection,
      defaultSearchField: "name",
      defaultSortingField: "name",
    });

    await initialCollection.syncSchema();
    await initialCollection.upsert({ id: "1", name: "test", age: 10 });

    const updatedCollection = new TSense({
      name: collectionName,
      schema,
      connection,
      defaultSearchField: "name",
      defaultSortingField: "age",
    });

    expect(() => updatedCollection.syncSchema()).toThrow(
      "SCHEMA_RECREATE_REQUIRED",
    );

    const document = await initialCollection.get("1");
    expect(document?.name).toBe("test");
  });

  it("ignores materialized nested fields", async () => {
    const schema = type({
      "id?": "string",
      name: "string",
      profile: type({ color: "string", quantity: "number.integer" }).configure({
        type: "object",
      }),
    });

    const collection = new TSense({
      name: collectionName,
      schema,
      connection,
      defaultSearchField: "name",
    });

    await collection.syncSchema();
    await collection.upsert({
      id: "1",
      name: "test",
      profile: { color: "red", quantity: 3 },
    });

    const remote = await getCollection(collectionName);
    expect(remote?.fields.some((field) => field.name.includes("."))).toBe(true);

    await collection.syncSchema();

    const document = await collection.get("1");
    expect(document?.profile.color).toBe("red");
  });
});

describe("schema inference", () => {
  it("infers arrays of string literals as string arrays", () => {
    const schema = type({
      id: "string",
      categories: type.enumerated("one", "two").array(),
    });

    const collection = new TSense({
      name: "literal_array_test",
      schema,
      connection,
      defaultSearchField: "id",
    });

    expect(
      collection.fields.find((field) => field.name === "categories")?.type,
    ).toBe("string[]");
  });
});

describe("autoSync", () => {
  const collectionName = "autosync_test";

  afterEach(async () => {
    await dropCollection(collectionName);
  });

  it("triggers sync on first operation (upsert)", async () => {
    const schema = type({
      "id?": "string",
      name: "string",
      age: "number.integer",
    });

    const collection = new TSense({
      name: collectionName,
      schema,
      connection,
      defaultSearchField: "name",
      autoSyncSchema: true,
    });

    const beforeSync = await getCollection(collectionName);
    expect(beforeSync).toBeNull();

    await collection.upsert({ id: "1", name: "Test User", age: 25 });

    const afterSync = await getCollection(collectionName);
    expect(afterSync).not.toBeNull();
    expect(afterSync?.fields.some((f) => f.name === "name")).toBe(true);
  });

  it("only syncs once (not on every operation)", async () => {
    const schema = type({
      "id?": "string",
      name: "string",
    });

    const collection = new TSense({
      name: collectionName,
      schema,
      connection,
      defaultSearchField: "name",
      autoSyncSchema: true,
    });

    await collection.upsert({ id: "1", name: "First" });
    await collection.upsert({ id: "2", name: "Second" });
    await collection.upsert({ id: "3", name: "Third" });

    const result = await collection.search({});
    expect(result.count).toBe(3);
  });

  it("allows manual sync without autoSync", async () => {
    const schema = type({
      "id?": "string",
      name: "string",
    });

    const collection = new TSense({
      name: collectionName,
      schema,
      connection,
      defaultSearchField: "name",
    });

    await collection.syncSchema();

    const remote = await getCollection(collectionName);
    expect(remote).not.toBeNull();

    await collection.upsert({ id: "1", name: "Test" });

    const result = await collection.search({});
    expect(result.count).toBe(1);
  });

  it("recreates a collection without requiring data sync", async () => {
    const schema = type({
      "id?": "string",
      name: "string",
    });

    const collection = new TSense({
      name: collectionName,
      schema,
      connection,
      defaultSearchField: "name",
    });

    await collection.create();
    await collection.upsert({ id: "1", name: "test" });
    await collection.recreate();

    expect(await collection.count()).toBe(0);
  });
});
