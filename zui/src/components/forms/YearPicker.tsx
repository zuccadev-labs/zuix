"use client";
import { DatePicker, type DatePickerRangeProps, type DatePickerSingleProps } from "./DatePicker";

type Without<T> = Omit<T, "minView" | "maxView" | "selectionUnit">;
/** Valor `YYYY` (o `{ from, to }` de años con `mode="range"`). `min` y `max` en `YYYY`. */
export type YearPickerProps = Without<DatePickerSingleProps> | Without<DatePickerRangeProps>;

/** Selector de año: el DatePicker en la vista de década. Valor `YYYY`. */
export function YearPicker({ placeholder = "Select year", calendarLabel = "Choose year", ...props }: YearPickerProps) {
  return (
    <DatePicker
      {...(props as DatePickerSingleProps)}
      minView="year"
      maxView="year"
      placeholder={placeholder}
      calendarLabel={calendarLabel}
    />
  );
}
