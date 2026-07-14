import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { type } from "arktype";
import type { FieldTransformer } from "../src/index";
import { DateTransformer, defaultTransformers, TSense } from "../src/index";
import { connection } from "./config";

const PostSchema = type({
  id: "string",
  title: "string",
  created_at: "Date",
  "updated_at?": "Date",
});

const PostsCollection = new TSense({
  name: "posts_test",
  schema: PostSchema,
  connection,
  defaultSearchField: "title",
});

beforeAll(async () => {
  await PostsCollection.drop().catch(() => null);
  await PostsCollection.create();
});

afterAll(async () => {
  await PostsCollection.drop().catch(() => null);
});

describe("DateTransformer", () => {
  describe("match", () => {
    it("should match Date expression", () => {
      expect(DateTransformer.match("Date")).toBe(true);
    });

    it("should match Date domain", () => {
      expect(DateTransformer.match("string", "Date")).toBe(true);
    });

    it("should not match string", () => {
      expect(DateTransformer.match("string")).toBe(false);
    });

    it("should not match number", () => {
      expect(DateTransformer.match("number")).toBe(false);
    });
  });

  describe("serialize/deserialize", () => {
    it("should serialize Date to timestamp", () => {
      const date = new Date("2024-01-15T10:30:00.000Z");
      const timestamp = DateTransformer.serialize(date);

      expect(typeof timestamp).toBe("number");
      expect(timestamp).toBe(date.getTime());
    });

    it("should deserialize timestamp to Date", () => {
      const timestamp = 1_705_315_800_000;
      const date = DateTransformer.deserialize(timestamp);

      expect(date instanceof Date).toBe(true);
      expect(date.getTime()).toBe(timestamp);
    });

    it("should round-trip correctly", () => {
      const original = new Date("2024-06-15T14:30:00.000Z");
      const serialized = DateTransformer.serialize(original);
      const deserialized = DateTransformer.deserialize(serialized);

      expect(deserialized.getTime()).toBe(original.getTime());
    });
  });
});

describe("TSense with Date fields", () => {
  it("should upsert with native Date", async () => {
    const now = new Date();

    const result = await PostsCollection.upsert({
      id: "post-1",
      title: "Hello World",
      created_at: now,
    });

    expect(result[0].success).toBe(true);
  });

  it("should return Date from get", async () => {
    const post = await PostsCollection.get("post-1");

    expect(post).not.toBeNull();
    expect(post!.created_at instanceof Date).toBe(true);
  });

  it("should return Date from search", async () => {
    const { data } = await PostsCollection.search({
      filter: { id: "post-1" },
    });

    expect(data.length).toBe(1);
    expect(data[0].created_at instanceof Date).toBe(true);
  });

  it("should filter with Date range", async () => {
    const yesterday = new Date(Date.now() - 86_400_000);
    const tomorrow = new Date(Date.now() + 86_400_000);

    const { data } = await PostsCollection.search({
      filter: {
        created_at: { gte: yesterday, lte: tomorrow },
      },
    });

    expect(data.length).toBeGreaterThan(0);
  });

  it("should update with Date", async () => {
    const newDate = new Date("2024-12-25T00:00:00.000Z");

    const updated = await PostsCollection.update("post-1", {
      updated_at: newDate,
    });

    expect(updated.updated_at instanceof Date).toBe(true);
    expect(updated.updated_at!.getTime()).toBe(newDate.getTime());
  });

  it("should preserve Date value in full round-trip", async () => {
    const originalDate = new Date("2024-07-04T12:00:00.000Z");

    await PostsCollection.upsert({
      id: "post-roundtrip",
      title: "Round Trip Test",
      created_at: originalDate,
    });

    const retrieved = await PostsCollection.get("post-roundtrip");

    expect(retrieved).not.toBeNull();
    expect(retrieved!.created_at.getTime()).toBe(originalDate.getTime());
  });

  it("should not serialize undefined optional Date", async () => {
    const result = await PostsCollection.upsert({
      id: "post-no-updated",
      title: "No Updated At",
      created_at: new Date(),
      updated_at: undefined,
    });

    expect(result[0].success).toBe(true);

    const retrieved = await PostsCollection.get("post-no-updated");

    expect(retrieved).not.toBeNull();
    expect(retrieved!.updated_at).toBeUndefined();
  });

  it("should filter with direct Date value", async () => {
    const specificDate = new Date("2024-08-15T00:00:00.000Z");

    await PostsCollection.upsert({
      id: "post-specific-date",
      title: "Specific Date Post",
      created_at: specificDate,
    });

    const { data } = await PostsCollection.search({
      filter: { created_at: specificDate },
    });

    expect(data.length).toBe(1);
    expect(data[0].id).toBe("post-specific-date");
  });

  it("should paginate with Date cursor in searchList", async () => {
    await PostsCollection.upsert([
      {
        id: "cursor-1",
        title: "First",
        created_at: new Date("2024-01-01T00:00:00.000Z"),
      },
      {
        id: "cursor-2",
        title: "Second",
        created_at: new Date("2024-02-01T00:00:00.000Z"),
      },
      {
        id: "cursor-3",
        title: "Third",
        created_at: new Date("2024-03-01T00:00:00.000Z"),
      },
    ]);

    const page1 = await PostsCollection.searchList({
      sortBy: "created_at:asc",
      limit: 2,
    });

    expect(page1.data.length).toBe(2);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await PostsCollection.searchList({
      sortBy: "created_at:asc",
      limit: 2,
      cursor: page1.nextCursor!,
    });

    expect(page2.data[0].id).not.toBe(page1.data[0].id);
    expect(page2.data[0].id).not.toBe(page1.data[1].id);
  });
});

describe("custom transformers", () => {
  it("should allow custom transformers", () => {
    const BigIntTransformer: FieldTransformer<bigint, string> = {
      match: (expr) => expr === "bigint",
      storageType: "string",
      serialize: (n) => n.toString(),
      deserialize: BigInt,
    };

    const CustomSchema = type({
      id: "string",
      name: "string",
    });

    const CustomCollection = new TSense({
      name: "custom_test",
      schema: CustomSchema,
      connection,
      transformers: [
        ...defaultTransformers,
        BigIntTransformer,
      ] as FieldTransformer[],
    });

    expect(CustomCollection).toBeDefined();
  });
});

describe("primitive unions", () => {
  it("infers nullish primitive unions as optional primitive fields", () => {
    const schema = type({
      nullableBoolean: "boolean | null",
      nullableDate: "Date | null",
      nullableInteger: "number.integer | null",
      nullableNumber: "number | null",
      optionalBoolean: "boolean | undefined",
      optionalString: "string | undefined",
    });

    const collection = new TSense({
      name: "primitive_unions_test",
      schema,
      connection,
    });

    expect(collection.fields).toEqual([
      expect.objectContaining({
        name: "nullableBoolean",
        type: "bool",
        optional: true,
      }),
      expect.objectContaining({
        name: "nullableDate",
        type: "int64",
        optional: true,
      }),
      expect.objectContaining({
        name: "nullableInteger",
        type: "int64",
        optional: true,
      }),
      expect.objectContaining({
        name: "nullableNumber",
        type: "float",
        optional: true,
      }),
      expect.objectContaining({
        name: "optionalBoolean",
        type: "bool",
        optional: true,
      }),
      expect.objectContaining({
        name: "optionalString",
        type: "string",
        optional: true,
      }),
    ]);
  });
});
