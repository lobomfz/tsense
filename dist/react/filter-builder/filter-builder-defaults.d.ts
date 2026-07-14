import type { AddButtonSlotProps, ConditionSelectSlotProps, FieldSelectSlotProps, RemoveButtonSlotProps, ValueInputSlotProps } from "./filter-builder-types.js";
export declare function defaultFieldSelect({ columns, value, onChange }: FieldSelectSlotProps): import("react/jsx-runtime").JSX.Element;
export declare function defaultConditionSelect({ conditions, value, onChange, disabled }: ConditionSelectSlotProps): import("react/jsx-runtime").JSX.Element;
export declare function defaultValueInput({ column, condition, value, onChange }: ValueInputSlotProps): import("react/jsx-runtime").JSX.Element;
export declare function defaultRemoveButton({ onClick }: RemoveButtonSlotProps): import("react/jsx-runtime").JSX.Element;
export declare function defaultAddButton({ onClick }: AddButtonSlotProps): import("react/jsx-runtime").JSX.Element;
