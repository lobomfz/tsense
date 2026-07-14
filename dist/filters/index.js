export { isRelativeDate, resolveRelativeDate } from "./relative-dates.js";
export { deserializeFilter, serializeFilter } from "./url.js";
import { type } from "arktype";
const tsenseTypeMap = {
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
};
const enumConditions = [
    { key: "is_in", label: "is in" },
    { key: "is_not_in", label: "is not in" },
];
const conditionsByType = {
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
export function createFilterBuilder(collection, config, options) {
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
            const fieldSchemas = {
                number: type.raw("number").or(type.raw("number[]")).or(numberOps),
                string: type.raw("string").or(type.raw("string[]")).or(stringOps),
                boolean: type.raw("boolean"),
                date: dateInput.or(dateArrayInput).or(dateOps),
            };
            const descriptor = this.describe();
            const filterDef = {};
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
                .as();
        },
        describe() {
            const columns = [];
            const withLabels = (conditions, typeKey) => {
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
                const fieldConfig = config[field.name];
                if (!fieldConfig)
                    continue;
                const columnType = field.sourceExpression === "Date"
                    ? "date"
                    : tsenseTypeMap[field.type];
                if (!columnType)
                    continue;
                const column = {
                    key: field.name,
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
            return { infer: undefined, columns };
        },
    };
}
