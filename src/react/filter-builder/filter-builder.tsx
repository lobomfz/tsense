import { Fragment, useEffect, useRef, type ReactNode } from "react";
import type { FilterFor } from "../../types.js";
import { useFilterBuilder } from "../use-filter-builder.js";
import {
  defaultAddButton,
  defaultConditionSelect,
  defaultFieldSelect,
  defaultRemoveButton,
  defaultValueInput,
} from "./filter-builder-defaults.js";
import type { FilterBuilderProps } from "./filter-builder-types.js";

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

  const rows = filters.rows.map((row, index) => {
    const fieldSelect = (
      <FieldSelect
        columns={filters.columns}
        value={row.field}
        onChange={(field) => filters.setField(index, field)}
      />
    );

    const conditionSelect = (
      <ConditionSelect
        conditions={row.field ? filters.conditionsFor(row.field) : []}
        value={row.condition}
        onChange={(condition) => filters.setCondition(index, condition)}
        disabled={!row.field}
      />
    );

    const valueInput =
      row.field && row.condition ? (
        <ValueInput
          column={filters.columnFor(row.field)}
          condition={row.condition}
          value={row.value}
          onChange={(value) => filters.setValue(index, value)}
        />
      ) : null;

    const removeButton = <RemoveButton onClick={() => filters.remove(index)} />;

    if (renderRow) {
      return (
        <Fragment key={row.id}>
          {renderRow({
            index,
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

  if (renderRoot) {
    return <>{renderRoot({ rows: <>{rows}</>, addButton })}</>;
  }

  return (
    <div className="flex flex-col gap-2">
      {rows}
      {addButton}
    </div>
  );
}
