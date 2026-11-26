"use client";
import type { Ref } from "react";
import {
  treeSelectWidget,
  type TreeSelectLabels,
  type TreeSelectNode,
  type TreeSelectProps as CoreProps,
} from "../../core/tree-select-widget";
import { useWidget } from "../agenda/vtree";
import { useFieldControl, useFieldLabel } from "./Field";
import { withRef } from "../../react-compat";

export type { TreeSelectLabels, TreeSelectNode };

type Base = Omit<CoreProps, "controlId" | "describedBy" | "labelledBy" | "ariaLabel" | "value" | "defaultValue" | "multiple">;

interface TreeSelectCommon extends Base {
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

export interface TreeSelectSingleProps extends TreeSelectCommon {
  multiple?: false;
  value?: string | null;
  defaultValue?: string | null;
  /** Valor nuevo (o null) y su etiqueta. */
  onValueChange?: (value: string | null, detail: { label: string | null }) => void;
}

export interface TreeSelectMultipleProps extends TreeSelectCommon {
  /** Casillas con estado mixto en cascada; el valor sale según `showCheckedStrategy`. */
  multiple: true;
  value?: ReadonlyArray<string>;
  defaultValue?: ReadonlyArray<string>;
  onValueChange?: (value: string[], detail: { labels: string[] }) => void;
}

export type TreeSelectProps = TreeSelectSingleProps | TreeSelectMultipleProps;

/**
 * Select con un árbol en su panel: selección única o casillas con estado mixto, búsqueda que expande lo que coincide y
 * piezas para lo elegido. Las casillas en cascada son las de Tree (core/tree).
 */
export const TreeSelect = withRef(function TreeSelect({
  onValueChange,
  id,
  invalid,
  required,
  "aria-label": ariaLabel,
  "aria-labelledby": labelledBy,
  "aria-describedby": describedBy,
  className,
  ref,
  ...props
}: TreeSelectProps) {
  const field = useFieldControl({ id, invalid, required, "aria-describedby": describedBy });
  const fieldLabel = useFieldLabel();
  return useWidget(
    treeSelectWidget,
    {
      ...props,
      invalid: field.invalid,
      required: field.required,
      controlId: field.id,
      describedBy: field["aria-describedby"],
      labelledBy: labelledBy ?? (ariaLabel ? undefined : fieldLabel),
      ariaLabel,
    },
    {
      className,
      ref,
      handlers: {
        change: onValueChange
          ? (detail: { value: unknown; label?: string | null; labels?: string[] }) =>
              (onValueChange as (value: unknown, detail: unknown) => void)(
                detail.value,
                props.multiple ? { labels: detail.labels ?? [] } : { label: detail.label ?? null },
              )
          : undefined,
      },
    },
  );
});
