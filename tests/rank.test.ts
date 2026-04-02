import { describe, expect, it } from "bun:test";
import { rank } from "../src/rank";

describe("rank", () => {
  it("reorders DB results to match Typesense ordering", () => {
    const db = [
      { id: 3, name: "Charlie" },
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ];
    const ts = [{ id: "1" }, { id: "2" }, { id: "3" }];

    const result = rank({ db, id_key: "id", ts });

    expect(result).toEqual([
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
      { id: 3, name: "Charlie" },
    ]);
  });

  it("filters out Typesense IDs not found in DB results", () => {
    const db = [
      { id: 1, name: "Alice" },
      { id: 3, name: "Charlie" },
    ];
    const ts = [{ id: "1" }, { id: "2" }, { id: "3" }];

    const result = rank({ db, id_key: "id", ts });

    expect(result).toEqual([
      { id: 1, name: "Alice" },
      { id: 3, name: "Charlie" },
    ]);
  });

  it("returns empty array when DB results are empty", () => {
    const result = rank({
      db: [] as { id: number }[],
      id_key: "id",
      ts: [{ id: "1" }],
    });

    expect(result).toEqual([]);
  });

  it("returns empty array when Typesense results are empty", () => {
    const db = [{ id: 1, name: "Alice" }];

    const result = rank({ db, id_key: "id", ts: [] });

    expect(result).toEqual([]);
  });

  it("returns empty array when both inputs are empty", () => {
    const result = rank({
      db: [] as { id: number }[],
      id_key: "id",
      ts: [],
    });

    expect(result).toEqual([]);
  });

  it("handles single item", () => {
    const db = [{ id: 1, name: "Alice" }];
    const ts = [{ id: "1" }];

    const result = rank({ db, id_key: "id", ts });

    expect(result).toEqual([{ id: 1, name: "Alice" }]);
  });

  it("works with string ID keys", () => {
    const db = [
      { code: "B", value: 2 },
      { code: "A", value: 1 },
    ];
    const ts = [{ id: "A" }, { id: "B" }];

    const result = rank({ db, id_key: "code", ts });

    expect(result).toEqual([
      { code: "A", value: 1 },
      { code: "B", value: 2 },
    ]);
  });
});
