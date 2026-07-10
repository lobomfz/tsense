import type {
  AddButtonSlotProps,
  ConditionSelectSlotProps,
  FieldSelectSlotProps,
  RemoveButtonSlotProps,
  ValueInputSlotProps,
} from "./filter-builder-types.js";

function formatDateForInput(date: unknown) {
  if (!(date instanceof Date)) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function parseDateInput(value: string) {
  if (!value) {
    return;
  }

  return new Date(value + "T00:00:00Z");
}

function parseNumberInput(value: string) {
  if (!value) {
    return;
  }

  return Number(value);
}

function parseBooleanInput(value: string) {
  if (!value) {
    return;
  }

  return value === "true";
}

function asTuple(value: ValueInputSlotProps["value"]) {
  if (Array.isArray(value)) {
    return [value[0], value[1]];
  }

  return [undefined, undefined];
}

function renderSelectOptions(
  options: { key: string; label: string }[],
  defaultValue?: string,
) {
  const allOptions = defaultValue
    ? [{ key: "", label: defaultValue }, ...options]
    : options;

  return allOptions.map((option) => (
    <option key={option.key} value={option.key}>
      {option.label}
    </option>
  ));
}

export function defaultFieldSelect({
  columns,
  value,
  onChange,
}: FieldSelectSlotProps) {
  return (
    <select
      className="rounded border px-2 py-1"
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
    >
      {renderSelectOptions(columns, "Column")}
    </select>
  );
}

export function defaultConditionSelect({
  conditions,
  value,
  onChange,
  disabled,
}: ConditionSelectSlotProps) {
  return (
    <select
      className="rounded border px-2 py-1"
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
    >
      {renderSelectOptions(conditions, "Condition")}
    </select>
  );
}

export function defaultValueInput({
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
          onChange={(event) =>
            onChange([parseDateInput(event.target.value), tuple[1]])
          }
        />
        <span className="text-sm text-gray-500">and</span>
        <input
          className="rounded border px-2 py-1"
          type="date"
          value={formatDateForInput(tuple[1])}
          onChange={(event) =>
            onChange([tuple[0], parseDateInput(event.target.value)])
          }
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
          onChange={(event) =>
            onChange([parseNumberInput(event.target.value), tuple[1]])
          }
        />
        <span className="text-sm text-gray-500">and</span>
        <input
          className="w-24 rounded border px-2 py-1"
          type="number"
          value={String(tuple[1] ?? "")}
          onChange={(event) =>
            onChange([tuple[0], parseNumberInput(event.target.value)])
          }
        />
      </div>
    );
  }

  if (column.values) {
    const selected = Array.isArray(value) ? (value as string[]) : [];

    return (
      <div className="flex flex-wrap gap-2">
        {column.values.map((option) => {
          const checked = selected.includes(option.value);

          return (
            <label
              key={option.value}
              className="flex cursor-pointer select-none items-center gap-1 text-sm"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  onChange(
                    checked
                      ? selected.filter((item) => item !== option.value)
                      : [...selected, option.value],
                  )
                }
              />
              {option.label}
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
        onChange={(event) => onChange(parseDateInput(event.target.value))}
      />
    );
  }

  if (column.type === "number") {
    return (
      <input
        className="rounded border px-2 py-1"
        type="number"
        value={String(value ?? "")}
        onChange={(event) => onChange(parseNumberInput(event.target.value))}
      />
    );
  }

  if (column.type === "boolean") {
    const options = [
      { key: "", label: "Value" },
      { key: "true", label: "true" },
      { key: "false", label: "false" },
    ];

    return (
      <select
        className="rounded border px-2 py-1"
        value={value == null ? "" : String(value)}
        onChange={(event) => onChange(parseBooleanInput(event.target.value))}
      >
        {renderSelectOptions(options)}
      </select>
    );
  }

  return (
    <input
      className="rounded border px-2 py-1"
      type="text"
      value={typeof value === "string" ? value : ""}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function defaultRemoveButton({ onClick }: RemoveButtonSlotProps) {
  return (
    <button
      type="button"
      className="text-red-500 hover:text-red-700"
      onClick={onClick}
    >
      ×
    </button>
  );
}

export function defaultAddButton({ onClick }: AddButtonSlotProps) {
  return (
    <button
      type="button"
      className="text-blue-500 hover:text-blue-700"
      onClick={onClick}
    >
      + Add filter
    </button>
  );
}
