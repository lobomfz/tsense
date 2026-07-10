import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { UsersCollection as collection } from "./helpers";

beforeAll(async () => {
  await collection.drop().catch(() => null);
  await collection.create();

  await collection.upsert([
    {
      id: "1",
      name: "Alice",
      email: "alice@test.com",
      age: 25,
      company: "netflix",
    },
    {
      id: "2",
      name: "Bob",
      email: "bob@test.com",
      age: 30,
      company: "google",
    },
    {
      id: "3",
      name: "Charlie",
      email: "charlie@test.com",
      age: 35,
      company: "netflix",
    },
    {
      id: "4",
      name: "Diana",
      email: "diana@test.com",
      age: 40,
      company: "google",
    },
  ]);
});

afterAll(async () => {
  await collection.drop().catch(() => null);
});

describe("scoped", () => {
  it("should filter search results by base filter", async () => {
    const scoped = collection.scoped({ company: "netflix" });
    const result = await scoped.search({});

    expect(result.count).toBe(2);

    for (const doc of result.data) {
      expect(doc.company).toBe("netflix");
    }
  });

  it("should merge caller filter with base filter", async () => {
    const scoped = collection.scoped({ company: "netflix" });
    const result = await scoped.search({ filter: { age: { gte: 30 } } });

    expect(result.count).toBe(1);
    expect(result.data[0].name).toBe("Charlie");
  });

  it("should combine same-field operators with AND semantics", async () => {
    const scoped = collection.scoped({ age: { gte: 30 } });
    const result = await scoped.search({ filter: { age: { lte: 35 } } });

    expect(result.count).toBe(2);
    expect(result.data.map((doc) => doc.name).sort()).toEqual([
      "Bob",
      "Charlie",
    ]);
  });

  it("should not allow caller to override base filter", async () => {
    const scoped = collection.scoped({ company: "netflix" });
    const result = await scoped.search({
      filter: { company: "google" } as any,
    });

    expect(result.count).toBe(0);
  });

  it("should work with searchList", async () => {
    const scoped = collection.scoped({ company: "google" });
    const result = await scoped.searchList({
      sortBy: "age:asc",
    });

    expect(result.data.length).toBe(2);

    for (const doc of result.data) {
      expect(doc.company).toBe("google");
    }
  });

  it("should work with count", async () => {
    const scoped = collection.scoped({ company: "netflix" });
    const count = await scoped.count({});

    expect(count).toBe(2);
  });

  it("should work with count with extra filter", async () => {
    const scoped = collection.scoped({ company: "netflix" });
    const count = await scoped.count({ age: { gte: 30 } });

    expect(count).toBe(1);
  });

  it("should combine same-field count filters with AND semantics", async () => {
    const scoped = collection.scoped({ age: { gte: 30 } });
    const count = await scoped.count({ age: { lte: 35 } });

    expect(count).toBe(2);
  });

  it("should work with deleteMany", async () => {
    await collection.upsert([
      {
        id: "99",
        name: "Temp",
        email: "temp@test.com",
        age: 99,
        company: "google",
      },
    ]);

    const scoped = collection.scoped({ company: "google" });
    const result = await scoped.deleteMany({ age: 99 });

    expect(result.deleted).toBe(1);

    const check = await collection.search({ filter: { age: 99 } });
    expect(check.count).toBe(0);
  });

  it("should work with updateMany", async () => {
    const scoped = collection.scoped({ company: "netflix" });
    const result = await scoped.updateMany({ name: "Alice" }, { age: 26 });

    expect(result.updated).toBe(1);

    const check = await collection.get("1");
    expect(check?.age).toBe(26);
  });

  it("should scope with not operator", async () => {
    const scoped = collection.scoped({ company: { not: "netflix" } });
    const result = await scoped.search({});

    for (const doc of result.data) {
      expect(doc.company).not.toBe("netflix");
    }
  });

  it("should scope with OR", async () => {
    const scoped = collection.scoped({
      OR: [{ company: "netflix" }, { age: 30 }],
    });
    const result = await scoped.search({});

    for (const doc of result.data) {
      expect(doc.company === "netflix" || doc.age === 30).toBe(true);
    }
  });

  it("should only expose search/searchList/count/deleteMany/updateMany", () => {
    const scoped = collection.scoped({ company: "netflix" });

    expect(typeof scoped.search).toBe("function");
    expect(typeof scoped.searchList).toBe("function");
    expect(typeof scoped.count).toBe("function");
    expect(typeof scoped.deleteMany).toBe("function");
    expect(typeof scoped.updateMany).toBe("function");

    expect((scoped as any).get).toBeUndefined();
    expect((scoped as any).delete).toBeUndefined();
    expect((scoped as any).update).toBeUndefined();
    expect((scoped as any).upsert).toBeUndefined();
    expect((scoped as any).create).toBeUndefined();
    expect((scoped as any).drop).toBeUndefined();
    expect((scoped as any).syncData).toBeUndefined();
  });
});
