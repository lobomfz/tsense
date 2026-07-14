import type { RelativeDate } from "../types.js";
import type { FilterDescriptor } from "./index.js";
export type FilterValue = string | string[] | number | boolean | Date | RelativeDate | [FilterValue | undefined, FilterValue | undefined] | undefined;
export type FilterRow = {
    id: number;
    field?: string;
    condition?: string;
    value?: FilterValue;
};
export type FilterState = {
    rows: FilterRow[];
    manualRowIds: Set<number>;
};
export declare function createInitialState(): FilterState;
export declare function addRow(state: FilterState): FilterState;
export declare function addRowWithField(state: FilterState, field: string): FilterState;
export declare function removeRow(state: FilterState, index: number): FilterState;
export declare function setRowField(state: FilterState, index: number, field: string): FilterState;
export declare function setRowCondition(state: FilterState, index: number, condition: string): FilterState;
export declare function setRowValue(state: FilterState, index: number, value: FilterValue): FilterState;
export declare function restoreRows(rows: Omit<FilterRow, "id">[]): FilterState;
export declare function clearState(): FilterState;
export declare function hasManualRows(state: FilterState): boolean;
export declare function conditionsFor<T>(descriptor: FilterDescriptor<T>, field: string): FilterDescriptor<T>["columns"][number]["conditions"];
export declare function columnFor<T>(descriptor: FilterDescriptor<T>, field: string): FilterDescriptor<T>["columns"][number];
export declare function buildResult(state: FilterState): Record<string, unknown>;
