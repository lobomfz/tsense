const conditionToOperator = {
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
export function createInitialState() {
    return { rows: [], manualRowIds: new Set() };
}
export function addRow(state) {
    const id = ++nextRowId;
    return {
        rows: [...state.rows, { id }],
        manualRowIds: new Set([...state.manualRowIds, id]),
    };
}
export function addRowWithField(state, field) {
    const id = ++nextRowId;
    return {
        rows: [...state.rows, { id, field }],
        manualRowIds: new Set([...state.manualRowIds, id]),
    };
}
export function removeRow(state, index) {
    const removed = state.rows[index];
    const manualRowIds = new Set(state.manualRowIds);
    if (removed) {
        manualRowIds.delete(removed.id);
    }
    return {
        rows: state.rows.filter((_, i) => i !== index),
        manualRowIds,
    };
}
export function setRowField(state, index, field) {
    return {
        rows: state.rows.map((row, i) => i === index ? { id: row.id, field } : row),
        manualRowIds: state.manualRowIds,
    };
}
export function setRowCondition(state, index, condition) {
    return {
        rows: state.rows.map((row, i) => i === index ? { ...row, condition, value: undefined } : row),
        manualRowIds: state.manualRowIds,
    };
}
export function setRowValue(state, index, value) {
    return {
        rows: state.rows.map((row, i) => (i === index ? { ...row, value } : row)),
        manualRowIds: state.manualRowIds,
    };
}
export function restoreRows(rows) {
    return {
        rows: rows.map((row) => ({ ...row, id: ++nextRowId })),
        manualRowIds: new Set(),
    };
}
export function clearState() {
    return { rows: [], manualRowIds: new Set() };
}
export function hasManualRows(state) {
    return state.rows.some((r) => state.manualRowIds.has(r.id) &&
        r.field != null &&
        r.condition != null &&
        r.value != null);
}
export function conditionsFor(descriptor, field) {
    const column = descriptor.columns.find((c) => c.key === field);
    return column?.conditions ?? [];
}
export function columnFor(descriptor, field) {
    const column = descriptor.columns.find((c) => c.key === field);
    if (!column) {
        throw new Error(`Column not found: ${field}`);
    }
    return column;
}
function isRowComplete(row) {
    if (!row.field || !row.condition || row.value == null) {
        return false;
    }
    if (row.condition === "between") {
        return (Array.isArray(row.value) && row.value[0] != null && row.value[1] != null);
    }
    if (row.condition === "is_in" || row.condition === "is_not_in") {
        return Array.isArray(row.value) && row.value.length > 0;
    }
    return true;
}
export function buildResult(state) {
    const result = {};
    for (const row of state.rows) {
        if (!isRowComplete(row)) {
            continue;
        }
        if (row.condition === "equals" || row.condition === "is_in") {
            result[row.field] = row.value;
            continue;
        }
        if (row.condition === "between") {
            const [min, max] = row.value;
            const existing = typeof result[row.field] === "object" && result[row.field] !== null
                ? result[row.field]
                : {};
            result[row.field] = { ...existing, gte: min, lte: max };
            continue;
        }
        const operator = conditionToOperator[row.condition];
        if (!operator) {
            continue;
        }
        const existing = result[row.field];
        if (typeof existing === "object" &&
            existing !== null &&
            !Array.isArray(existing)) {
            result[row.field] = {
                ...existing,
                [operator]: row.value,
            };
        }
        else {
            result[row.field] = { [operator]: row.value };
        }
    }
    return result;
}
