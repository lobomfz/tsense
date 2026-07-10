export { isRelativeDate, resolveRelativeDate } from "./relative-dates.js";
export { deserializeFilter, serializeFilter } from "./url.js";
import { type } from "arktype";
import type { Type } from "arktype";
import type { TsenseFieldType } from "../env.js";
import type { TSense } from "../tsense.js";
import type { FilterFor, SearchInput, TsenseSchema } from "../types.js";

export type FilterDescriptor<T = Record<string, unknown>> = {
  infer: FilterFor<T>;
  columns: {
    key: keyof T & string;
    label: string;
    type: "string" | "number" | "boolean" | "date";
    conditions: { key: string; label: string }[];
    values?: { value: string; label: string }[];
  }[];
};

type FilterBuilderFieldConfig = {
  label: string;
  labels?: Record<string, string>;
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

type FilterBuilderOptions = {
  conditionLabels?: Partial<
    Record<ColumnType | "enum", Partial<Record<string, string>>>
  >;
};

export function createFilterBuilder<T extends TsenseSchema>(
  collection: TSense<T>,
  config: { [K in keyof T["infer"]]?: FilterBuilderFieldConfig },
  options?: FilterBuilderOptions,
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

      const relativeDateUnit = "'day' | 'week' | 'month'";

      const relativeDate = type
        .raw({ startOf: relativeDateUnit })
        .or(type.raw({ endOf: relativeDateUnit }));

      const concreteDateInput = type.raw("number | string | Date");
      const dateInput = concreteDateInput.or(relativeDate);
      const dateArrayInput = dateInput.array();

      const dateOps = type.raw({
        "not?": dateInput,
        "gt?": dateInput,
        "gte?": dateInput,
        "lt?": dateInput,
        "lte?": dateInput,
        "notIn?": dateArrayInput,
      });

      const fieldSchemas: Record<ColumnType, unknown> = {
        number: type.raw("number").or(type.raw("number[]")).or(numberOps),
        string: type.raw("string").or(type.raw("string[]")).or(stringOps),
        boolean: type.raw("boolean"),
        date: dateInput.or(dateArrayInput).or(dateOps),
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

      const withLabels = (
        conditions: Condition[],
        typeKey: ColumnType | "enum",
      ): Condition[] => {
        const overrides = options?.conditionLabels?.[typeKey];

        if (!overrides) {
          return conditions;
        }

        return conditions.map((c) => ({
          key: c.key,
          label: overrides[c.key] ?? c.label,
        }));
      };

      for (const field of fields) {
        const fieldConfig = (
          config as Record<string, FilterBuilderFieldConfig | undefined>
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
          conditions: withLabels(conditionsByType[columnType], columnType),
        };

        if (field.enumValues?.length) {
          column.values = field.enumValues.map((v) => ({
            value: v,
            label: fieldConfig.labels?.[v] ?? v,
          }));
          column.conditions = withLabels(enumConditions, "enum");
        }

        columns.push(column);
      }

      return { infer: undefined as unknown as FilterFor<T["infer"]>, columns };
    },
  };
}
