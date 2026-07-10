import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { UsersCollection as collection } from "./helpers";

beforeAll(async () => {
  await collection.drop().catch(() => null);
  await collection.create();

  await collection.upsert([
    {
      id: "1",
      name: "Alice Williams",
      email: "alice@example.com",
      age: 22,
      active: true,
    },
    {
      id: "2",
      name: "Bob Smith",
      email: "bob@example.com",
      age: 30,
      active: false,
    },
    {
      id: "3",
      name: "Charlie Brown",
      email: "charlie@example.com",
      age: 35,
      active: true,
    },
    {
      id: "4",
      name: "David Lee",
      email: "david@example.com",
      age: 40,
      active: false,
    },
    {
      id: "5",
      name: "Eva Martinez",
      email: "eva@example.com",
      age: 45,
      active: true,
    },
    {
      id: "6",
      name: "Frank White",
      email: "frank@example.com",
      age: 45,
      active: false,
    },
  ]);
});

afterAll(async () => {
  await collection.drop().catch(() => null);
});

describe("advanced filtering", () => {
  it("should filter by array of strings", async () => {
    const result = await collection.search({
      filter: { name: ["Alice Williams", "Frank White"] },
    });

    expect(result.count).toBe(2);

    const names = result.data.map((d) => d.name).sort();
    expect(names).toEqual(["Alice Williams", "Frank White"]);
  });

  it("should filter by range with gte == lte (exact match)", async () => {
    const result = await collection.search({
      filter: { age: { gte: 30, lte: 30 } },
    });

    expect(result.count).toBe(1);
    expect(result.data[0].age).toBe(30);
  });

  it("should return empty results when gte > lte", async () => {
    const result = await collection.search({
      filter: { age: { gte: 50, lte: 20 } },
    });

    expect(result.count).toBe(0);
    expect(result.data.length).toBe(0);
  });

  it("should combine OR with additional AND filter", async () => {
    const result = await collection.search({
      filter: {
        OR: [{ age: 22 }, { age: 45 }],
        email: { not: "eva@example.com" },
      },
    });

    expect(result.count).toBeGreaterThanOrEqual(2);

    for (const doc of result.data) {
      expect(doc.email).not.toBe("eva@example.com");
      expect([22, 45]).toContain(doc.age);
    }
  });

  it("should ignore undefined filter values", async () => {
    const result = await collection.search({
      filter: {
        age: undefined as any,
        name: "David Lee",
      },
    });

    expect(result.count).toBe(1);
    expect(result.data[0].name).toBe("David Lee");
  });

  it("should filter optional strings that are present", async () => {
    const result = await collection.search({
      filter: { email: { not: null } },
    });

    expect(result.count).toBe(6);
  });

  it("should negate boolean filters", async () => {
    const result = await collection.search({
      filter: { active: { not: true } },
    });

    expect(result.data.map((document) => document.name).sort()).toEqual([
      "Bob Smith",
      "David Lee",
      "Frank White",
    ]);
  });

  it("should handle nested OR conditions", async () => {
    const result = await collection.search({
      filter: {
        OR: [
          { age: 22 },
          {
            OR: [{ age: 40, name: "David Lee" }, { age: 45 }],
          },
        ],
      },
    });

    expect(result.count).toBe(4);

    const ages = result.data.map((d) => d.age).sort();
    expect(ages).toEqual([22, 40, 45, 45]);

    const names = result.data.map((d) => d.name).sort();
    expect(names).toEqual([
      "Alice Williams",
      "David Lee",
      "Eva Martinez",
      "Frank White",
    ]);
  });
});
