"use client";
import type { Ref } from "react";
import { quarterPickerWidget, type QuarterPickerLabels, type QuarterPickerProps as CoreProps } from "../../core/quarter-widget";
import { useWidget } from "../agenda/vtree";
import { useFieldControl, useFieldLabel } from "./Field";
import { withRef } from "../../react-compat";

export type { QuarterPickerLabels };

export interface QuarterPickerProps extends Omit<CoreProps, "controlId" | "describedBy" | "labelledBy" | "ariaLabel"> {
  /** Trimestre elegido (`YYYY-Qn`) y los días que abarca. */
  onValueChange?: (value: string, range: { from: string; to: string }) => void;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/** Selector de trimestre (T1–T4 de cada año), con el mismo patrón que MonthPicker y YearPicker. Valor `YYYY-Qn`. */
export const QuarterPicker = withRef(function QuarterPicker({
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
}: QuarterPickerProps) {
  const field = useFieldControl({ id, invalid, required, "aria-describedby": describedBy });
  const fieldLabel = useFieldLabel();
  return useWidget(
    quarterPickerWidget,
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
          ? (detail: { value: string; from: string; to: string }) => onValueChange(detail.value, { from: detail.from, to: detail.to })
          : undefined,
      },
    },
  );
});
