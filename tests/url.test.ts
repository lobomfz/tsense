import { describe, expect, it } from "bun:test";
import type { FilterDescriptor } from "../src/filters/index";
import { deserializeFilter, serializeFilter } from "../src/filters/url";

const descriptor: FilterDescriptor = {
  columns: [
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
      key: "age",
      label: "Age",
      type: "number",
      conditions: [
        { key: "equals", label: "equals" },
        { key: "gt", label: ">" },
        { key: "gte", label: ">=" },
        { key: "lt", label: "<" },
        { key: "lte", label: "<=" },
      ],
    },
    {
      key: "active",
      label: "Active",
      type: "boolean",
      conditions: [{ key: "equals", label: "equals" }],
    },
    {
      key: "created_at",
      label: "Created At",
      type: "date",
      conditions: [
        { key: "equals", label: "equals" },
        { key: "gt", label: "after" },
        { key: "lt", label: "before" },
      ],
    },
    {
      key: "status",
      label: "Status",
      type: "string",
      conditions: [
        { key: "is_in", label: "is in" },
        { key: "is_not_in", label: "is not in" },
      ],
      values: [
        { value: "A", label: "Open" },
        { value: "L", label: "Settled" },
        { value: "C", label: "Cancelled" },
      ],
    },
  ],
};

describe("serializeFilter", () => {
  it("serializes direct string value", () => {
    const params = serializeFilter({ name: "Alice" }, descriptor);

    expect(params.get("name")).toBe("Alice");
  });

  it("serializes direct number value", () => {
    const params = serializeFilter({ age: 25 }, descriptor);

    expect(params.get("age")).toBe("25");
  });

  it("serializes direct boolean value", () => {
    const params = serializeFilter({ active: true }, descriptor);

    expect(params.get("active")).toBe("true");
  });

  it("serializes direct date value as ISO string", () => {
    const date = new Date("2026-03-01T00:00:00.000Z");
    const params = serializeFilter({ created_at: date }, descriptor);

    expect(params.get("created_at")).toBe("2026-03-01T00:00:00.000Z");
  });

  it("serializes multi-value array as repeated params", () => {
    const params = serializeFilter({ status: ["A", "C"] }, descriptor);

    expect(params.getAll("status")).toEqual(["A", "C"]);
  });

  it("serializes single-element array as direct value", () => {
    const params = serializeFilter({ status: ["A"] }, descriptor);

    expect(params.get("status")).toBe("A");
  });

  it("serializes operators as field.operator=value", () => {
    const params = serializeFilter({ age: { gte: 18, lte: 65 } }, descriptor);

    expect(params.get("age.gte")).toBe("18");
    expect(params.get("age.lte")).toBe("65");
  });

  it("serializes not operator", () => {
    const params = serializeFilter({ name: { not: "Bob" } }, descriptor);

    expect(params.get("name.not")).toBe("Bob");
  });

  it("serializes notIn as repeated params", () => {
    const params = serializeFilter(
      { status: { notIn: ["A", "C"] } },
      descriptor,
    );

    expect(params.getAll("status.notIn")).toEqual(["A", "C"]);
  });

  it("serializes date operators as ISO strings", () => {
    const gte = new Date("2026-01-01T00:00:00.000Z");
    const lte = new Date("2026-12-31T23:59:59.999Z");
    const params = serializeFilter({ created_at: { gte, lte } }, descriptor);

    expect(params.get("created_at.gte")).toBe("2026-01-01T00:00:00.000Z");
    expect(params.get("created_at.lte")).toBe("2026-12-31T23:59:59.999Z");
  });

  it("produces empty params for empty filter", () => {
    const params = serializeFilter({}, descriptor);

    expect(params.toString()).toBe("");
  });
});

describe("deserializeFilter", () => {
  it("deserializes direct string value", () => {
    const params = new URLSearchParams("name=Alice");

    const result = deserializeFilter(params, descriptor);

    expect(result).toEqual({ name: "Alice" });
  });

  it("coerces number value", () => {
    const params = new URLSearchParams("age=25");

    const result = deserializeFilter(params, descriptor);

    expect(result).toEqual({ age: 25 });
    expect(typeof result.age).toBe("number");
  });

  it("coerces boolean true", () => {
    const params = new URLSearchParams("active=true");

    const result = deserializeFilter(params, descriptor);

    expect(result).toEqual({ active: true });
    expect(typeof result.active).toBe("boolean");
  });

  it("coerces boolean false", () => {
    const params = new URLSearchParams("active=false");

    const result = deserializeFilter(params, descriptor);

    expect(result).toEqual({ active: false });
  });

  it("coerces date value", () => {
    const date = new Date("2026-03-01T00:00:00.000Z");
    const params = new URLSearchParams(`created_at=${date.toISOString()}`);

    const result = deserializeFilter(params, descriptor);

    expect(result).toEqual({ created_at: date });
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it("reads repeated params into an array", () => {
    const params = new URLSearchParams("status=A&status=C");

    const result = deserializeFilter(params, descriptor);

    expect(result).toEqual({ status: ["A", "C"] });
  });

  it("deserializes operator params", () => {
    const params = new URLSearchParams("age.gte=18&age.lte=65");

    const result = deserializeFilter(params, descriptor);

    expect(result).toEqual({ age: { gte: 18, lte: 65 } });
  });

  it("deserializes not operator", () => {
    const params = new URLSearchParams("name.not=Bob");

    const result = deserializeFilter(params, descriptor);

    expect(result).toEqual({ name: { not: "Bob" } });
  });

  it("deserializes notIn as array", () => {
    const params = new URLSearchParams("status.notIn=A&status.notIn=C");

    const result = deserializeFilter(params, descriptor);

    expect(result).toEqual({ status: { notIn: ["A", "C"] } });
  });

  it("coerces date operators to Date objects", () => {
    const params = new URLSearchParams(
      "created_at.gte=2026-01-01T00:00:00.000Z&created_at.lte=2026-12-31T23:59:59.999Z",
    );

    const result = deserializeFilter(params, descriptor);

    expect(result).toEqual({
      created_at: {
        gte: new Date("2026-01-01T00:00:00.000Z"),
        lte: new Date("2026-12-31T23:59:59.999Z"),
      },
    });
  });

  it("ignores unknown params", () => {
    const params = new URLSearchParams("unknown=value&name=Alice");

    const result = deserializeFilter(params, descriptor);

    expect(result).toEqual({ name: "Alice" });
  });

  it("returns empty object for empty params", () => {
    const params = new URLSearchParams("");

    const result = deserializeFilter(params, descriptor);

    expect(result).toEqual({});
  });
});

describe("roundtrip", () => {
  it("string value", () => {
    const filter = { name: "Alice" };

    const result = deserializeFilter(
      serializeFilter(filter, descriptor),
      descriptor,
    );

    expect(result).toEqual(filter);
  });

  it("string value with comma", () => {
    const filter = { name: "Doe, John" };

    const result = deserializeFilter(
      serializeFilter(filter, descriptor),
      descriptor,
    );

    expect(result).toEqual(filter);
  });

  it("number value", () => {
    const filter = { age: 25 };

    const result = deserializeFilter(
      serializeFilter(filter, descriptor),
      descriptor,
    );

    expect(result).toEqual(filter);
  });

  it("boolean value", () => {
    const filter = { active: true };

    const result = deserializeFilter(
      serializeFilter(filter, descriptor),
      descriptor,
    );

    expect(result).toEqual(filter);
  });

  it("date value", () => {
    const filter = { created_at: new Date("2026-03-01T00:00:00.000Z") };

    const result = deserializeFilter(
      serializeFilter(filter, descriptor),
      descriptor,
    );

    expect(result).toEqual(filter);
  });

  it("multi-value array", () => {
    const filter = { status: ["A", "C"] };

    const result = deserializeFilter(
      serializeFilter(filter, descriptor),
      descriptor,
    );

    expect(result).toEqual(filter);
  });

  it("multi-value string array with commas", () => {
    const filter = { name: ["Doe, John", "Alice"] };

    const result = deserializeFilter(
      serializeFilter(filter, descriptor),
      descriptor,
    );

    expect(result).toEqual(filter);
  });

  it("number operators", () => {
    const filter = { age: { gte: 18, lte: 65 } };

    const result = deserializeFilter(
      serializeFilter(filter, descriptor),
      descriptor,
    );

    expect(result).toEqual(filter);
  });

  it("date operators", () => {
    const filter = {
      created_at: {
        gte: new Date("2026-01-01T00:00:00.000Z"),
        lte: new Date("2026-12-31T23:59:59.999Z"),
      },
    };

    const result = deserializeFilter(
      serializeFilter(filter, descriptor),
      descriptor,
    );

    expect(result).toEqual(filter);
  });

  it("not operator", () => {
    const filter = { name: { not: "Bob" } };

    const result = deserializeFilter(
      serializeFilter(filter, descriptor),
      descriptor,
    );

    expect(result).toEqual(filter);
  });

  it("notIn operator", () => {
    const filter = { status: { notIn: ["A", "C"] } };

    const result = deserializeFilter(
      serializeFilter(filter, descriptor),
      descriptor,
    );

    expect(result).toEqual(filter);
  });

  it("multiple fields combined", () => {
    const filter = {
      status: ["A", "C"],
      age: { gte: 18, lte: 65 },
      created_at: { lt: new Date("2026-06-15T00:00:00.000Z") },
    };

    const result = deserializeFilter(
      serializeFilter(filter, descriptor),
      descriptor,
    );

    expect(result).toEqual(filter);
  });

  it("normalizes single-element array to direct value", () => {
    const filter = { status: ["A"] };

    const result = deserializeFilter(
      serializeFilter(filter, descriptor),
      descriptor,
    );

    expect(result).toEqual({ status: "A" });
  });

  it("partial filter with subset of fields", () => {
    const filter = { name: "Alice", age: { gte: 18 } };

    const result = deserializeFilter(
      serializeFilter(filter, descriptor),
      descriptor,
    );

    expect(result).toEqual(filter);
  });
});
