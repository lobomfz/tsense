export { isRelativeDate, resolveRelativeDate } from "./relative-dates.js";
export { deserializeFilter, serializeFilter } from "./url.js";
import type { Type } from "arktype";
import type { TSense } from "../tsense.js";
import type { FilterFor, SearchInput, TsenseSchema } from "../types.js";
export type FilterDescriptor<T = Record<string, unknown>> = {
    infer: FilterFor<T>;
    columns: {
        key: keyof T & string;
        label: string;
        type: "string" | "number" | "boolean" | "date";
        conditions: {
            key: string;
            label: string;
        }[];
        values?: {
            value: string;
            label: string;
        }[];
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
type FilterBuilderOptions = {
    conditionLabels?: Partial<Record<ColumnType | "enum", Partial<Record<string, string>>>>;
};
export declare function createFilterBuilder<T extends TsenseSchema>(collection: TSense<T>, config: {
    [K in keyof T["infer"]]?: FilterBuilderFieldConfig;
}, options?: FilterBuilderOptions): FilterBuilderReturn<T["infer"]>;
