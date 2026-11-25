"use client";
import { isoWeekText, weekNumber, weekRangeDays, weekRangeOf, weekStartOf, type DateRange } from "../../core/date";
import { DatePicker, type DatePickerSingleProps } from "./DatePicker";
import { withRef } from "../../react-compat";

/** Rango de semanas ISO, `{ from: "YYYY-Www", to: "YYYY-Www" }`. */
export interface WeekRange {
  from: string | null;
  to: string | null;
}

type WeekPickerBase = Omit<
  DatePickerSingleProps,
  "value" | "defaultValue" | "onValueChange" | "minView" | "selectionUnit" | "weekStartsOn" | "mode" | "serialize"
>;

export interface WeekPickerSingleProps extends WeekPickerBase {
  mode?: "single";
  /** Semana ISO 8601, `YYYY-Www` (lo que envía `<input type="week">`). */
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
}

export interface WeekPickerRangeProps extends WeekPickerBase {
  /** `range`: se elige de una semana a otra (dos pulsaciones). El formulario envía `YYYY-Www/YYYY-Www`. */
  mode: "range";
  value?: WeekRange | null;
  defaultValue?: WeekRange | null;
  onValueChange?: (value: WeekRange) => void;
}

export type WeekPickerProps = WeekPickerSingleProps | WeekPickerRangeProps;

const toDate = (week: string | null | undefined) => (week === undefined ? undefined : weekStartOf(week));

/** Selector de semana ISO: el calendario elige la semana entera (lunes a domingo) y muestra su número. Con
 *  `mode="range"`, un rango de semanas. */
export const WeekPicker = withRef(function WeekPicker(props: WeekPickerProps) {
  const { placeholder = "Select week", calendarLabel = "Choose week", weekLabel = "Week", locale } = props;
  const number = new Intl.NumberFormat(locale, { useGrouping: false });
  const weekText = (date: string) => {
    const { year, week } = weekNumber(date, 1, 4);
    return { year, week: number.format(week), yearText: number.format(year) };
  };
  const common = {
    locale,
    selectionUnit: "week" as const,
    weekStartsOn: 1 as const,
    showWeekNumber: props.showWeekNumber ?? true,
    weekLabel,
    placeholder,
    calendarLabel,
  };
  if (props.mode === "range") {
    const { mode: _mode, value, defaultValue, onValueChange, ...rest } = props;
    return (
      <DatePicker
        {...rest}
        {...common}
        mode="range"
        value={value === undefined ? undefined : weekRangeDays(value)}
        defaultValue={defaultValue === undefined ? undefined : weekRangeDays(defaultValue)}
        onValueChange={(range) => onValueChange?.(weekRangeOf(range))}
        serialize={(range) => {
          const weeks = weekRangeOf(range as DateRange);
          return weeks.from ? `${weeks.from}/${weeks.to ?? ""}` : "";
        }}
        formatValue={(range) => {
          const r = range as DateRange;
          if (!r?.from) return "";
          const a = weekText(r.from);
          if (!r.to) return `${weekLabel} ${a.week}, ${a.yearText}`;
          const b = weekText(r.to);
          return a.year === b.year
            ? `${weekLabel} ${a.week}–${b.week}, ${a.yearText}`
            : `${weekLabel} ${a.week}, ${a.yearText} – ${b.week}, ${b.yearText}`;
        }}
      />
    );
  }
  const { mode: _mode, value, defaultValue, onValueChange, ...rest } = props;
  return (
    <DatePicker
      {...rest}
      {...common}
      mode="single"
      value={toDate(value)}
      defaultValue={toDate(defaultValue)}
      onValueChange={(date) => onValueChange?.(date ? isoWeekText(date) : null)}
      serialize={(date) => (typeof date === "string" ? isoWeekText(date) : "")}
      formatValue={(date) => {
        if (typeof date !== "string") return "";
        const { week, yearText } = weekText(date);
        return `${weekLabel} ${week}, ${yearText}`;
      }}
    />
  );
});
