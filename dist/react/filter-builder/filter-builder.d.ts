import { type ReactNode } from "react";
import type { FilterBuilderProps } from "./filter-builder-types.js";
export declare function FilterBuilder<T>({ descriptor, onChange, renderRoot, renderRow, renderFieldSelect, renderConditionSelect, renderValueInput, renderAddButton, renderRemoveButton }: FilterBuilderProps<T>): ReactNode;
