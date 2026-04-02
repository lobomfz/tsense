import { Fragment, type ReactNode, useEffect, useRef } from "react";
import type { FilterValue } from "../filters/filter-state.js";
import type { FilterDescriptor } from "../filters/index.js";
import type { FilterFor } from "../types.js";
import { useFilterBuilder } from "./use-filter-builder.js";

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
  preset: { field: string; name: string };
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

function defaultFieldSelect({
  columns,
  value,
  onChange,
}: FieldSelectSlotProps) {
  return (
    <select
      className="rounded border px-2 py-1"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Column</option>
      {columns.map((col) => (
        <option key={col.key} value={col.key}>
          {col.label}
        </option>
      ))}
    </select>
  );
}

function defaultConditionSelect({
  conditions,
  value,
  onChange,
  disabled,
}: ConditionSelectSlotProps) {
  return (
    <select
      className="rounded border px-2 py-1"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      <option value="">Condition</option>
      {conditions.map((c) => (
        <option key={c.key} value={c.key}>
          {c.label}
        </option>
      ))}
    </select>
  );
}

function formatDateForInput(date: unknown): string {
  if (!(date instanceof Date)) return "";

  return date.toISOString().slice(0, 10);
}

function parseDateInput(str: string): Date | undefined {
  if (!str) return undefined;

  return new Date(str + "T00:00:00Z");
}

function asTuple(
  value: FilterValue,
): [FilterValue | undefined, FilterValue | undefined] {
  if (Array.isArray(value)) {
    return [value[0], value[1]];
  }

  return [undefined, undefined];
}

function defaultValueInput({
  column,
  condition,
  value,
  onChange,
}: ValueInputSlotProps) {
  if (condition === "between" && column.type === "date") {
    const tuple = asTuple(value);

    return (
      <div className="flex items-center gap-1">
        <input
          className="rounded border px-2 py-1"
          type="date"
          value={formatDateForInput(tuple[0])}
          onChange={(e) => onChange([parseDateInput(e.target.value), tuple[1]])}
        />
        <span className="text-sm text-gray-500">and</span>
        <input
          className="rounded border px-2 py-1"
          type="date"
          value={formatDateForInput(tuple[1])}
          onChange={(e) => onChange([tuple[0], parseDateInput(e.target.value)])}
        />
      </div>
    );
  }

  if (condition === "between") {
    const tuple = asTuple(value);

    return (
      <div className="flex items-center gap-1">
        <input
          className="w-24 rounded border px-2 py-1"
          type="number"
          value={String(tuple[0] ?? "")}
          onChange={(e) => onChange([Number(e.target.value), tuple[1]])}
        />
        <span className="text-sm text-gray-500">and</span>
        <input
          className="w-24 rounded border px-2 py-1"
          type="number"
          value={String(tuple[1] ?? "")}
          onChange={(e) => onChange([tuple[0], Number(e.target.value)])}
        />
      </div>
    );
  }

  if (column.values) {
    const selected = Array.isArray(value) ? (value as string[]) : [];

    return (
      <div className="flex flex-wrap gap-2">
        {column.values.map((v) => {
          const checked = selected.includes(v.value);

          return (
            <label key={v.value} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  onChange(
                    checked
                      ? selected.filter((s) => s !== v.value)
                      : [...selected, v.value],
                  )
                }
              />
              {v.label}
            </label>
          );
        })}
      </div>
    );
  }

  if (column.type === "date") {
    return (
      <input
        className="rounded border px-2 py-1"
        type="date"
        value={formatDateForInput(value)}
        onChange={(e) => onChange(parseDateInput(e.target.value))}
      />
    );
  }

  if (column.type === "number") {
    return (
      <input
        className="rounded border px-2 py-1"
        type="number"
        value={String(value ?? "")}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    );
  }

  if (column.type === "boolean") {
    return (
      <select
        className="rounded border px-2 py-1"
        value={value == null ? "" : String(value)}
        onChange={(e) => onChange(e.target.value === "true")}
      >
        <option value="">Value</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }

  return (
    <input
      className="rounded border px-2 py-1"
      type="text"
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function defaultRemoveButton({ onClick }: RemoveButtonSlotProps) {
  return (
    <button className="text-red-500 hover:text-red-700" onClick={onClick}>
      ×
    </button>
  );
}

function defaultAddButton({ onClick }: AddButtonSlotProps) {
  return (
    <button className="text-blue-500 hover:text-blue-700" onClick={onClick}>
      + Add filter
    </button>
  );
}

function defaultPresetButton({ preset, onClick }: PresetButtonSlotProps) {
  return (
    <button
      className="rounded bg-gray-100 px-2 py-1 text-sm hover:bg-gray-200"
      onClick={onClick}
    >
      {preset.name}
    </button>
  );
}

export function FilterBuilder<T>({
  descriptor,
  onChange,
  renderRoot,
  renderRow,
  renderFieldSelect,
  renderConditionSelect,
  renderValueInput,
  renderAddButton,
  renderRemoveButton,
  renderPresetButton,
}: FilterBuilderProps<T>): ReactNode {
  const filters = useFilterBuilder(descriptor);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    onChangeRef.current?.(filters.result as FilterFor<T>);
  }, [filters.result]);

  const FieldSelect = renderFieldSelect ?? defaultFieldSelect;
  const ConditionSelect = renderConditionSelect ?? defaultConditionSelect;
  const ValueInput = renderValueInput ?? defaultValueInput;
  const RemoveButton = renderRemoveButton ?? defaultRemoveButton;
  const AddButton = renderAddButton ?? defaultAddButton;
  const PresetButton = renderPresetButton ?? defaultPresetButton;

  const rows = filters.rows.map((row, i) => {
    const fieldSelect = (
      <FieldSelect
        columns={filters.columns}
        value={row.field}
        onChange={(field) => filters.setField(i, field)}
      />
    );

    const conditionSelect = (
      <ConditionSelect
        conditions={row.field ? filters.conditionsFor(row.field) : []}
        value={row.condition}
        onChange={(condition) => filters.setCondition(i, condition)}
        disabled={!row.field}
      />
    );

    const column = row.field
      ? filters.columns.find((c) => c.key === row.field)
      : undefined;

    const valueInput =
      row.field && row.condition && column ? (
        <ValueInput
          column={column}
          condition={row.condition}
          value={row.value}
          onChange={(v) => filters.setValue(i, v)}
        />
      ) : null;

    const removeButton = <RemoveButton onClick={() => filters.remove(i)} />;

    if (renderRow) {
      return (
        <Fragment key={row.id}>
          {renderRow({
            index: i,
            fieldSelect,
            conditionSelect,
            valueInput,
            removeButton,
          })}
        </Fragment>
      );
    }

    return (
      <div key={row.id} className="flex items-center gap-2">
        {fieldSelect}
        {conditionSelect}
        {valueInput}
        {removeButton}
      </div>
    );
  });

  const addButton = <AddButton onClick={filters.add} />;

  const presets =
    filters.presets.length > 0 ? (
      <div className="flex flex-wrap gap-1 border-t pt-2">
        {filters.presets.map((preset) => (
          <Fragment key={`${preset.field}-${preset.name}`}>
            <PresetButton
              preset={preset}
              onClick={() => filters.applyPreset(preset.field, preset.name)}
            />
          </Fragment>
        ))}
      </div>
    ) : null;

  if (renderRoot) {
    return <>{renderRoot({ rows: <>{rows}</>, addButton, presets })}</>;
  }

  return (
    <div className="flex flex-col gap-2">
      {rows}
      {addButton}
      {presets}
    </div>
  );
}
