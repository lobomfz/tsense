import { type ReactNode } from "react";
import type { FilterValue } from "../filters/filter-state.js";
import type { FilterDescriptor } from "../filters/index.js";
import type { FilterFor } from "../types.js";
export type FieldSelectSlotProps = {
    columns: FilterDescriptor["columns"];
    value: string | undefined;
    onChange: (field: string) => void;
};
export type ConditionSelectSlotProps = {
    conditions: FilterDescriptor["columns"][number]["conditions"];
    value: string | undefined;
    onChange: (condition: string) => void;
    disabled: boolean;
};
export type ValueInputSlotProps = {
    column: FilterDescriptor["columns"][number];
    condition: string;
    value: FilterValue;
    onChange: (value: FilterValue) => void;
};
export type RemoveButtonSlotProps = {
    onClick: () => void;
};
export type AddButtonSlotProps = {
    onClick: () => void;
};
export type PresetButtonSlotProps = {
    preset: {
        field: string;
        name: string;
    };
    onClick: () => void;
};
export type RowSlotProps = {
    index: number;
    fieldSelect: ReactNode;
    conditionSelect: ReactNode;
    valueInput: ReactNode | null;
    removeButton: ReactNode;
};
export type RootSlotProps = {
    rows: ReactNode;
    addButton: ReactNode;
    presets: ReactNode | null;
};
type FilterBuilderProps<T> = {
    descriptor: FilterDescriptor<T>;
    onChange?: (filter: FilterFor<T>) => void;
    renderRoot?: (props: RootSlotProps) => ReactNode;
    renderRow?: (props: RowSlotProps) => ReactNode;
    renderFieldSelect?: (props: FieldSelectSlotProps) => ReactNode;
    renderConditionSelect?: (props: ConditionSelectSlotProps) => ReactNode;
    renderValueInput?: (props: ValueInputSlotProps) => ReactNode;
    renderAddButton?: (props: AddButtonSlotProps) => ReactNode;
    renderRemoveButton?: (props: RemoveButtonSlotProps) => ReactNode;
    renderPresetButton?: (props: PresetButtonSlotProps) => ReactNode;
};
export declare function FilterBuilder<T>({ descriptor, onChange, renderRoot, renderRow, renderFieldSelect, renderConditionSelect, renderValueInput, renderAddButton, renderRemoveButton, renderPresetButton }: FilterBuilderProps<T>): ReactNode;
export {};
