const ARRAY_OPERATORS = new Set(["notIn"]);
function serializeValue(value) {
    if (value instanceof Date) {
        return value.toISOString();
    }
    return String(value);
}
function coerceValue(raw, columnType) {
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
function appendValues(params, key, values) {
    for (const value of values) {
        params.append(key, serializeValue(value));
    }
}
export function serializeFilter(filter, descriptor) {
    const params = new URLSearchParams();
    const columnMap = new Map(descriptor.columns.map((c) => [c.key, c]));
    for (const [key, value] of Object.entries(filter)) {
        const column = columnMap.get(key);
        if (!column || value == null) {
            continue;
        }
        if (Array.isArray(value)) {
            appendValues(params, key, value);
            continue;
        }
        if (typeof value === "object" && !(value instanceof Date)) {
            for (const [op, opValue] of Object.entries(value)) {
                if (opValue == null) {
                    continue;
                }
                if (Array.isArray(opValue)) {
                    appendValues(params, `${key}.${op}`, opValue);
                }
                else {
                    params.set(`${key}.${op}`, serializeValue(opValue));
                }
            }
            continue;
        }
        params.set(key, serializeValue(value));
    }
    return params;
}
export function deserializeFilter(params, descriptor) {
    const result = {};
    const columnMap = new Map(descriptor.columns.map((c) => [c.key, c]));
    const visited = new Set();
    for (const paramKey of params.keys()) {
        if (visited.has(paramKey)) {
            continue;
        }
        visited.add(paramKey);
        const rawValues = params.getAll(paramKey);
        const dotIndex = paramKey.indexOf(".");
        if (dotIndex !== -1) {
            const field = paramKey.slice(0, dotIndex);
            const operator = paramKey.slice(dotIndex + 1);
            const column = columnMap.get(field);
            if (!column) {
                continue;
            }
            const existing = (result[field] ?? {});
            if (ARRAY_OPERATORS.has(operator)) {
                existing[operator] = rawValues.map((value) => coerceValue(value, column.type));
            }
            else {
                existing[operator] = coerceValue(rawValues[0], column.type);
            }
            result[field] = existing;
            continue;
        }
        const column = columnMap.get(paramKey);
        if (!column) {
            continue;
        }
        if (rawValues.length > 1) {
            result[paramKey] = rawValues.map((value) => coerceValue(value, column.type));
        }
        else {
            result[paramKey] = coerceValue(rawValues[0], column.type);
        }
    }
    return result;
}
