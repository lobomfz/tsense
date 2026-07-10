import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { UsersCollection as collection } from "./helpers";

beforeAll(async () => {
  await collection.drop().catch(() => null);
  await collection.create();

  await collection.upsert([
    {
      id: "20",
      name: "David Lee",
      email: "david@example.com",
      age: 40,
    },
    {
      id: "21",
      name: "Eva Martinez",
      email: "eva@example.com",
      age: 22,
    },
    {
      id: "22",
      name: "Frank White",
      email: "frank@example.com",
      age: 45,
    },
  ]);
});

afterAll(async () => {
  await collection.drop().catch(() => null);
});

describe("filters", () => {
  it("should filter by exact string match", async () => {
    const result = await collection.search({
      filter: { name: "David Lee" },
    });

    expect(result.count).toBe(1);
    expect(result.data[0].name).toBe("David Lee");
  });

  it("should filter by exact number match", async () => {
    const result = await collection.search({
      filter: { age: 22 },
    });

    expect(result.count).toBe(1);
    expect(result.data[0].age).toBe(22);
  });

  it("should filter by array of values", async () => {
    const result = await collection.search({
      filter: { age: [22, 40] },
    });

    expect(result.count).toBeGreaterThanOrEqual(2);
  });

  it("should filter by gte", async () => {
    const result = await collection.search({
      filter: { age: { gte: 40 } },
    });

    for (const doc of result.data) {
      expect(doc.age).toBeGreaterThanOrEqual(40);
    }
  });

  it("should filter by lte", async () => {
    const result = await collection.search({
      filter: { age: { lte: 30 } },
    });

    for (const doc of result.data) {
      expect(doc.age).toBeLessThanOrEqual(30);
    }
  });

  it("should filter by gte + lte range", async () => {
    const result = await collection.search({
      filter: { age: { gte: 25, lte: 35 } },
    });

    for (const doc of result.data) {
      expect(doc.age).toBeGreaterThanOrEqual(25);
      expect(doc.age).toBeLessThanOrEqual(35);
    }
  });

  it("should filter with not on string", async () => {
    const result = await collection.search({
      filter: { name: { not: "David Lee" } },
    });

    for (const doc of result.data) {
      expect(doc.name).not.toBe("David Lee");
    }
  });

  it("should filter with not on number", async () => {
    const result = await collection.search({
      filter: { age: { not: 22 } },
    });

    for (const doc of result.data) {
      expect(doc.age).not.toBe(22);
    }
  });

  it("should filter with gt", async () => {
    const result = await collection.search({
      filter: { age: { gt: 40 } },
    });

    for (const doc of result.data) {
      expect(doc.age).toBeGreaterThan(40);
    }
  });

  it("should filter with lt", async () => {
    const result = await collection.search({
      filter: { age: { lt: 40 } },
    });

    for (const doc of result.data) {
      expect(doc.age).toBeLessThan(40);
    }
  });

  it("should filter with notIn", async () => {
    const result = await collection.search({
      filter: { age: { notIn: [22, 40] } },
    });

    for (const doc of result.data) {
      expect([22, 40]).not.toContain(doc.age);
    }
  });

  it("should filter with OR conditions", async () => {
    const result = await collection.search({
      filter: {
        OR: [{ age: 22 }, { age: 45 }],
      },
    });

    expect(result.count).toBeGreaterThanOrEqual(2);
  });

  it("should ignore empty OR branches", async () => {
    const result = await collection.search({
      filter: {
        OR: [{} as any, { age: 22 }],
      },
    });

    expect(result.count).toBe(1);
    expect(result.data[0].age).toBe(22);
  });

  it("should treat an entirely empty OR as no filter", async () => {
    const result = await collection.search({
      filter: {
        OR: [{} as any],
      },
    });

    expect(result.count).toBe(3);
  });

  it("should combine multiple filters", async () => {
    const result = await collection.search({
      filter: {
        age: { gte: 20, lte: 50 },
        name: { not: "David Lee" },
      },
    });

    for (const doc of result.data) {
      expect(doc.age).toBeGreaterThanOrEqual(20);
      expect(doc.age).toBeLessThanOrEqual(50);
      expect(doc.name).not.toBe("David Lee");
    }
  });
});
