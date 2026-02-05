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
      company: "google",
    },
    {
      id: "2",
      name: "Bob Smith",
      email: "bob@example.com",
      age: 35,
      company: "netflix",
    },
    {
      id: "3",
      name: "Charlie Brown",
      email: "charlie@example.com",
      age: 42,
      company: "google",
    },
    {
      id: "4",
      name: "Diana Ross",
      email: "diana@example.com",
      age: 31,
      company: "netflix",
    },
    {
      id: "5",
      name: "Edward King",
      email: "edward@example.com",
      age: 25,
      company: "google",
    },
  ]);
});

afterAll(async () => {
  await collection.drop().catch(() => null);
});

describe("get", () => {
  it("should return document when id exists", async () => {
    const result = await collection.get("1");

    expect(result).not.toBeNull();
    expect(result?.id).toBe("1");
    expect(result?.name).toBe("Alice Johnson");
    expect(result?.email).toBe("alice@example.com");
    expect(result?.age).toBe(28);
    expect(result?.company).toBe("google");
  });

  it("should return null when id does not exist", async () => {
    const result = await collection.get("non-existent-id");

    expect(result).toBeNull();
  });
});

describe("delete", () => {
  beforeAll(async () => {
    await collection.upsert({
      id: "delete-test-1",
      name: "Delete Test",
      email: "delete@example.com",
      age: 30,
    });
  });

  it("should return true when document is deleted", async () => {
    const result = await collection.delete("delete-test-1");

    expect(result).toBe(true);

    const check = await collection.get("delete-test-1");
    expect(check).toBeNull();
  });

  it("should return false when document does not exist", async () => {
    const result = await collection.delete("non-existent-id");

    expect(result).toBe(false);
  });
});

describe("deleteMany", () => {
  beforeAll(async () => {
    await collection.upsert([
      {
        id: "dm-1",
        name: "DeleteMany Test 1",
        email: "dm1@example.com",
        age: 50,
      },
      {
        id: "dm-2",
        name: "DeleteMany Test 2",
        email: "dm2@example.com",
        age: 50,
      },
      {
        id: "dm-3",
        name: "DeleteMany Test 3",
        email: "dm3@example.com",
        age: 51,
      },
      {
        id: "dm-4",
        name: "DeleteMany Test 4",
        email: "dm4@example.com",
        age: 60,
      },
      {
        id: "dm-5",
        name: "DeleteMany Test 5",
        email: "dm5@example.com",
        age: 70,
      },
    ]);
  });

  it("should delete by single filter", async () => {
    const result = await collection.deleteMany({ age: 50 });

    expect(result.deleted).toBe(2);

    const check = await collection.search({ filter: { age: 50 } });
    expect(check.count).toBe(0);
  });

  it("should delete by array of IDs", async () => {
    const result = await collection.deleteMany({ id: ["dm-3", "dm-4"] });

    expect(result.deleted).toBe(2);

    const check1 = await collection.get("dm-3");
    const check2 = await collection.get("dm-4");
    expect(check1).toBeNull();
    expect(check2).toBeNull();
  });

  it("should delete by range filter", async () => {
    const result = await collection.deleteMany({ age: { min: 65 } });

    expect(result.deleted).toBe(1);

    const check = await collection.get("dm-5");
    expect(check).toBeNull();
  });
});

describe("update", () => {
  beforeAll(async () => {
    await collection.upsert({
      id: "update-test-1",
      name: "Update Test",
      email: "update@example.com",
      age: 30,
      company: "google",
    });
  });

  it("should update a single field", async () => {
    const result = await collection.update("update-test-1", { age: 31 });

    expect(result.age).toBe(31);
    expect(result.name).toBe("Update Test");

    const check = await collection.get("update-test-1");
    expect(check?.age).toBe(31);
  });

  it("should update multiple fields", async () => {
    const result = await collection.update("update-test-1", {
      name: "Updated Name",
      email: "updated@example.com",
      company: "netflix",
    });

    expect(result.name).toBe("Updated Name");
    expect(result.email).toBe("updated@example.com");
    expect(result.company).toBe("netflix");

    const check = await collection.get("update-test-1");
    expect(check?.name).toBe("Updated Name");
    expect(check?.email).toBe("updated@example.com");
    expect(check?.company).toBe("netflix");
  });

  it("should throw when updating non-existing document", async () => {
    await expect(collection.update("non-existent-id", { age: 99 })).rejects.toThrow();
  });
});

describe("updateMany", () => {
  beforeAll(async () => {
    await collection.upsert([
      {
        id: "um-1",
        name: "UpdateMany Test 1",
        email: "um1@example.com",
        age: 80,
        company: "google",
      },
      {
        id: "um-2",
        name: "UpdateMany Test 2",
        email: "um2@example.com",
        age: 80,
        company: "google",
      },
      {
        id: "um-3",
        name: "UpdateMany Test 3",
        email: "um3@example.com",
        age: 85,
        company: "netflix",
      },
    ]);
  });

  it("should update multiple documents matching filter", async () => {
    const result = await collection.updateMany({ age: 80 }, { age: 81 });

    expect(result.updated).toBe(2);

    const check = await collection.search({ filter: { id: ["um-1", "um-2"] } });
    expect(check.data[0].age).toBe(81);
    expect(check.data[1].age).toBe(81);
  });

  it("should update by company filter", async () => {
    const result = await collection.updateMany({ company: "netflix" }, { age: 90 });

    expect(result.updated).toBeGreaterThanOrEqual(1);

    const check = await collection.get("um-3");
    expect(check?.age).toBe(90);
  });

  it("should return zero when no documents match filter", async () => {
    const result = await collection.updateMany({ age: 999 }, { age: 1000 });

    expect(result.updated).toBe(0);
  });
});
