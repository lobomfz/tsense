import type { FilterDescriptor } from "./index.js";

type ColumnType = FilterDescriptor["columns"][number]["type"];

const ARRAY_OPERATORS = new Set(["notIn"]);

function serializeValue(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function coerceValue(raw: string, columnType: ColumnType): unknown {
  if (columnType === "number") {
    return Number(raw);
  }

  if (columnType === "boolean") {
    return raw === "true";
  }

  if (columnType === "date") {
    return new Date(raw);
  }

  return raw;
}

export function serializeFilter(
  filter: Record<string, unknown>,
  descriptor: FilterDescriptor,
): URLSearchParams {
  const params = new URLSearchParams();
  const columnMap = new Map(descriptor.columns.map((c) => [c.key, c]));

  for (const [key, value] of Object.entries(filter)) {
    const column = columnMap.get(key);

    if (!column || value == null) {
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length === 1) {
        params.set(key, serializeValue(value[0]));
      } else if (value.length > 1) {
        params.set(key, value.map((v) => serializeValue(v)).join(","));
      }

      continue;
    }

    if (typeof value === "object" && !(value instanceof Date)) {
      for (const [op, opValue] of Object.entries(
        value as Record<string, unknown>,
      )) {
        if (opValue == null) {
          continue;
        }

        if (Array.isArray(opValue)) {
          params.set(
            `${key}.${op}`,
            opValue.map((v) => serializeValue(v)).join(","),
          );
        } else {
          params.set(`${key}.${op}`, serializeValue(opValue));
        }
      }

      continue;
    }

    params.set(key, serializeValue(value));
  }

  return params;
}

export function deserializeFilter(
  params: URLSearchParams,
  descriptor: FilterDescriptor,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const columnMap = new Map(descriptor.columns.map((c) => [c.key, c]));

  for (const [paramKey, rawValue] of params.entries()) {
    const dotIndex = paramKey.indexOf(".");

    if (dotIndex !== -1) {
      const field = paramKey.slice(0, dotIndex);
      const operator = paramKey.slice(dotIndex + 1);
      const column = columnMap.get(field);

      if (!column) {
        continue;
      }

      const existing = (result[field] ?? {}) as Record<string, unknown>;

      if (ARRAY_OPERATORS.has(operator)) {
        existing[operator] = rawValue
          .split(",")
          .map((v) => coerceValue(v, column.type));
      } else {
        existing[operator] = coerceValue(rawValue, column.type);
      }

      result[field] = existing;
      continue;
    }

    const column = columnMap.get(paramKey);

    if (!column) {
      continue;
    }

    if (rawValue.includes(",")) {
      result[paramKey] = rawValue
        .split(",")
        .map((v) => coerceValue(v, column.type));
    } else {
      result[paramKey] = coerceValue(rawValue, column.type);
    }
  }

  return result;
}
