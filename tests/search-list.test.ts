import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { UsersCollection as collection } from "./helpers";

beforeAll(async () => {
  await collection.drop().catch(() => null);
  await collection.create();

  await collection.upsert([
    { id: "1", name: "Alice", email: "alice@test.com", age: 20 },
    { id: "2", name: "Bob", email: "bob@test.com", age: 25 },
    { id: "3", name: "Charlie", email: "charlie@test.com", age: 30 },
    { id: "4", name: "Diana", email: "diana@test.com", age: 35 },
    { id: "5", name: "Eve", email: "eve@test.com", age: 40 },
  ]);
});

afterAll(async () => {
  await collection.drop().catch(() => null);
});

describe("searchList", () => {
  it("should return data and nextCursor on first page", async () => {
    const result = await collection.searchList({
      sortBy: "age:asc",
      limit: 2,
    });

    expect(result.data.length).toBe(2);
    expect(result.nextCursor).not.toBeNull();
  });

  it("should return different items with cursor", async () => {
    const page1 = await collection.searchList({
      sortBy: "age:asc",
      limit: 2,
    });

    const page2 = await collection.searchList({
      sortBy: "age:asc",
      limit: 2,
      cursor: page1.nextCursor!,
    });

    expect(page2.data[0].id).not.toBe(page1.data[0].id);
    expect(page2.data[0].id).not.toBe(page1.data[1].id);
  });

  it("should return nextCursor = null on last page", async () => {
    const page1 = await collection.searchList({
      sortBy: "age:asc",
      limit: 2,
    });

    const page2 = await collection.searchList({
      sortBy: "age:asc",
      limit: 2,
      cursor: page1.nextCursor!,
    });

    const page3 = await collection.searchList({
      sortBy: "age:asc",
      limit: 2,
      cursor: page2.nextCursor!,
    });

    expect(page3.nextCursor).toBeNull();
  });

  it("should sort asc correctly", async () => {
    const result = await collection.searchList({
      sortBy: "age:asc",
      limit: 5,
    });

    for (let i = 1; i < result.data.length; i++) {
      expect(result.data[i].age).toBeGreaterThanOrEqual(result.data[i - 1].age);
    }
  });

  it("should sort desc correctly", async () => {
    const result = await collection.searchList({
      sortBy: "age:desc",
      limit: 5,
    });

    for (let i = 1; i < result.data.length; i++) {
      expect(result.data[i].age).toBeLessThanOrEqual(result.data[i - 1].age);
    }
  });

  it("should work with filter and cursor together", async () => {
    const page1 = await collection.searchList({
      sortBy: "age:asc",
      filter: { age: { gte: 25 } },
      limit: 2,
    });

    expect(page1.data.every((u) => u.age >= 25)).toBe(true);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await collection.searchList({
      sortBy: "age:asc",
      filter: { age: { gte: 25 } },
      limit: 2,
      cursor: page1.nextCursor!,
    });

    expect(page2.data.every((u) => u.age >= 25)).toBe(true);
    expect(page2.data[0].id).not.toBe(page1.data[0].id);
  });
});
