import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Fragment, useEffect, useRef } from "react";
import { useFilterBuilder } from "./use-filter-builder.js";
// ======== Helpers ========
function formatDateForInput(date) {
    if (!(date instanceof Date))
        return "";
    return date.toISOString().slice(0, 10);
}
function parseDateInput(str) {
    if (!str)
        return undefined;
    return new Date(str + "T00:00:00Z");
}
function asTuple(value) {
    if (Array.isArray(value)) {
        return [value[0], value[1]];
    }
    return [undefined, undefined];
}
function renderSelectOptions(options, defaultValue) {
    const opts = defaultValue
        ? [{ key: "", label: defaultValue }, ...options]
        : options;
    return opts.map((o) => (_jsx("option", { value: o.key, children: o.label }, o.key)));
}
function defaultFieldSelect({ columns, value, onChange, }) {
    return (_jsx("select", { className: "rounded border px-2 py-1", value: value ?? "", onChange: (e) => onChange(e.target.value), children: renderSelectOptions(columns, "Column") }));
}
function defaultConditionSelect({ conditions, value, onChange, disabled, }) {
    return (_jsx("select", { className: "rounded border px-2 py-1", value: value ?? "", onChange: (e) => onChange(e.target.value), disabled: disabled, children: renderSelectOptions(conditions, "Condition") }));
}
function defaultValueInput({ column, condition, value, onChange, }) {
    if (condition === "between" && column.type === "date") {
        const tuple = asTuple(value);
        return (_jsxs("div", { className: "flex items-center gap-1", children: [_jsx("input", { className: "rounded border px-2 py-1", type: "date", value: formatDateForInput(tuple[0]), onChange: (e) => onChange([parseDateInput(e.target.value), tuple[1]]) }), _jsx("span", { className: "text-sm text-gray-500", children: "and" }), _jsx("input", { className: "rounded border px-2 py-1", type: "date", value: formatDateForInput(tuple[1]), onChange: (e) => onChange([tuple[0], parseDateInput(e.target.value)]) })] }));
    }
    if (condition === "between") {
        const tuple = asTuple(value);
        return (_jsxs("div", { className: "flex items-center gap-1", children: [_jsx("input", { className: "w-24 rounded border px-2 py-1", type: "number", value: String(tuple[0] ?? ""), onChange: (e) => onChange([Number(e.target.value), tuple[1]]) }), _jsx("span", { className: "text-sm text-gray-500", children: "and" }), _jsx("input", { className: "w-24 rounded border px-2 py-1", type: "number", value: String(tuple[1] ?? ""), onChange: (e) => onChange([tuple[0], Number(e.target.value)]) })] }));
    }
    if (column.values) {
        const selected = Array.isArray(value) ? value : [];
        return (_jsx("div", { className: "flex flex-wrap gap-2", children: column.values.map((v) => {
                const checked = selected.includes(v.value);
                return (_jsxs("label", { className: "flex cursor-pointer select-none items-center gap-1 text-sm", children: [_jsx("input", { type: "checkbox", checked: checked, onChange: () => onChange(checked
                                ? selected.filter((s) => s !== v.value)
                                : [...selected, v.value]) }), v.label] }, v.value));
            }) }));
    }
    if (column.type === "date") {
        return (_jsx("input", { className: "rounded border px-2 py-1", type: "date", value: formatDateForInput(value), onChange: (e) => onChange(parseDateInput(e.target.value)) }));
    }
    if (column.type === "number") {
        return (_jsx("input", { className: "rounded border px-2 py-1", type: "number", value: String(value ?? ""), onChange: (e) => onChange(Number(e.target.value)) }));
    }
    if (column.type === "boolean") {
        const options = [
            { key: "", label: "Value" },
            { key: "true", label: "true" },
            { key: "false", label: "false" },
        ];
        return (_jsx("select", { className: "rounded border px-2 py-1", value: value == null ? "" : String(value), onChange: (e) => onChange(e.target.value === "true"), children: renderSelectOptions(options) }));
    }
    return (_jsx("input", { className: "rounded border px-2 py-1", type: "text", value: typeof value === "string" ? value : "", onChange: (e) => onChange(e.target.value) }));
}
function defaultRemoveButton({ onClick }) {
    return (_jsx("button", { className: "text-red-500 hover:text-red-700", onClick: onClick, children: "\u00D7" }));
}
function defaultAddButton({ onClick }) {
    return (_jsx("button", { className: "text-blue-500 hover:text-blue-700", onClick: onClick, children: "+ Add filter" }));
}
function defaultPresetButton({ preset, onClick }) {
    return (_jsx("button", { className: "rounded bg-gray-100 px-2 py-1 text-sm hover:bg-gray-200", onClick: onClick, children: preset.name }));
}
export function FilterBuilder({ descriptor, onChange, renderRoot, renderRow, renderFieldSelect, renderConditionSelect, renderValueInput, renderAddButton, renderRemoveButton, renderPresetButton, }) {
    const filters = useFilterBuilder(descriptor);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    useEffect(() => {
        onChangeRef.current?.(filters.result);
    }, [filters.result]);
    const FieldSelect = renderFieldSelect ?? defaultFieldSelect;
    const ConditionSelect = renderConditionSelect ?? defaultConditionSelect;
    const ValueInput = renderValueInput ?? defaultValueInput;
    const RemoveButton = renderRemoveButton ?? defaultRemoveButton;
    const AddButton = renderAddButton ?? defaultAddButton;
    const PresetButton = renderPresetButton ?? defaultPresetButton;
    const rows = filters.rows.map((row, i) => {
        const fieldSelect = (_jsx(FieldSelect, { columns: filters.columns, value: row.field, onChange: (field) => filters.setField(i, field) }));
        const conditionSelect = (_jsx(ConditionSelect, { conditions: row.field ? filters.conditionsFor(row.field) : [], value: row.condition, onChange: (condition) => filters.setCondition(i, condition), disabled: !row.field }));
        const column = row.field
            ? filters.columns.find((c) => c.key === row.field)
            : undefined;
        const valueInput = row.field && row.condition && column ? (_jsx(ValueInput, { column: column, condition: row.condition, value: row.value, onChange: (v) => filters.setValue(i, v) })) : null;
        const removeButton = _jsx(RemoveButton, { onClick: () => filters.remove(i) });
        if (renderRow) {
            return (_jsx(Fragment, { children: renderRow({
                    index: i,
                    fieldSelect,
                    conditionSelect,
                    valueInput,
                    removeButton,
                }) }, row.id));
        }
        return (_jsxs("div", { className: "flex items-center gap-2", children: [fieldSelect, conditionSelect, valueInput, removeButton] }, row.id));
    });
    const addButton = _jsx(AddButton, { onClick: filters.add });
    const presets = filters.presets.length > 0 ? (_jsx("div", { className: "flex flex-wrap gap-1 border-t pt-2", children: filters.presets.map((preset) => (_jsx(Fragment, { children: _jsx(PresetButton, { preset: preset, onClick: () => filters.applyPreset(preset.field, preset.name) }) }, `${preset.field}-${preset.name}`))) })) : null;
    if (renderRoot) {
        return _jsx(_Fragment, { children: renderRoot({ rows: _jsx(_Fragment, { children: rows }), addButton, presets }) });
    }
    return (_jsxs("div", { className: "flex flex-col gap-2", children: [rows, addButton, presets] }));
}
