import { useMemo, useState } from "react";
import { addRow, addRowWithField, buildResult, clearState, columnFor, conditionsFor, createInitialState, hasManualRows as hasManualRowsState, removeRow, restoreRows, setRowCondition, setRowField, setRowValue, } from "../filters/filter-state.js";
export function useFilterBuilder(descriptor) {
    const [state, setState] = useState(createInitialState);
    const result = useMemo(() => buildResult(state), [state]);
    return {
        columns: descriptor.columns,
        rows: state.rows,
        hasManualRows: hasManualRowsState(state),
        add: () => setState(addRow),
        addWithField: (field) => setState((s) => addRowWithField(s, field)),
        remove: (index) => setState((s) => removeRow(s, index)),
        setField: (index, field) => setState((s) => setRowField(s, index, field)),
        setCondition: (index, condition) => setState((s) => setRowCondition(s, index, condition)),
        setValue: (index, value) => setState((s) => setRowValue(s, index, value)),
        clear: () => setState(clearState),
        restore: (rows) => setState(() => restoreRows(rows)),
        conditionsFor: (field) => conditionsFor(descriptor, field),
        columnFor: (field) => columnFor(descriptor, field),
        result,
    };
}
