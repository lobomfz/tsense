import { describe, expect, it } from "bun:test";
import { type } from "arktype";
import { createFilterBuilder } from "../src/filters/index";
import { UsersCollection } from "./helpers";

describe("createFilterBuilder", () => {
  it("only includes configured fields in descriptor", () => {
    const builder = createFilterBuilder(UsersCollection, {
      age: { label: "Age" },
    });

    const descriptor = builder.describe();

    expect(descriptor.columns.length).toBe(1);
    expect(descriptor.columns[0].key).toBe("age");
    expect(descriptor.columns[0].label).toBe("Age");
  });

  it("returns correct type per field", () => {
    const builder = createFilterBuilder(UsersCollection, {
      age: { label: "Age" },
      name: { label: "Name" },
      company: { label: "Company" },
    });

    const descriptor = builder.describe();
    const byKey = Object.fromEntries(descriptor.columns.map((c) => [c.key, c]));

    expect(byKey.age.type).toBe("number");
    expect(byKey.name.type).toBe("string");
    expect(byKey.company.type).toBe("string");
  });

  it("excludes fields not in config", () => {
    const builder = createFilterBuilder(UsersCollection, {
      age: { label: "Age" },
    });

    const descriptor = builder.describe();
    const keys = descriptor.columns.map((c) => c.key);

    expect(keys).not.toContain("name");
    expect(keys).not.toContain("email");
    expect(keys).not.toContain("phone");
    expect(keys).not.toContain("id");
  });

  it("excludes non-filterable field types (object)", () => {
    const builder = createFilterBuilder(UsersCollection, {
      work_history: { label: "Work History" },
    } as any);

    const descriptor = builder.describe();

    expect(descriptor.columns.length).toBe(0);
  });

  it("returns valid JSON-serializable descriptor", () => {
    const builder = createFilterBuilder(UsersCollection, {
      age: { label: "Age" },
      name: { label: "Name" },
    });

    const descriptor = builder.describe();
    const serialized = JSON.parse(JSON.stringify(descriptor));

    expect(serialized).toEqual(descriptor);
  });
});

describe("schema", () => {
  it("returns a valid arktype schema", () => {
    const builder = createFilterBuilder(UsersCollection, {
      age: { label: "Age" },
    });

    const schema = builder.schema();

    expect(schema).toBeDefined();
  });

  it("validates valid search input", () => {
    const builder = createFilterBuilder(UsersCollection, {
      age: { label: "Age" },
    });

    const schema = builder.schema();
    const result = schema({ query: "test", page: 1, limit: 10 });

    expect(result).toEqual({ query: "test", page: 1, limit: 10 });
  });

  it("validates input with filter object", () => {
    const builder = createFilterBuilder(UsersCollection, {
      age: { label: "Age" },
    });

    const schema = builder.schema();
    const result = schema({ filter: { age: { gte: 18 } } });

    expect(result).toEqual({ filter: { age: { gte: 18 } } });
  });

  it("rejects invalid query type", () => {
    const builder = createFilterBuilder(UsersCollection, {
      age: { label: "Age" },
    });

    const schema = builder.schema();
    const result = schema({ query: 123 });

    expect(result instanceof type.errors).toBe(true);
  });

  it("rejects invalid filter field type", () => {
    const builder = createFilterBuilder(UsersCollection, {
      age: { label: "Age" },
    });

    const schema = builder.schema();
    const result = schema({ filter: { age: "not a number" } });

    expect(result instanceof type.errors).toBe(true);
  });

  it("validates filter with number operators", () => {
    const builder = createFilterBuilder(UsersCollection, {
      age: { label: "Age" },
    });

    const schema = builder.schema();
    const result = schema({ filter: { age: { gte: 18, lte: 65 } } });

    expect(result).toEqual({ filter: { age: { gte: 18, lte: 65 } } });
  });

  it("validates filter with string operators", () => {
    const builder = createFilterBuilder(UsersCollection, {
      name: { label: "Name" },
    });

    const schema = builder.schema();
    const result = schema({ filter: { name: { not: "Ali" } } });

    expect(result).toEqual({ filter: { name: { not: "Ali" } } });
  });

  it("validates filter with array value", () => {
    const builder = createFilterBuilder(UsersCollection, {
      age: { label: "Age" },
    });

    const schema = builder.schema();
    const result = schema({ filter: { age: [22, 30] } });

    expect(result).toEqual({ filter: { age: [22, 30] } });
  });
});

describe("conditions per type", () => {
  it("returns string conditions for string fields", () => {
    const builder = createFilterBuilder(UsersCollection, {
      name: { label: "Name" },
    });

    const descriptor = builder.describe();
    const conditions = descriptor.columns[0].conditions.map((c) => c.key);

    expect(conditions).toContain("equals");
    expect(conditions).toContain("not_equals");
    expect(conditions).not.toContain("prefix");
    expect(conditions).not.toContain("contains");
    expect(conditions).not.toContain("gt");
    expect(conditions).not.toContain("between");
  });

  it("returns number conditions for number fields", () => {
    const builder = createFilterBuilder(UsersCollection, {
      age: { label: "Age" },
    });

    const descriptor = builder.describe();
    const conditions = descriptor.columns[0].conditions.map((c) => c.key);

    expect(conditions).toContain("equals");
    expect(conditions).toContain("not_equals");
    expect(conditions).toContain("gt");
    expect(conditions).toContain("gte");
    expect(conditions).toContain("lt");
    expect(conditions).toContain("lte");
    expect(conditions).toContain("between");
    expect(conditions).not.toContain("contains");
    expect(conditions).not.toContain("prefix");
  });
});

describe("date fields", () => {
  it("detects Date fields as date type", () => {
    const builder = createFilterBuilder(UsersCollection, {
      created_at: { label: "Created At" },
    });

    const descriptor = builder.describe();

    expect(descriptor.columns[0].type).toBe("date");
  });

  it("returns date conditions for Date fields", () => {
    const builder = createFilterBuilder(UsersCollection, {
      created_at: { label: "Created At" },
    });

    const descriptor = builder.describe();
    const conditions = descriptor.columns[0].conditions.map((c) => c.key);

    expect(conditions).toContain("equals");
    expect(conditions).toContain("gt");
    expect(conditions).toContain("lt");
    expect(conditions).toContain("between");
    expect(conditions).not.toContain("contains");
    expect(conditions).not.toContain("prefix");
  });
});

describe("enum conditions", () => {
  it("returns is_in and is_not_in for enum fields", () => {
    const builder = createFilterBuilder(UsersCollection, {
      company: { label: "Company" },
    });

    const descriptor = builder.describe();
    const conditions = descriptor.columns[0].conditions.map((c) => c.key);

    expect(conditions).toEqual(["is_in", "is_not_in"]);
  });

  it("does not include string conditions for enum fields", () => {
    const builder = createFilterBuilder(UsersCollection, {
      company: { label: "Company" },
    });

    const descriptor = builder.describe();
    const conditions = descriptor.columns[0].conditions.map((c) => c.key);

    expect(conditions).not.toContain("equals");
    expect(conditions).not.toContain("contains");
    expect(conditions).not.toContain("prefix");
  });
});

describe("enum detection", () => {
  it("auto-detects enum values from arktype schema", () => {
    const builder = createFilterBuilder(UsersCollection, {
      company: { label: "Company" },
    });

    const descriptor = builder.describe();
    const company = descriptor.columns[0];

    expect(company.values).toBeDefined();
    expect(company.values!.length).toBe(2);

    const values = company.values!.map((v) => v.value).sort();
    expect(values).toEqual(["google", "netflix"]);
  });

  it("uses raw value as label without labels config", () => {
    const builder = createFilterBuilder(UsersCollection, {
      company: { label: "Company" },
    });

    const descriptor = builder.describe();
    const netflix = descriptor.columns[0].values!.find(
      (v) => v.value === "netflix",
    )!;

    expect(netflix.label).toBe("netflix");
  });

  it("maps labels config to human-readable names", () => {
    const builder = createFilterBuilder(UsersCollection, {
      company: {
        label: "Company",
        labels: { netflix: "Netflix", google: "Google" },
      },
    });

    const descriptor = builder.describe();
    const netflix = descriptor.columns[0].values!.find(
      (v) => v.value === "netflix",
    )!;
    const google = descriptor.columns[0].values!.find(
      (v) => v.value === "google",
    )!;

    expect(netflix.label).toBe("Netflix");
    expect(google.label).toBe("Google");
  });

  it("handles partial labels config", () => {
    const builder = createFilterBuilder(UsersCollection, {
      company: {
        label: "Company",
        labels: { netflix: "Netflix" },
      },
    });

    const descriptor = builder.describe();
    const netflix = descriptor.columns[0].values!.find(
      (v) => v.value === "netflix",
    )!;
    const google = descriptor.columns[0].values!.find(
      (v) => v.value === "google",
    )!;

    expect(netflix.label).toBe("Netflix");
    expect(google.label).toBe("google");
  });

  it("does not include values for non-enum string fields", () => {
    const builder = createFilterBuilder(UsersCollection, {
      name: { label: "Name" },
    });

    const descriptor = builder.describe();

    expect(descriptor.columns[0].values).toBeUndefined();
  });
});
