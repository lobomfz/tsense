import { useMemo, useState } from "react";
import {
  addRow,
  applyPreset as applyPresetState,
  buildResult,
  clearState,
  columnFor,
  conditionsFor,
  createInitialState,
  removeRow,
  setRowCondition,
  setRowField,
  setRowValue,
  type FilterRow,
  type FilterValue,
} from "../filters/filter-state.js";
import type { FilterDescriptor } from "../filters/index.js";

type Preset = { field: string; name: string };

type UseFilterBuilderReturn = {
  columns: FilterDescriptor["columns"];
  rows: FilterRow[];
  add: () => void;
  remove: (index: number) => void;
  setField: (index: number, field: string) => void;
  setCondition: (index: number, condition: string) => void;
  setValue: (index: number, value: FilterValue) => void;
  clear: () => void;
  conditionsFor: (
    field: string,
  ) => FilterDescriptor["columns"][number]["conditions"];
  columnFor: (field: string) => FilterDescriptor["columns"][number];
  presets: Preset[];
  applyPreset: (field: string, name: string) => void;
  result: Record<string, unknown>;
};

export function useFilterBuilder<T>(
  descriptor: FilterDescriptor<T>,
): UseFilterBuilderReturn {
  const [state, setState] = useState(createInitialState);

  const presets = useMemo(
    () =>
      descriptor.columns.flatMap((col) =>
        (col.presets ?? []).map((p) => ({ field: col.key, name: p.name })),
      ),
    [descriptor],
  );

  const result = useMemo(() => buildResult(state), [state]);

  return {
    columns: descriptor.columns,
    rows: state.rows,
    add: () => setState(addRow),
    remove: (index: number) => setState((s) => removeRow(s, index)),
    setField: (index: number, field: string) =>
      setState((s) => setRowField(s, index, field)),
    setCondition: (index: number, condition: string) =>
      setState((s) => setRowCondition(s, index, condition)),
    setValue: (index: number, value: FilterValue) =>
      setState((s) => setRowValue(s, index, value)),
    clear: () => setState(clearState),
    conditionsFor: (field: string) => conditionsFor(descriptor, field),
    columnFor: (field: string) => columnFor(descriptor, field),
    presets,
    applyPreset: (field: string, name: string) =>
      setState((s) => applyPresetState(s, descriptor, field, name)),
    result,
  };
}
