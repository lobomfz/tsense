import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Fragment, useEffect, useRef } from "react";
import { useFilterBuilder } from "../use-filter-builder.js";
import { defaultAddButton, defaultConditionSelect, defaultFieldSelect, defaultRemoveButton, defaultValueInput, } from "./filter-builder-defaults.js";
export function FilterBuilder({ descriptor, onChange, renderRoot, renderRow, renderFieldSelect, renderConditionSelect, renderValueInput, renderAddButton, renderRemoveButton, }) {
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
    const rows = filters.rows.map((row, index) => {
        const fieldSelect = (_jsx(FieldSelect, { columns: filters.columns, value: row.field, onChange: (field) => filters.setField(index, field) }));
        const conditionSelect = (_jsx(ConditionSelect, { conditions: row.field ? filters.conditionsFor(row.field) : [], value: row.condition, onChange: (condition) => filters.setCondition(index, condition), disabled: !row.field }));
        const valueInput = row.field && row.condition ? (_jsx(ValueInput, { column: filters.columnFor(row.field), condition: row.condition, value: row.value, onChange: (value) => filters.setValue(index, value) })) : null;
        const removeButton = _jsx(RemoveButton, { onClick: () => filters.remove(index) });
        if (renderRow) {
            return (_jsx(Fragment, { children: renderRow({
                    index,
                    fieldSelect,
                    conditionSelect,
                    valueInput,
                    removeButton,
                }) }, row.id));
        }
        return (_jsxs("div", { className: "flex items-center gap-2", children: [fieldSelect, conditionSelect, valueInput, removeButton] }, row.id));
    });
    const addButton = _jsx(AddButton, { onClick: filters.add });
    if (renderRoot) {
        return _jsx(_Fragment, { children: renderRoot({ rows: _jsx(_Fragment, { children: rows }), addButton }) });
    }
    return (_jsxs("div", { className: "flex flex-col gap-2", children: [rows, addButton] }));
}
