import { type } from "arktype";
import type { Type } from "arktype";
import type { TsenseFieldType } from "../env.js";
import type { TSense } from "../tsense.js";
import type { FilterFor, SearchInput } from "../types.js";

export type FilterDescriptor<T = Record<string, unknown>> = {
  infer: FilterFor<T>;
  columns: {
    key: keyof T & string;
    label: string;
    type: "string" | "number" | "boolean" | "date";
    conditions: { key: string; label: string }[];
    values?: { value: string; label: string }[];
    presets?: { name: string; filter: Record<string, unknown> }[];
  }[];
};

type FilterBuilderFieldConfig<T> = {
  label: string;
  labels?: Record<string, string>;
  presets?: Record<string, FilterFor<T>>;
};

type FilterBuilderReturn<T> = {
  describe(): FilterDescriptor<T>;
  schema(): Type<SearchInput<T>>;
};

type ColumnType = FilterDescriptor["columns"][number]["type"];
type Condition = FilterDescriptor["columns"][number]["conditions"][number];

const tsenseTypeMap: Record<string, ColumnType | undefined> = {
  string: "string",
  "string*": "string",
  "string[]": "string",
  int32: "number",
  int64: "number",
  float: "number",
  "int32[]": "number",
  "int64[]": "number",
  "float[]": "number",
  bool: "boolean",
  "bool[]": "boolean",
  auto: "string",
  image: "string",
} satisfies Partial<Record<TsenseFieldType, ColumnType>>;

const enumConditions: Condition[] = [
  { key: "is_in", label: "is in" },
  { key: "is_not_in", label: "is not in" },
];

const conditionsByType: Record<ColumnType, Condition[]> = {
  string: [
    { key: "equals", label: "equals" },
    { key: "not_equals", label: "not equals" },
  ],
  number: [
    { key: "equals", label: "equals" },
    { key: "not_equals", label: "not equals" },
    { key: "gt", label: "greater than" },
    { key: "gte", label: "greater than or equal" },
    { key: "lt", label: "less than" },
    { key: "lte", label: "less than or equal" },
    { key: "between", label: "between" },
  ],
  boolean: [{ key: "equals", label: "equals" }],
  date: [
    { key: "equals", label: "equals" },
    { key: "not_equals", label: "not equals" },
    { key: "gt", label: "after" },
    { key: "lt", label: "before" },
    { key: "between", label: "between" },
  ],
};

export function createFilterBuilder<T extends Type>(
  collection: TSense<T>,
  config: { [K in keyof T["infer"]]?: FilterBuilderFieldConfig<T["infer"]> },
): FilterBuilderReturn<T["infer"]> {
  const fields = collection.fields;

  return {
    schema() {
      const numberOps = type.raw({
        "not?": "number",
        "gt?": "number",
        "gte?": "number",
        "lt?": "number",
        "lte?": "number",
        "notIn?": "number[]",
      });

      const stringOps = type.raw({
        "not?": "string",
        "notIn?": "string[]",
      });

      const fieldSchemas: Record<ColumnType, unknown> = {
        number: type.raw("number").or(type.raw("number[]")).or(numberOps),
        string: type.raw("string").or(type.raw("string[]")).or(stringOps),
        boolean: type.raw("boolean"),
        date: type.raw("number").or(type.raw("number[]")).or(numberOps),
      };

      const descriptor = this.describe();
      const filterDef: Record<string, unknown> = {};

      for (const column of descriptor.columns) {
        filterDef[`${column.key}?`] = fieldSchemas[column.type];
      }

      return type
        .raw({
          "query?": "string",
          "filter?": type.raw(filterDef),
          "page?": "number",
          "limit?": "number",
        })
        .as<SearchInput<T["infer"]>>();
    },

    describe() {
      const columns: FilterDescriptor<T["infer"]>["columns"] = [];

      for (const field of fields) {
        const fieldConfig = (
          config as Record<
            string,
            FilterBuilderFieldConfig<T["infer"]> | undefined
          >
        )[field.name];

        if (!fieldConfig) continue;

        const columnType =
          field.sourceExpression === "Date"
            ? ("date" as const)
            : tsenseTypeMap[field.type];

        if (!columnType) continue;

        const column: FilterDescriptor<T["infer"]>["columns"][number] = {
          key: field.name as keyof T["infer"] & string,
          label: fieldConfig.label,
          type: columnType,
          conditions: conditionsByType[columnType],
        };

        if (field.enumValues?.length) {
          column.values = field.enumValues.map((v) => ({
            value: v,
            label: fieldConfig.labels?.[v] ?? v,
          }));
          column.conditions = enumConditions;
        }

        if (fieldConfig.presets) {
          column.presets = Object.entries(fieldConfig.presets).map(
            ([name, filter]) => ({
              name,
              filter: filter as Record<string, unknown>,
            }),
          );
        }

        columns.push(column);
      }

      return { infer: undefined as unknown as FilterFor<T["infer"]>, columns };
    },
  };
}
