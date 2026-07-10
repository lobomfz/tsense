import { describe, expect, it } from "bun:test";
import {
  defaultAddButton,
  defaultRemoveButton,
  defaultValueInput,
} from "../src/react/filter-builder/filter-builder-defaults";

describe("default filter builder controls", () => {
  it("sets type button on action buttons", () => {
    const addButton = defaultAddButton({ onClick: () => null }) as any;
    const removeButton = defaultRemoveButton({ onClick: () => null }) as any;

    expect(addButton.props.type).toBe("button");
    expect(removeButton.props.type).toBe("button");
  });

  it("clears number input to undefined", () => {
    let nextValue: unknown = Symbol("unset");
    const input = defaultValueInput({
      column: {
        key: "age",
        label: "Age",
        type: "number",
        conditions: [{ key: "equals", label: "equals" }],
      },
      condition: "equals",
      value: 22,
      onChange: (value) => {
        nextValue = value;
      },
    }) as any;

    input.props.onChange({ target: { value: "" } });

    expect(nextValue).toBeUndefined();
  });

  it("clears boolean input to undefined", () => {
    let nextValue: unknown = Symbol("unset");
    const input = defaultValueInput({
      column: {
        key: "active",
        label: "Active",
        type: "boolean",
        conditions: [{ key: "equals", label: "equals" }],
      },
      condition: "equals",
      value: true,
      onChange: (value) => {
        nextValue = value;
      },
    }) as any;

    input.props.onChange({ target: { value: "" } });

    expect(nextValue).toBeUndefined();
  });

  it("keeps partial numeric ranges incomplete", () => {
    let nextValue: unknown = Symbol("unset");
    const input = defaultValueInput({
      column: {
        key: "age",
        label: "Age",
        type: "number",
        conditions: [{ key: "between", label: "between" }],
      },
      condition: "between",
      value: [5, 10],
      onChange: (value) => {
        nextValue = value;
      },
    }) as any;

    const [minInput] = input.props.children as any[];
    minInput.props.onChange({ target: { value: "" } });

    expect(nextValue).toEqual([undefined, 10]);
  });
});
