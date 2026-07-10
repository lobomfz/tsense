import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { UsersCollection as collection } from "./helpers";

beforeAll(async () => {
  await collection.drop().catch(() => null);
  await collection.create();

  await collection.upsert([
    {
      id: "1",
      name: "Alice Johnson",
      email: "alice@example.com",
      age: 28,
      company: "netflix",
      phone: "555-1234",
    },
    {
      id: "2",
      name: "Bob Smith",
      email: "bob@example.com",
      age: 35,
      company: "google",
      phone: "555-5678",
    },
    {
      id: "3",
      name: "Charlie Davis",
      email: "charlie@example.com",
      age: 42,
      company: "netflix",
    },
  ]);
});

afterAll(async () => {
  await collection.drop().catch(() => null);
});

describe("pick option", () => {
  it("should return only picked fields (single field)", async () => {
    const result = await collection.search({
      query: "Alice",
      pick: ["name"],
    });

    expect(result.count).toBeGreaterThan(0);
    const doc = result.data[0];
    expect(doc.name).toBe("Alice Johnson");
    // @ts-expect-error - field excluded by pick/omit
    expect(doc.id).toBeUndefined();
    // @ts-expect-error - field excluded by pick/omit
    expect(doc.email).toBeUndefined();
    // @ts-expect-error - field excluded by pick/omit
    expect(doc.age).toBeUndefined();
    // @ts-expect-error - field excluded by pick/omit
    expect(doc.company).toBeUndefined();
    // @ts-expect-error - field excluded by pick/omit
    expect(doc.phone).toBeUndefined();
  });

  it("should return only picked fields (multiple fields)", async () => {
    const result = await collection.search({
      query: "Bob",
      pick: ["name", "email", "age"],
    });

    expect(result.count).toBeGreaterThan(0);
    const doc = result.data[0];
    expect(doc.name).toBe("Bob Smith");
    expect(doc.email).toBe("bob@example.com");
    expect(doc.age).toBe(35);
    // @ts-expect-error - field excluded by pick/omit
    expect(doc.id).toBeUndefined();
    // @ts-expect-error - field excluded by pick/omit
    expect(doc.company).toBeUndefined();
    // @ts-expect-error - field excluded by pick/omit
    expect(doc.phone).toBeUndefined();
  });

  it("should include id when explicitly picked", async () => {
    const result = await collection.search({
      query: "Alice",
      pick: ["id", "name"],
    });

    expect(result.count).toBeGreaterThan(0);
    const doc = result.data[0];
    expect(doc.id).toBe("1");
    expect(doc.name).toBe("Alice Johnson");
    // @ts-expect-error - field excluded by pick/omit
    expect(doc.email).toBeUndefined();
    // @ts-expect-error - field excluded by pick/omit
    expect(doc.age).toBeUndefined();
  });

  it("should work with pick and highlighting", async () => {
    const result = await collection.search({
      query: "Alice",
      pick: ["name"],
      highlight: true,
    });

    expect(result.count).toBeGreaterThan(0);
    const doc = result.data[0];
    expect(doc.name).toContain("<mark>Alice</mark>");
    // @ts-expect-error - field excluded by pick/omit
    expect(doc.email).toBeUndefined();
  });
});

describe("omit option", () => {
  it("should exclude omitted fields (single field)", async () => {
    const result = await collection.search({
      query: "Alice",
      omit: ["age"],
    });

    expect(result.count).toBeGreaterThan(0);
    const doc = result.data[0];
    expect(doc.id).toBe("1");
    expect(doc.name).toBe("Alice Johnson");
    expect(doc.email).toBe("alice@example.com");
    expect(doc.company).toBe("netflix");
    expect(doc.phone).toBe("555-1234");
    // @ts-expect-error - field excluded by pick/omit
    expect(doc.age).toBeUndefined();
  });

  it("should exclude omitted fields (multiple fields)", async () => {
    const result = await collection.search({
      query: "Bob",
      omit: ["age", "company", "phone"],
    });

    expect(result.count).toBeGreaterThan(0);
    const doc = result.data[0];
    expect(doc.id).toBe("2");
    expect(doc.name).toBe("Bob Smith");
    expect(doc.email).toBe("bob@example.com");
    // @ts-expect-error - field excluded by pick/omit
    expect(doc.age).toBeUndefined();
    // @ts-expect-error - field excluded by pick/omit
    expect(doc.company).toBeUndefined();
    // @ts-expect-error - field excluded by pick/omit
    expect(doc.phone).toBeUndefined();
  });

  it("should work with omit and highlighting", async () => {
    const result = await collection.search({
      query: "Alice",
      omit: ["age", "company"],
      highlight: true,
    });

    expect(result.count).toBeGreaterThan(0);
    const doc = result.data[0];
    expect(doc.name).toContain("<mark>Alice</mark>");
    // @ts-expect-error - field excluded by pick/omit
    expect(doc.age).toBeUndefined();
    // @ts-expect-error - field excluded by pick/omit
    expect(doc.company).toBeUndefined();
  });
});

describe("highlight object option", () => {
  it("should use custom highlight tags", async () => {
    const result = await collection.search({
      query: "Alice",
      highlight: {
        startTag: "<b>",
        endTag: "</b>",
      },
    });

    expect(result.count).toBeGreaterThan(0);
    const doc = result.data[0];
    expect(doc.name).toContain("<b>Alice</b>");
    expect(doc.name).not.toContain("<mark>");
  });

  it("should highlight only specified fields", async () => {
    const result = await collection.search({
      query: "Alice",
      highlight: {
        fields: ["name"],
      },
    });

    expect(result.count).toBeGreaterThan(0);
    const doc = result.data[0];
    expect(doc.name).toContain("<mark>Alice</mark>");
    expect(doc.email).toBe("alice@example.com");
    expect(doc.email).not.toContain("<mark>");
  });

  it("should use custom tags on specific fields only", async () => {
    const result = await collection.search({
      query: "Alice",
      highlight: {
        fields: ["name"],
        startTag: "<em>",
        endTag: "</em>",
      },
    });

    expect(result.count).toBeGreaterThan(0);
    const doc = result.data[0];
    expect(doc.name).toContain("<em>Alice</em>");
    expect(doc.email).toBe("alice@example.com");
    expect(doc.email).not.toContain("<em>");
  });

  it("should highlight multiple specific fields", async () => {
    const result = await collection.search({
      query: "alice",
      queryBy: ["name", "email"],
      highlight: {
        fields: ["name", "email"],
        startTag: "<strong>",
        endTag: "</strong>",
      },
    });

    expect(result.count).toBeGreaterThan(0);
    const doc = result.data[0];
    expect(doc.name).toContain("<strong>Alice</strong>");
    expect(doc.email).toContain("<strong>alice</strong>");
  });
});

describe("combined options", () => {
  it("should work with pick and highlight object", async () => {
    const result = await collection.search({
      query: "Alice",
      pick: ["name", "email"],
      highlight: {
        fields: ["name"],
        startTag: "<b>",
        endTag: "</b>",
      },
    });

    expect(result.count).toBeGreaterThan(0);
    const doc = result.data[0];
    expect(doc.name).toContain("<b>Alice</b>");
    expect(doc.email).toBe("alice@example.com");
    // @ts-expect-error - field excluded by pick/omit
    expect(doc.id).toBeUndefined();
    // @ts-expect-error - field excluded by pick/omit
    expect(doc.age).toBeUndefined();
    // @ts-expect-error - field excluded by pick/omit
    expect(doc.company).toBeUndefined();
  });

  it("should work with omit and highlight object", async () => {
    const result = await collection.search({
      query: "Bob",
      omit: ["age", "phone"],
      highlight: {
        startTag: "<i>",
        endTag: "</i>",
      },
    });

    expect(result.count).toBeGreaterThan(0);
    const doc = result.data[0];
    expect(doc.id).toBe("2");
    expect(doc.name).toContain("<i>Bob</i>");
    expect(doc.email).toBe("bob@example.com");
    expect(doc.company).toBe("google");
    // @ts-expect-error - field excluded by pick/omit
    expect(doc.age).toBeUndefined();
    // @ts-expect-error - field excluded by pick/omit
    expect(doc.phone).toBeUndefined();
  });

  it("should work with pick, filter and pagination", async () => {
    const result = await collection.search({
      filter: { company: "netflix" },
      pick: ["name", "company"],
      limit: 10,
      page: 1,
    });

    expect(result.count).toBe(2);
    for (const doc of result.data) {
      expect(doc.company).toBe("netflix");
      // @ts-expect-error - field excluded by pick/omit
      expect(doc.email).toBeUndefined();
      // @ts-expect-error - field excluded by pick/omit
      expect(doc.age).toBeUndefined();
    }
  });
});

describe("dogama search options", () => {
  it("combines typed and raw filters", async () => {
    const result = await collection.search({
      filter: { company: "netflix" },
      rawFilter: ["age:>=30"],
      exhaustiveSearch: true,
    });

    expect(result.data.map((document) => document.name)).toEqual([
      "Charlie Davis",
    ]);
  });

  it("groups documents by a facet", async () => {
    const result = await collection.groupedSearch({
      groupBy: "company",
      groupLimit: 10,
      exhaustiveSearch: true,
    });

    const groups = Object.fromEntries(
      result.groups.map((group) => [group.keys[0], group]),
    );

    expect(groups.netflix?.count).toBe(2);
    expect(groups.google?.count).toBe(1);
    expect(groups.netflix?.data).toHaveLength(2);
  });

  it("upserts collection synonyms", async () => {
    await collection.upsertSynonym("streaming", {
      synonyms: ["streaming", "netflix"],
    });

    const result = await collection.search({
      query: "streaming",
      queryBy: ["company"],
    });

    expect(result.count).toBe(2);
  });
});
