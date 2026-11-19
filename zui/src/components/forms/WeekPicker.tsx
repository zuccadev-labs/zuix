"use client";
import { isoWeekText, weekNumber, weekStartOf } from "../../core/date";
import { DatePicker, type DatePickerSingleProps } from "./DatePicker";

export interface WeekPickerProps
  extends Omit<
    DatePickerSingleProps,
    "value" | "defaultValue" | "onValueChange" | "minView" | "selectionUnit" | "weekStartsOn" | "mode" | "serialize"
  > {
  /** Semana ISO 8601, `YYYY-Www` (lo que envía `<input type="week">`). */
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
}

const toDate = (week: string | null | undefined) => (week === undefined ? undefined : weekStartOf(week));

/** Selector de semana ISO: el calendario elige la semana entera (lunes a domingo) y muestra su número. */
export function WeekPicker({
  value,
  defaultValue,
  onValueChange,
  placeholder = "Select week",
  calendarLabel = "Choose week",
  weekLabel = "Week",
  locale,
  ...props
}: WeekPickerProps) {
  const number = new Intl.NumberFormat(locale, { useGrouping: false });
  return (
    <DatePicker
      {...props}
      locale={locale}
      mode="single"
      selectionUnit="week"
      weekStartsOn={1}
      showWeekNumber={props.showWeekNumber ?? true}
      weekLabel={weekLabel}
      placeholder={placeholder}
      calendarLabel={calendarLabel}
      value={toDate(value)}
      defaultValue={toDate(defaultValue)}
      onValueChange={(date) => onValueChange?.(date ? isoWeekText(date) : null)}
      serialize={(date) => (typeof date === "string" ? isoWeekText(date) : "")}
      formatValue={(date) => {
        if (typeof date !== "string") return "";
        const { year, week } = weekNumber(date, 1, 4);
        return `${weekLabel} ${number.format(week)}, ${number.format(year)}`;
      }}
    />
  );
}
