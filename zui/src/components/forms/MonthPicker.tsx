"use client";
import { DatePicker, type DatePickerRangeProps, type DatePickerSingleProps } from "./DatePicker";

type Without<T> = Omit<T, "minView" | "selectionUnit">;
/** Valor `YYYY-MM` (o `{ from, to }` de meses con `mode="range"`). `min` y `max` en `YYYY-MM`. */
export type MonthPickerProps = Without<DatePickerSingleProps> | Without<DatePickerRangeProps>;

/** Selector de mes: el DatePicker en la vista de meses. Valor `YYYY-MM`, como `<input type="month">`. */
export function MonthPicker({ placeholder = "Select month", calendarLabel = "Choose month", ...props }: MonthPickerProps) {
  return (
    <DatePicker
      {...(props as DatePickerSingleProps)}
      minView="month"
      maxView={props.maxView === "month" ? "month" : "year"}
      placeholder={placeholder}
      calendarLabel={calendarLabel}
    />
  );
}
