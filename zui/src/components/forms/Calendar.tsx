"use client";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { addDays, addMonths, daysInMonth, localeWeekStart, monthOf, MONTH, pad, parse, todayISO, valid, type DateRange } from "../../core/date";
import { cx } from "../../cx";

export { todayISO };

export type { DateRange } from "../../core/date";

interface CalendarBaseProps {
  /** Mes visible, `YYYY-MM` (controlado). */
  month?: string;
  defaultMonth?: string;
  onMonthChange?: (month: string) => void;
  /** Primera fecha elegible, `YYYY-MM-DD`. */
  min?: string;
  /** Última fecha elegible, `YYYY-MM-DD`. */
  max?: string;
  /** Devuelve `true` para las fechas que no se pueden elegir. */
  isDateDisabled?: (date: string) => boolean;
  /** Primer día de la semana: 0 domingo … 6 sábado. Por defecto, el del `locale` (lunes si no se conoce). */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Etiqueta BCP 47 para nombres de mes y día. Por defecto, la del entorno. */
  locale?: string;
  /** Muestra los días de los meses vecinos que completan las semanas. */
  showOutsideDays?: boolean;
  previousMonthLabel?: string;
  nextMonthLabel?: string;
  /** Lleva el foco al día activo al montar (lo usa `DatePicker`). */
  autoFocus?: boolean;
  id?: string;
  className?: string;
}

export interface CalendarSingleProps extends CalendarBaseProps {
  mode?: "single";
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
}

export interface CalendarRangeProps extends CalendarBaseProps {
  mode: "range";
  value?: DateRange | null;
  defaultValue?: DateRange | null;
  onValueChange?: (value: DateRange) => void;
}

export type CalendarProps = CalendarSingleProps | CalendarRangeProps;

const noSubscription = () => () => {};

/** Rejilla de un mes para elegir una fecha o un rango. Valores como cadenas ISO `YYYY-MM-DD`. */
export function Calendar(props: CalendarProps) {
  const {
    mode = "single",
    month,
    defaultMonth,
    onMonthChange,
    min,
    max,
    isDateDisabled,
    weekStartsOn,
    locale,
    showOutsideDays = true,
    previousMonthLabel = "Previous month",
    nextMonthLabel = "Next month",
    autoFocus,
    id,
    className,
  } = props;
  const titleId = `${useId()}-title`;
  const grid = useRef<HTMLTableElement | null>(null);

  // ---- Valor ----
  const [inner, setInner] = useState<string | DateRange | null>(props.defaultValue ?? null);
  const raw = props.value === undefined ? inner : props.value;
  const single = mode === "single" && typeof raw === "string" && valid(raw) ? raw : null;
  const range: DateRange = mode === "range" && raw && typeof raw === "object" ? { from: valid(raw.from) ? raw.from : null, to: valid(raw.to) ? raw.to : null } : { from: null, to: null };
  const anchorDate = single ?? range.from;

  // Hoy se resuelve tras montar: el HTML del servidor no depende del reloj.
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(todayISO()), []);

  // ---- Mes visible y día activo (foco itinerante) ----
  // Sin `month`, `defaultMonth` ni valor, el mes sale del reloj. El reloj del servidor y el del navegador pueden
  // caer en meses distintos (zona horaria, HTML estático generado otro mes): durante la hidratación se toma el mes
  // que el servidor dejó en `data-month`, y justo después React vuelve a pintar con el reloj del navegador.
  const [innerMonth, setInnerMonth] = useState<string | null>(() => (defaultMonth && MONTH.test(defaultMonth) ? defaultMonth : anchorDate ? monthOf(anchorDate) : null));
  const clockMonth = () => {
    const now = todayISO();
    return monthOf(valid(min) && min > now ? min : valid(max) && max < now ? max : now);
  };
  const fallbackMonth = useSyncExternalStore(noSubscription, clockMonth, () =>
    typeof document === "undefined" ? clockMonth() : (document.getElementById(titleId)?.closest<HTMLElement>(".z-calendar")?.dataset.month ?? clockMonth()),
  );
  const visibleMonth = month && MONTH.test(month) ? month : (innerMonth ?? fallbackMonth);
  const [focused, setFocused] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const moveFocus = useRef(false);

  const year = Number(visibleMonth.slice(0, 4));
  const monthIndex = Number(visibleMonth.slice(5, 7)) - 1;
  const first = `${visibleMonth}-01`;
  const last = `${visibleMonth}-${pad(daysInMonth(year, monthIndex))}`;
  const start = (weekStartsOn ?? localeWeekStart(locale)) % 7;

  const formats = useMemo(
    () => ({
      title: new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }),
      weekdayShort: new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }),
      weekdayLong: new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }),
      day: new Intl.DateTimeFormat(locale, { day: "numeric", timeZone: "UTC" }),
      full: new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: "UTC" }),
    }),
    [locale],
  );

  const weeks = useMemo(() => {
    const lead = (parse(first).getUTCDay() - start + 7) % 7;
    const total = Math.ceil((lead + daysInMonth(year, monthIndex)) / 7) * 7;
    const origin = addDays(first, -lead);
    const rows: string[][] = [];
    for (let i = 0; i < total; i += 7) rows.push(Array.from({ length: 7 }, (_, d) => addDays(origin, i + d)));
    return rows;
  }, [first, start, year, monthIndex]);

  const outOfBounds = (date: string) => (valid(min) && date < min) || (valid(max) && date > max);
  const unavailable = (date: string) => outOfBounds(date) || Boolean(isDateDisabled?.(date));
  const inMonth = (date: string) => date >= first && date <= last;

  // Día que recibe el tabulador: el activo, la selección, hoy o el primero del mes.
  const tabbable = [focused, anchorDate, today].find((date): date is string => Boolean(date) && inMonth(date as string)) ?? first;

  const showMonth = (next: string) => {
    if (next === visibleMonth) return;
    setInnerMonth(next);
    onMonthChange?.(next);
  };
  const shiftMonth = (months: number) => {
    showMonth(monthOf(addMonths(first, months)));
    setFocused(null);
  };
  const canGoBack = !valid(min) || addDays(first, -1) >= min;
  const canGoForward = !valid(max) || addDays(last, 1) <= max;

  /** Mueve el día activo (acotado a min/max) y lleva el foco a su celda tras pintar. */
  const focusDate = (date: string) => {
    let target = date;
    if (valid(min) && target < min) target = min;
    if (valid(max) && target > max) target = max;
    moveFocus.current = true;
    setFocused(target);
    showMonth(monthOf(target));
  };
  useEffect(() => {
    if (!moveFocus.current || !focused) return;
    moveFocus.current = false;
    grid.current?.querySelector<HTMLElement>(`[data-date="${focused}"]`)?.focus();
  }, [focused, visibleMonth]);
  useEffect(() => {
    // Sin selección el foco va a hoy: `today` aún no está resuelto en este primer efecto, así que se busca por fecha.
    if (autoFocus) (grid.current?.querySelector<HTMLElement>(`.z-calendar__day[data-date="${anchorDate ?? todayISO()}"]`) ?? grid.current?.querySelector<HTMLElement>('.z-calendar__day[tabindex="0"]'))?.focus();
    // Solo al montar.
  }, []);

  const select = (date: string) => {
    if (unavailable(date)) return;
    setFocused(date);
    if (!inMonth(date)) {
      // Día de un mes vecino: se muestra su mes y el foco sigue al día.
      moveFocus.current = true;
      showMonth(monthOf(date));
    }
    if (props.mode === "range") {
      const next: DateRange = !range.from || range.to ? { from: date, to: null } : date < range.from ? { from: date, to: range.from } : { from: range.from, to: date };
      setInner(next);
      setPreview(null);
      props.onValueChange?.(next);
    } else {
      setInner(date);
      props.onValueChange?.(date);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
    const date = (event.target as HTMLElement).closest<HTMLElement>("[data-date]")?.dataset.date;
    if (!date) return;
    const weekday = (parse(date).getUTCDay() - start + 7) % 7;
    let next: string | null = null;
    // En RTL la rejilla se refleja: la flecha izquierda va al día siguiente.
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const key = rtl && event.key === "ArrowLeft" ? "ArrowRight" : rtl && event.key === "ArrowRight" ? "ArrowLeft" : event.key;
    switch (key) {
      case "ArrowLeft":
        next = addDays(date, -1);
        break;
      case "ArrowRight":
        next = addDays(date, 1);
        break;
      case "ArrowUp":
        next = addDays(date, -7);
        break;
      case "ArrowDown":
        next = addDays(date, 7);
        break;
      case "Home":
        next = addDays(date, -weekday);
        break;
      case "End":
        next = addDays(date, 6 - weekday);
        break;
      case "PageUp":
        next = addMonths(date, event.shiftKey ? -12 : -1);
        break;
      case "PageDown":
        next = addMonths(date, event.shiftKey ? 12 : 1);
        break;
      default:
        return;
    }
    event.preventDefault();
    focusDate(next);
  };

  // Rango pintado: el elegido o, con solo el inicio, la vista previa hasta el día bajo el puntero o el foco.
  const previewing = mode === "range" && range.from && !range.to && preview && preview !== range.from ? preview : null;
  const bandFrom = previewing ? (previewing < range.from! ? previewing : range.from) : range.from;
  const bandTo = previewing ? (previewing < range.from! ? range.from : previewing) : range.to;
  const rangePart = (date: string) => {
    if (mode !== "range" || !bandFrom) return undefined;
    if (!bandTo || bandFrom === bandTo) return date === bandFrom ? "single" : undefined;
    if (date === bandFrom) return "start";
    if (date === bandTo) return "end";
    return date > bandFrom && date < bandTo ? "middle" : undefined;
  };

  const weekdays = (weeks[0] ?? []).map((date) => ({ short: formats.weekdayShort.format(parse(date)), long: formats.weekdayLong.format(parse(date)) }));

  return (
    <div id={id} className={cx("z-calendar", className)} data-mode={mode} data-month={visibleMonth}>
      <div className="z-calendar__header">
        <button type="button" className="z-calendar__nav" aria-label={previousMonthLabel} title={previousMonthLabel} disabled={!canGoBack} onClick={() => shiftMonth(-1)}>
          <Icon name="chevron-left" size={16} />
        </button>
        <div className="z-calendar__title" id={titleId} aria-live="polite">
          {formats.title.format(parse(first))}
        </div>
        <button type="button" className="z-calendar__nav" aria-label={nextMonthLabel} title={nextMonthLabel} disabled={!canGoForward} onClick={() => shiftMonth(1)}>
          <Icon name="chevron-right" size={16} />
        </button>
      </div>
      <table ref={grid} className="z-calendar__grid" role="grid" aria-labelledby={titleId} aria-multiselectable={mode === "range" || undefined} onKeyDown={handleKeyDown} onMouseLeave={() => setPreview(null)}>
        <thead>
          <tr>
            {weekdays.map((weekday) => (
              <th key={weekday.long} scope="col" abbr={weekday.long} className="z-calendar__weekday">
                {weekday.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]}>
              {week.map((date) => {
                const outside = !inMonth(date);
                if (outside && !showOutsideDays) return <td key={date} className="z-calendar__cell" data-outside="" />;
                const part = rangePart(date);
                const isSelected = mode === "range" ? date === range.from || date === range.to : date === single;
                const inRange = mode === "range" && Boolean(range.from && range.to && date >= range.from && date <= range.to);
                const isDisabled = unavailable(date);
                return (
                  <td key={date} className="z-calendar__cell" aria-selected={isSelected || inRange} data-range={part} data-preview={part && previewing ? "" : undefined}>
                    <button
                      type="button"
                      className="z-calendar__day"
                      data-date={date}
                      data-selected={isSelected ? "" : undefined}
                      data-today={date === today ? "" : undefined}
                      data-outside={outside ? "" : undefined}
                      aria-disabled={isDisabled || undefined}
                      aria-current={date === today ? "date" : undefined}
                      aria-label={formats.full.format(parse(date))}
                      tabIndex={date === tabbable ? 0 : -1}
                      onClick={() => select(date)}
                      onFocus={() => {
                        setFocused(date);
                        if (mode === "range") setPreview(date);
                      }}
                      onMouseEnter={mode === "range" ? () => setPreview(date) : undefined}
                    >
                      {formats.day.format(parse(date))}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
