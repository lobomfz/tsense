import { describe, expect, it } from "bun:test";
import {
  addRow,
  addRowWithField,
  applyPreset,
  buildResult,
  clearState,
  columnFor,
  conditionsFor,
  createInitialState,
  removeRow,
  setRowCondition,
  setRowField,
  setRowValue,
} from "../src/filters/filter-state";
import type { FilterDescriptor } from "../src/filters/index";

const descriptor: FilterDescriptor = {
  columns: [
    {
      key: "age",
      label: "Age",
      type: "number",
      conditions: [
        { key: "equals", label: "equals" },
        { key: "gt", label: "greater than" },
        { key: "gte", label: "greater than or equal" },
        { key: "lt", label: "less than" },
        { key: "lte", label: "less than or equal" },
        { key: "between", label: "between" },
      ],
      presets: [{ name: "Over 18", filter: { age: { gte: 18 } } }],
    },
    {
      key: "name",
      label: "Name",
      type: "string",
      conditions: [
        { key: "equals", label: "equals" },
        { key: "not_equals", label: "not equals" },
      ],
    },
    {
      key: "company",
      label: "Company",
      type: "string",
      conditions: [
        { key: "is_in", label: "is in" },
        { key: "is_not_in", label: "is not in" },
      ],
      values: [
        { value: "netflix", label: "Netflix" },
        { value: "google", label: "Google" },
      ],
    },
    {
      key: "created_at",
      label: "Created At",
      type: "date",
      conditions: [
        { key: "equals", label: "equals" },
        { key: "gt", label: "after" },
        { key: "lt", label: "before" },
        { key: "between", label: "between" },
      ],
    },
  ],
};

describe("filter state", () => {
  it("creates initial state with no rows", () => {
    const state = createInitialState();

    expect(state.rows).toEqual([]);
  });

  it("adds a row", () => {
    const state = createInitialState();
    const next = addRow(state);

    expect(next.rows.length).toBe(1);
    expect(next.rows[0].field).toBeUndefined();
  });

  it("adds a row with field", () => {
    const state = createInitialState();
    const next = addRowWithField(state, "age");

    expect(next.rows.length).toBe(1);
    expect(next.rows[0].field).toBe("age");
  });

  it("removes a row by index", () => {
    let state = createInitialState();
    state = addRow(state);
    state = addRow(state);
    state = setRowField(state, 0, "age");
    state = setRowField(state, 1, "name");

    const next = removeRow(state, 0);

    expect(next.rows.length).toBe(1);
    expect(next.rows[0].field).toBe("name");
  });

  it("setField clears condition and value", () => {
    let state = createInitialState();
    state = addRow(state);
    state = setRowField(state, 0, "age");
    state = setRowCondition(state, 0, "equals");
    state = setRowValue(state, 0, 22);

    const next = setRowField(state, 0, "name");

    expect(next.rows[0].field).toBe("name");
    expect(next.rows[0].condition).toBeUndefined();
    expect(next.rows[0].value).toBeUndefined();
  });

  it("setCondition clears value", () => {
    let state = createInitialState();
    state = addRow(state);
    state = setRowField(state, 0, "age");
    state = setRowCondition(state, 0, "equals");
    state = setRowValue(state, 0, 22);

    const next = setRowCondition(state, 0, "gt");

    expect(next.rows[0].field).toBe("age");
    expect(next.rows[0].condition).toBe("gt");
    expect(next.rows[0].value).toBeUndefined();
  });

  it("setValue preserves field and condition", () => {
    let state = createInitialState();
    state = addRow(state);
    state = setRowField(state, 0, "age");
    state = setRowCondition(state, 0, "equals");

    const next = setRowValue(state, 0, 22);

    expect(next.rows[0].field).toBe("age");
    expect(next.rows[0].condition).toBe("equals");
    expect(next.rows[0].value).toBe(22);
  });

  it("clear removes all rows", () => {
    let state = createInitialState();
    state = addRow(state);
    state = setRowField(state, 0, "age");

    const next = clearState();

    expect(next.rows.length).toBe(0);
  });

  it("does not mutate previous state", () => {
    const state = createInitialState();
    const next = addRow(state);

    expect(state.rows.length).toBe(0);
    expect(next.rows.length).toBe(1);
  });
});

describe("buildResult", () => {
  it("equals condition produces direct value", () => {
    let state = createInitialState();
    state = addRow(state);
    state = setRowField(state, 0, "age");
    state = setRowCondition(state, 0, "equals");
    state = setRowValue(state, 0, 22);

    expect(buildResult(state)).toEqual({ age: 22 });
  });

  it("not_equals produces not operator", () => {
    let state = createInitialState();
    state = addRow(state);
    state = setRowField(state, 0, "name");
    state = setRowCondition(state, 0, "not_equals");
    state = setRowValue(state, 0, "Alice");

    expect(buildResult(state)).toEqual({ name: { not: "Alice" } });
  });

  it("gt produces gt operator", () => {
    let state = createInitialState();
    state = addRow(state);
    state = setRowField(state, 0, "age");
    state = setRowCondition(state, 0, "gt");
    state = setRowValue(state, 0, 30);

    expect(buildResult(state)).toEqual({ age: { gt: 30 } });
  });

  it("between produces gte+lte operators", () => {
    let state = createInitialState();
    state = addRow(state);
    state = setRowField(state, 0, "age");
    state = setRowCondition(state, 0, "between");
    state = setRowValue(state, 0, [18, 65]);

    expect(buildResult(state)).toEqual({ age: { gte: 18, lte: 65 } });
  });

  it("between excludes incomplete tuple (missing max)", () => {
    let state = createInitialState();
    state = addRow(state);
    state = setRowField(state, 0, "age");
    state = setRowCondition(state, 0, "between");
    state = setRowValue(state, 0, [18, undefined]);

    expect(buildResult(state)).toEqual({});
  });

  it("merges multiple operators on same field", () => {
    let state = createInitialState();
    state = addRow(state);
    state = addRow(state);
    state = setRowField(state, 0, "age");
    state = setRowCondition(state, 0, "gte");
    state = setRowValue(state, 0, 18);
    state = setRowField(state, 1, "age");
    state = setRowCondition(state, 1, "lte");
    state = setRowValue(state, 1, 65);

    expect(buildResult(state)).toEqual({ age: { gte: 18, lte: 65 } });
  });

  it("excludes rows without field", () => {
    let state = createInitialState();
    state = addRow(state);
    state = setRowCondition(state, 0, "equals");
    state = setRowValue(state, 0, 22);

    expect(buildResult(state)).toEqual({});
  });

  it("excludes rows without condition", () => {
    let state = createInitialState();
    state = addRow(state);
    state = setRowField(state, 0, "age");
    state = setRowValue(state, 0, 22);

    expect(buildResult(state)).toEqual({});
  });

  it("excludes rows without value", () => {
    let state = createInitialState();
    state = addRow(state);
    state = setRowField(state, 0, "age");
    state = setRowCondition(state, 0, "equals");

    expect(buildResult(state)).toEqual({});
  });

  it("includes value 0 as set", () => {
    let state = createInitialState();
    state = addRow(state);
    state = setRowField(state, 0, "age");
    state = setRowCondition(state, 0, "equals");
    state = setRowValue(state, 0, 0);

    expect(buildResult(state)).toEqual({ age: 0 });
  });

  it("combines multiple complete rows for different fields", () => {
    let state = createInitialState();
    state = addRow(state);
    state = addRow(state);
    state = setRowField(state, 0, "age");
    state = setRowCondition(state, 0, "gt");
    state = setRowValue(state, 0, 18);
    state = setRowField(state, 1, "name");
    state = setRowCondition(state, 1, "not_equals");
    state = setRowValue(state, 1, "Alice");

    expect(buildResult(state)).toEqual({
      age: { gt: 18 },
      name: { not: "Alice" },
    });
  });

  it("is_in produces direct array value", () => {
    let state = createInitialState();
    state = addRow(state);
    state = setRowField(state, 0, "company");
    state = setRowCondition(state, 0, "is_in");
    state = setRowValue(state, 0, ["netflix", "google"]);

    expect(buildResult(state)).toEqual({ company: ["netflix", "google"] });
  });

  it("is_not_in produces notIn operator", () => {
    let state = createInitialState();
    state = addRow(state);
    state = setRowField(state, 0, "company");
    state = setRowCondition(state, 0, "is_not_in");
    state = setRowValue(state, 0, ["netflix"]);

    expect(buildResult(state)).toEqual({ company: { notIn: ["netflix"] } });
  });

  it("is_in excludes empty array", () => {
    let state = createInitialState();
    state = addRow(state);
    state = setRowField(state, 0, "company");
    state = setRowCondition(state, 0, "is_in");
    state = setRowValue(state, 0, []);

    expect(buildResult(state)).toEqual({});
  });

  it("date equals produces direct Date value", () => {
    const date = new Date("2024-01-15T00:00:00Z");
    let state = createInitialState();
    state = addRow(state);
    state = setRowField(state, 0, "created_at");
    state = setRowCondition(state, 0, "equals");
    state = setRowValue(state, 0, date);

    expect(buildResult(state)).toEqual({ created_at: date });
  });

  it("date gt produces gt operator with Date", () => {
    const date = new Date("2024-01-15T00:00:00Z");
    let state = createInitialState();
    state = addRow(state);
    state = setRowField(state, 0, "created_at");
    state = setRowCondition(state, 0, "gt");
    state = setRowValue(state, 0, date);

    expect(buildResult(state)).toEqual({ created_at: { gt: date } });
  });

  it("date between produces gte+lte with Dates", () => {
    const from = new Date("2024-01-01T00:00:00Z");
    const to = new Date("2024-12-31T00:00:00Z");
    let state = createInitialState();
    state = addRow(state);
    state = setRowField(state, 0, "created_at");
    state = setRowCondition(state, 0, "between");
    state = setRowValue(state, 0, [from, to]);

    expect(buildResult(state)).toEqual({ created_at: { gte: from, lte: to } });
  });
});

describe("applyPreset", () => {
  it("adds a completed row from preset", () => {
    const state = createInitialState();
    const next = applyPreset(state, descriptor, "age", "Over 18");

    expect(next.rows.length).toBe(1);

    const presetRow = next.rows[0];
    expect(presetRow.field).toBe("age");
    expect(presetRow.condition).toBe("gte");
    expect(presetRow.value).toBe(18);
  });

  it("does nothing for unknown preset", () => {
    const state = createInitialState();
    const next = applyPreset(state, descriptor, "age", "Unknown");

    expect(next.rows.length).toBe(0);
  });

  it("result includes preset row", () => {
    const state = createInitialState();
    const next = applyPreset(state, descriptor, "age", "Over 18");

    expect(buildResult(next)).toEqual({ age: { gte: 18 } });
  });
});

describe("applyPreset with array", () => {
  const descriptorWithArrayPreset: FilterDescriptor = {
    columns: [
      {
        key: "company",
        label: "Company",
        type: "string",
        conditions: [
          { key: "is_in", label: "is in" },
          { key: "is_not_in", label: "is not in" },
        ],
        values: [
          { value: "netflix", label: "Netflix" },
          { value: "google", label: "Google" },
        ],
        presets: [
          { name: "Big Tech", filter: { company: ["netflix", "google"] } },
        ],
      },
    ],
  };

  it("applies array preset as is_in condition", () => {
    const state = createInitialState();
    const next = applyPreset(
      state,
      descriptorWithArrayPreset,
      "company",
      "Big Tech",
    );

    const presetRow = next.rows[0];

    expect(presetRow.field).toBe("company");
    expect(presetRow.condition).toBe("is_in");
    expect(presetRow.value).toEqual(["netflix", "google"]);
  });
});

describe("conditionsFor", () => {
  it("returns conditions for existing field", () => {
    const conditions = conditionsFor(descriptor, "age");
    const keys = conditions.map((c) => c.key);

    expect(keys).toContain("equals");
    expect(keys).toContain("gt");
    expect(keys).toContain("between");
  });

  it("returns empty array for unknown field", () => {
    expect(conditionsFor(descriptor, "unknown")).toEqual([]);
  });
});

describe("columnFor", () => {
  it("returns column for existing field", () => {
    const column = columnFor(descriptor, "age");

    expect(column.key).toBe("age");
    expect(column.type).toBe("number");
  });

  it("throws for unknown field", () => {
    expect(() => columnFor(descriptor, "unknown")).toThrow(
      "Column not found: unknown",
    );
  });
});
