import type { FilterDescriptor } from "./index.js";

export type FilterValue =
  | string
  | string[]
  | number
  | boolean
  | Date
  | [FilterValue | undefined, FilterValue | undefined]
  | undefined;

export type FilterRow = {
  id: number;
  field?: string;
  condition?: string;
  value?: FilterValue;
};

type ScalarCondition = "equals" | "not_equals" | "gt" | "gte" | "lt" | "lte";
type ArrayCondition = "is_in" | "is_not_in";
type RangeCondition = "between";

type CompleteFilterRow =
  | {
      id: number;
      field: string;
      condition: RangeCondition;
      value: [FilterValue, FilterValue];
    }
  | {
      id: number;
      field: string;
      condition: ArrayCondition;
      value: string[];
    }
  | {
      id: number;
      field: string;
      condition: ScalarCondition;
      value: FilterValue;
    };

export type FilterState = {
  rows: FilterRow[];
};

const conditionToOperator: Record<string, string | null> = {
  equals: null,
  not_equals: "not",
  gt: "gt",
  gte: "gte",
  lt: "lt",
  lte: "lte",
  between: null,
  is_in: null,
  is_not_in: "notIn",
};

let nextRowId = 0;

export function createInitialState(): FilterState {
  return { rows: [{ id: ++nextRowId }] };
}

export function addRow(state: FilterState): FilterState {
  return { rows: [...state.rows, { id: ++nextRowId }] };
}

export function removeRow(state: FilterState, index: number): FilterState {
  return { rows: state.rows.filter((_, i) => i !== index) };
}

export function setRowField(
  state: FilterState,
  index: number,
  field: string,
): FilterState {
  return {
    rows: state.rows.map((row, i) =>
      i === index ? { id: row.id, field } : row,
    ),
  };
}

export function setRowCondition(
  state: FilterState,
  index: number,
  condition: string,
): FilterState {
  return {
    rows: state.rows.map((row, i) =>
      i === index ? { ...row, condition, value: undefined } : row,
    ),
  };
}

export function setRowValue(
  state: FilterState,
  index: number,
  value: FilterValue,
): FilterState {
  return {
    rows: state.rows.map((row, i) => (i === index ? { ...row, value } : row)),
  };
}

export function clearState(): FilterState {
  return { rows: [] };
}

export function applyPreset<T>(
  state: FilterState,
  descriptor: FilterDescriptor<T>,
  field: string,
  name: string,
): FilterState {
  const column = descriptor.columns.find((c) => c.key === field);
  const preset = column?.presets?.find((p) => p.name === name);

  if (!preset) return state;

  const filterValue = preset.filter[field] as FilterValue;

  if (filterValue == null) return state;

  if (Array.isArray(filterValue)) {
    return {
      rows: [
        ...state.rows,
        { id: ++nextRowId, field, condition: "is_in", value: filterValue },
      ],
    };
  }

  if (typeof filterValue !== "object" || filterValue instanceof Date) {
    return {
      rows: [
        ...state.rows,
        { id: ++nextRowId, field, condition: "equals", value: filterValue },
      ],
    };
  }

  const ops = filterValue as unknown as Record<string, FilterValue>;
  const keys = Object.keys(ops);

  if (keys.includes("gte") && keys.includes("lte")) {
    return {
      rows: [
        ...state.rows,
        {
          id: ++nextRowId,
          field,
          condition: "between",
          value: [ops.gte, ops.lte],
        },
      ],
    };
  }

  if (keys[0]) {
    return {
      rows: [
        ...state.rows,
        { id: ++nextRowId, field, condition: keys[0], value: ops[keys[0]] },
      ],
    };
  }

  return state;
}

export function conditionsFor<T>(
  descriptor: FilterDescriptor<T>,
  field: string,
): FilterDescriptor<T>["columns"][number]["conditions"] {
  const column = descriptor.columns.find((c) => c.key === field);

  return column?.conditions ?? [];
}

export function columnFor<T>(
  descriptor: FilterDescriptor<T>,
  field: string,
): FilterDescriptor<T>["columns"][number] {
  const column = descriptor.columns.find((c) => c.key === field);

  if (!column) {
    throw new Error(`Column not found: ${field}`);
  }

  return column;
}

function isRowComplete(row: FilterRow): row is CompleteFilterRow {
  if (!row.field || !row.condition || row.value == null) return false;

  if (row.condition === "between") {
    return (
      Array.isArray(row.value) && row.value[0] != null && row.value[1] != null
    );
  }

  if (row.condition === "is_in" || row.condition === "is_not_in") {
    return Array.isArray(row.value) && row.value.length > 0;
  }

  return true;
}

export function buildResult(state: FilterState): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const row of state.rows) {
    if (!isRowComplete(row)) continue;

    if (row.condition === "equals" || row.condition === "is_in") {
      result[row.field] = row.value;
      continue;
    }

    if (row.condition === "between") {
      const [min, max] = row.value;
      const existing =
        typeof result[row.field] === "object" && result[row.field] !== null
          ? (result[row.field] as Record<string, unknown>)
          : {};
      result[row.field] = { ...existing, gte: min, lte: max };
      continue;
    }

    const operator = conditionToOperator[row.condition];

    if (!operator) continue;

    const existing = result[row.field];

    if (
      typeof existing === "object" &&
      existing !== null &&
      !Array.isArray(existing)
    ) {
      result[row.field] = {
        ...(existing as Record<string, unknown>),
        [operator]: row.value,
      };
    } else {
      result[row.field] = { [operator]: row.value };
    }
  }

  return result;
}
