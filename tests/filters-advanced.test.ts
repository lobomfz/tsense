import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { UsersCollection as collection } from "./helpers";

beforeAll(async () => {
  await collection.drop().catch(() => null);
  await collection.create();

  // Seed test data
  await collection.upsert([
    {
      id: "1",
      name: "Alice Williams",
      email: "alice@example.com",
      age: 22,
    },
    {
      id: "2",
      name: "Bob Smith",
      email: "bob@example.com",
      age: 30,
    },
    {
      id: "3",
      name: "Charlie Brown",
      email: "charlie@example.com",
      age: 35,
    },
    {
      id: "4",
      name: "David Lee",
      email: "david@example.com",
      age: 40,
    },
    {
      id: "5",
      name: "Eva Martinez",
      email: "eva@example.com",
      age: 45,
    },
    {
      id: "6",
      name: "Frank White",
      email: "frank@example.com",
      age: 45,
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

  it("should filter by range with min == max (exact match)", async () => {
    const result = await collection.search({
      filter: { age: { min: 30, max: 30 } },
    });

    expect(result.count).toBe(1);
    expect(result.data[0].age).toBe(30);
  });

  it("should return empty results when min > max", async () => {
    const result = await collection.search({
      filter: { age: { min: 50, max: 20 } },
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

    // Should get Alice (22) and Frank (45), but not Eva (45)
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

    // Should only filter by name, ignoring undefined age
    expect(result.count).toBe(1);
    expect(result.data[0].name).toBe("David Lee");
  });

  it("should handle nested OR conditions", async () => {
    const result = await collection.search({
      filter: {
        OR: [
          { age: 22 }, // Alice
          {
            OR: [
              { age: 40, name: "David" }, // David
              { age: 45 }, // Eva and Frank
            ],
          },
        ],
      },
    });

    // Should get Alice (22), David (40), Eva (45), and Frank (45)
    expect(result.count).toBe(4);

    const ages = result.data.map((d) => d.age).sort();
    expect(ages).toEqual([22, 40, 45, 45]);

    const names = result.data.map((d) => d.name).sort();
    expect(names).toEqual(["Alice Williams", "David Lee", "Eva Martinez", "Frank White"]);
  });
});
