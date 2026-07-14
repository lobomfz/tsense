import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function formatDateForInput(date) {
    if (!(date instanceof Date)) {
        return "";
    }
    return date.toISOString().slice(0, 10);
}
function parseDateInput(value) {
    if (!value) {
        return;
    }
    return new Date(value + "T00:00:00Z");
}
function parseNumberInput(value) {
    if (!value) {
        return;
    }
    return Number(value);
}
function parseBooleanInput(value) {
    if (!value) {
        return;
    }
    return value === "true";
}
function asTuple(value) {
    if (Array.isArray(value)) {
        return [value[0], value[1]];
    }
    return [undefined, undefined];
}
function renderSelectOptions(options, defaultValue) {
    const allOptions = defaultValue
        ? [{ key: "", label: defaultValue }, ...options]
        : options;
    return allOptions.map((option) => (_jsx("option", { value: option.key, children: option.label }, option.key)));
}
export function defaultFieldSelect({ columns, value, onChange, }) {
    return (_jsx("select", { className: "rounded border px-2 py-1", value: value ?? "", onChange: (event) => onChange(event.target.value), children: renderSelectOptions(columns, "Column") }));
}
export function defaultConditionSelect({ conditions, value, onChange, disabled, }) {
    return (_jsx("select", { className: "rounded border px-2 py-1", value: value ?? "", onChange: (event) => onChange(event.target.value), disabled: disabled, children: renderSelectOptions(conditions, "Condition") }));
}
export function defaultValueInput({ column, condition, value, onChange, }) {
    if (condition === "between" && column.type === "date") {
        const tuple = asTuple(value);
        return (_jsxs("div", { className: "flex items-center gap-1", children: [_jsx("input", { className: "rounded border px-2 py-1", type: "date", value: formatDateForInput(tuple[0]), onChange: (event) => onChange([parseDateInput(event.target.value), tuple[1]]) }), _jsx("span", { className: "text-sm text-gray-500", children: "and" }), _jsx("input", { className: "rounded border px-2 py-1", type: "date", value: formatDateForInput(tuple[1]), onChange: (event) => onChange([tuple[0], parseDateInput(event.target.value)]) })] }));
    }
    if (condition === "between") {
        const tuple = asTuple(value);
        return (_jsxs("div", { className: "flex items-center gap-1", children: [_jsx("input", { className: "w-24 rounded border px-2 py-1", type: "number", value: String(tuple[0] ?? ""), onChange: (event) => onChange([parseNumberInput(event.target.value), tuple[1]]) }), _jsx("span", { className: "text-sm text-gray-500", children: "and" }), _jsx("input", { className: "w-24 rounded border px-2 py-1", type: "number", value: String(tuple[1] ?? ""), onChange: (event) => onChange([tuple[0], parseNumberInput(event.target.value)]) })] }));
    }
    if (column.values) {
        const selected = Array.isArray(value) ? value : [];
        return (_jsx("div", { className: "flex flex-wrap gap-2", children: column.values.map((option) => {
                const checked = selected.includes(option.value);
                return (_jsxs("label", { className: "flex cursor-pointer select-none items-center gap-1 text-sm", children: [_jsx("input", { type: "checkbox", checked: checked, onChange: () => onChange(checked
                                ? selected.filter((item) => item !== option.value)
                                : [...selected, option.value]) }), option.label] }, option.value));
            }) }));
    }
    if (column.type === "date") {
        return (_jsx("input", { className: "rounded border px-2 py-1", type: "date", value: formatDateForInput(value), onChange: (event) => onChange(parseDateInput(event.target.value)) }));
    }
    if (column.type === "number") {
        return (_jsx("input", { className: "rounded border px-2 py-1", type: "number", value: String(value ?? ""), onChange: (event) => onChange(parseNumberInput(event.target.value)) }));
    }
    if (column.type === "boolean") {
        const options = [
            { key: "", label: "Value" },
            { key: "true", label: "true" },
            { key: "false", label: "false" },
        ];
        return (_jsx("select", { className: "rounded border px-2 py-1", value: value == null ? "" : String(value), onChange: (event) => onChange(parseBooleanInput(event.target.value)), children: renderSelectOptions(options) }));
    }
    return (_jsx("input", { className: "rounded border px-2 py-1", type: "text", value: typeof value === "string" ? value : "", onChange: (event) => onChange(event.target.value) }));
}
export function defaultRemoveButton({ onClick }) {
    return (_jsx("button", { type: "button", className: "text-red-500 hover:text-red-700", onClick: onClick, children: "\u00D7" }));
}
export function defaultAddButton({ onClick }) {
    return (_jsx("button", { type: "button", className: "text-blue-500 hover:text-blue-700", onClick: onClick, children: "+ Add filter" }));
}
