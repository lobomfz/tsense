import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { UsersCollection as collection } from "./helpers";

beforeAll(async () => {
  await collection.drop().catch(() => null);
  await collection.create();

  await collection.upsert([
    { id: "c1", name: "Alice", age: 25 },
    { id: "c2", name: "Bob", age: 30 },
    { id: "c3", name: "Charlie", age: 35 },
  ]);
});

afterAll(async () => {
  await collection.drop().catch(() => null);
});

describe("count", () => {
  it("returns total count without filter", async () => {
    const count = await collection.count();

    expect(count).toBe(3);
  });

  it("returns filtered count with exact value", async () => {
    const count = await collection.count({ age: 30 });

    expect(count).toBe(1);
  });

  it("returns filtered count with range", async () => {
    const count = await collection.count({ age: { gte: 30 } });

    expect(count).toBeGreaterThanOrEqual(2);
  });

  it("returns 0 for filter matching nothing", async () => {
    const count = await collection.count({ age: 999 });

    expect(count).toBe(0);
  });
});
