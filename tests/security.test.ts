import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { UsersCollection as collection } from "./helpers";

beforeAll(async () => {
  await collection.drop().catch(() => null);
  await collection.create();

  await collection.upsert([
    { id: "1", name: "Alice", email: "alice@test.com", age: 25 },
    { id: "2", name: "Bob", email: "bob@test.com", age: 30 },
    { id: "3", name: "Charlie", email: "charlie@test.com", age: 35 },
  ]);
});

afterAll(async () => {
  await collection.drop().catch(() => null);
});

describe("filter injection", () => {
  it("should not allow OR injection via string value", async () => {
    const result = await collection.search({
      filter: { name: "nobody || age:>0" },
    });

    expect(result.count).toBe(0);
  });

  it("should not allow AND injection via string value", async () => {
    const result = await collection.search({
      filter: { name: "nobody && age:>0" },
    });

    expect(result.count).toBe(0);
  });

  it("should not allow injection via not operator", async () => {
    const result = await collection.search({
      filter: { name: { not: "x` || age:>0" } },
    });

    expect(result.count).toBe(3);
  });

  it("should not allow injection via array values", async () => {
    const result = await collection.search({
      filter: { name: ["nobody || age:>0", "also nobody"] },
    });

    expect(result.count).toBe(0);
  });

  it("should not allow injection via notIn operator", async () => {
    const result = await collection.search({
      filter: { name: { notIn: ["x` || age:>0"] } },
    });

    expect(result.count).toBe(3);
  });

  it("should strip backticks from string values", async () => {
    const result = await collection.search({
      filter: { name: "`injected`" },
    });

    expect(result.count).toBe(0);
  });

  it("should handle normal strings with spaces correctly", async () => {
    await collection.upsert([
      { id: "4", name: "John Doe", email: "john@test.com", age: 28 },
    ]);

    const result = await collection.search({
      filter: { name: "John Doe" },
    });

    expect(result.count).toBe(1);
    expect(result.data[0].name).toBe("John Doe");
  });
});

describe("field validation", () => {
  it("should reject invalid queryBy fields", async () => {
    expect(
      collection.search({
        queryBy: ["nonexistent_field"] as any,
      }),
    ).rejects.toThrow();
  });

  it("should reject invalid sortBy fields", async () => {
    expect(
      collection.search({
        sortBy: ["nonexistent_field:asc"] as any,
      }),
    ).rejects.toThrow();
  });

  it("should reject invalid facetBy fields", async () => {
    expect(
      collection.search({
        facetBy: ["nonexistent_field"] as any,
      }),
    ).rejects.toThrow();
  });

  it("should reject invalid filter fields", async () => {
    expect(
      collection.search({
        filter: { nonexistent_field: "x" } as any,
      }),
    ).rejects.toThrow();
  });

  it("should reject invalid filter fields inside OR", async () => {
    expect(
      collection.search({
        filter: { OR: [{ nonexistent_field: "x" }] } as any,
      }),
    ).rejects.toThrow();
  });

  it("should accept valid queryBy fields", async () => {
    const result = await collection.search({
      queryBy: ["name", "email"],
    });

    expect(result.count).toBeGreaterThan(0);
  });

  it("should accept valid sortBy fields", async () => {
    const result = await collection.search({
      sortBy: ["age:asc"],
    });

    expect(result.count).toBeGreaterThan(0);
  });

  it("should accept score as sortBy", async () => {
    const result = await collection.search({
      query: "Alice",
      sortBy: ["score:desc"],
    });

    expect(result.count).toBeGreaterThan(0);
  });

  it("should accept valid facetBy fields", async () => {
    const result = await collection.search({
      facetBy: ["company"],
    });

    expect(result.count).toBeGreaterThan(0);
  });
});
