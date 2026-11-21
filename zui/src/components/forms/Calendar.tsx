"use client";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import {
  addDays,
  diffDays,
  localeWeekInfo,
  monthOf,
  resolvePreset,
  todayISO,
  toISODate,
  valid,
  validMonth,
  type DateRange,
} from "../../core/date";
import {
  anchorOf,
  buildCalendar,
  captionOptions,
  choose,
  chooseWeek,
  clampUnit,
  clampView,
  dayKeyTarget,
  initialMonth,
  navStep,
  rangeNights,
  readSelection,
  revealMonth,
  stepRange,
  shiftMonth,
  unitKeyTarget,
  unitStart,
  valueText,
  VIEWS,
  type CalendarMode,
  type CalendarRules,
  type CalendarValue,
  type CalendarView,
  type CaptionLayout,
  type DayCell,
  type SelectionUnit,
  type UnitCell,
  type WeekdayFormat,
  type WeekNumbering,
} from "../../core/calendar";
import { logicalKey } from "../../core/dir";
import { cx } from "../../cx";

export { todayISO };

export type { DateRange } from "../../core/date";
export type { CalendarView, CaptionLayout, SelectionUnit } from "../../core/calendar";

/** Estado de una celda que recibe `renderDay`. */
export interface CalendarDayState {
  selected: boolean;
  today: boolean;
  disabled: boolean;
  unavailable: boolean;
  outside: boolean;
  modifiers: string[];
}

/** Preajuste: una clave de `rangePresets` (`"next-7-days"`…), una fecha ISO, un rango `desde/hasta`, un valor o una
 *  función de `today` que lo devuelve. */
export interface CalendarPreset {
  label: string;
  value: string | DateRange | string[] | ((today: string) => string | DateRange | string[]);
}

/** Textos de la leyenda (solo se pinta la entrada que tenga texto). */
export interface CalendarLegend {
  today?: string;
  selected?: string;
  unavailable?: string;
}

interface CalendarBaseProps {
  /** Primer mes visible, `YYYY-MM` (controlado). */
  month?: string;
  defaultMonth?: string;
  onMonthChange?: (month: string) => void;
  /** Meses visibles a la vez (1–12). */
  numberOfMonths?: number;
  /** Con varios meses, las flechas avanzan de `numberOfMonths` en `numberOfMonths`. */
  pagedNavigation?: boolean;
  /** Vista: días, meses de un año o años de una década (controlada). */
  view?: CalendarView;
  defaultView?: CalendarView;
  onViewChange?: (view: CalendarView) => void;
  /** Vista en la que se elige el valor: `month` da `YYYY-MM` (MonthPicker), `year` da `YYYY` (YearPicker). */
  minView?: CalendarView;
  /** Vista más alta a la que lleva el título. `day` desactiva el cambio de vista. */
  maxView?: CalendarView;
  /** Cabecera con el título (por defecto) o con desplegables de mes y año. */
  captionLayout?: CaptionLayout;
  /** Primera fecha elegible, `YYYY-MM-DD`. */
  min?: string;
  /** Última fecha elegible, `YYYY-MM-DD`. */
  max?: string;
  /** Devuelve `true` para las fechas que no se pueden elegir. */
  isDateDisabled?: (date: string) => boolean;
  /** Fechas reservadas: visibles y enfocables, tachadas y con trama; no se eligen y cortan un rango. */
  isDateUnavailable?: (date: string) => boolean;
  /** Atributos `data-<nombre>` en el día cuando la función devuelve `true` (festivos, vacaciones…). */
  modifiers?: Record<string, (date: string) => boolean>;
  /** Primer día de la semana: 0 domingo … 6 sábado. Por defecto, el del `locale` (lunes si no se conoce). */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Etiqueta BCP 47 para nombres de mes y día. Por defecto, la del entorno. */
  locale?: string;
  /** Muestra los días de los meses vecinos que completan las semanas. Por defecto solo con un mes. */
  showOutsideDays?: boolean;
  /** Los días de otro mes se pueden elegir (por defecto, sí). */
  outsideDaySelectable?: boolean;
  /** Siempre seis semanas: el calendario no cambia de alto al cambiar de mes. */
  fixedWeeks?: boolean;
  /** Columna con el número de semana. */
  showWeekNumber?: boolean;
  /** Semana ISO 8601 (por defecto) o la del locale. */
  weekNumbering?: WeekNumbering;
  /** Con `showWeekNumber`, el número de cada semana es un botón que elige la semana (rango: la semana entera;
   *  múltiple: sus días; fecha única: su primer día elegible) y llama a esta función. */
  onWeekNumberClick?: (week: { week: number; from: string; to: string }) => void;
  /** Formato del nombre del día en la cabecera. */
  weekdayFormat?: WeekdayFormat;
  /** Hoy, `YYYY-MM-DD`. Por defecto, la fecha local del dispositivo tras montar. */
  today?: string;
  /** Botón «Hoy» al pie: lleva la vista y el foco a hoy y, si se puede, lo elige. */
  showTodayButton?: boolean;
  /** Atajos al lado del mes. */
  presets?: CalendarPreset[];
  presetsLabel?: string;
  /** Preajustes en columna al lado del mes (`side`, por defecto) o en una fila encima (`top`). En un contenedor
   *  estrecho van siempre encima. */
  presetsPlacement?: "side" | "top";
  /** Contenido extra en cada día (puntos, precios). */
  renderDay?: (date: string, state: CalendarDayState) => ReactNode;
  /** Texto que se añade al nombre accesible del día (p. ej. «3 eventos»). */
  getDayDescription?: (date: string) => string | null | undefined;
  /** Tamaño de celda. `lg` sirve como objetivo táctil. */
  cellSize?: "sm" | "md" | "lg";
  /** `week`: se elige la semana entera (WeekPicker). */
  selectionUnit?: SelectionUnit;
  /** Rango: días mínimos y máximos, ambos extremos incluidos. */
  minRange?: number;
  maxRange?: number;
  /** Rango: `block` (por defecto) impide que cruce una fecha reservada. */
  rangeCrossesUnavailable?: "block" | "allow";
  allowSingleDayRange?: boolean;
  /** Leyenda al pie (hoy, elegido, reservado), para no depender solo del color. */
  legend?: CalendarLegend;
  /** Contenido del pie (resumen, botones). */
  footer?: ReactNode;
  previousMonthLabel?: string;
  nextMonthLabel?: string;
  todayLabel?: string;
  weekLabel?: string;
  unavailableLabel?: string;
  /** Estancia (rango): días en que se puede terminar pero no empezar (marca pequeña y «check-out only»). */
  isDateCheckoutOnly?: (date: string) => boolean;
  /** `minRange`/`maxRange` en noches (diferencia de días) en vez de días. */
  rangeUnit?: "days" | "nights";
  checkoutOnlyLabel?: string;
  /** Aviso de un día que no llega al mínimo («{n}-night minimum»). */
  minRangeLabel?: string;
  /** Pie con −/+ que acortan o alargan el rango una noche (o un día). */
  showLengthStepper?: boolean;
  /** «{n} nights» y «1 night» (o días con `rangeUnit="days"`). */
  lengthLabel?: string;
  lengthOneLabel?: string;
  decreaseLabel?: string;
  increaseLabel?: string;
  /** Flexibilidad de fechas (chips «Exact dates», «± 1 day»…): días de margen que la aplicación interpreta. */
  flexibility?: number;
  defaultFlexibility?: number;
  onFlexibilityChange?: (days: number) => void;
  /** Opciones de flexibilidad; con ellas aparecen los chips. Por defecto `[0, 1, 2, 3, 7]` si hay `flexibility`. */
  flexibilityOptions?: number[];
  flexibilityGroupLabel?: string;
  exactDatesLabel?: string;
  /** «± {n} days» y «± 1 day». */
  flexibilityLabel?: string;
  flexibilityOneLabel?: string;
  monthLabel?: string;
  yearLabel?: string;
  chooseMonthLabel?: string;
  chooseYearLabel?: string;
  /** Lleva el foco al día activo al montar (lo usa `DatePicker`). */
  autoFocus?: boolean;
  id?: string;
  className?: string;
}

export interface CalendarSingleProps extends CalendarBaseProps {
  mode?: "single";
  /** `YYYY-MM-DD` (o `YYYY-MM` / `YYYY` con `minView`). Admite un `Temporal.PlainDate`. */
  value?: string | null | { year: number; month: number; day: number };
  defaultValue?: string | null | { year: number; month: number; day: number };
  onValueChange?: (value: string | null) => void;
}

export interface CalendarRangeProps extends CalendarBaseProps {
  mode: "range";
  value?: DateRange | null;
  defaultValue?: DateRange | null;
  onValueChange?: (value: DateRange) => void;
}

export interface CalendarMultipleProps extends CalendarBaseProps {
  mode: "multiple";
  value?: string[] | null;
  defaultValue?: string[] | null;
  onValueChange?: (value: string[]) => void;
  /** Máximo de fechas elegidas. */
  maxSelected?: number;
}

export type CalendarProps = CalendarSingleProps | CalendarRangeProps | CalendarMultipleProps;

const noSubscription = () => () => {};
const MODIFIER = /^[a-z][a-z0-9-]*$/;
/** Atributo booleano del contrato: presente y vacío, o ausente. */
const on = (value: boolean | undefined) => (value ? "" : undefined);

/** Normaliza un valor de entrada (acepta objetos con `year`, `month` y `day`). */
function normalizeInput(raw: unknown): unknown {
  if (raw && typeof raw === "object" && !Array.isArray(raw) && "day" in raw) return toISODate(raw);
  return raw;
}

/** Resuelve el valor de un preajuste para el modo. */
export function presetValue(preset: CalendarPreset, mode: CalendarMode, today: string, weekStart: number): CalendarValue {
  const raw = typeof preset.value === "function" ? preset.value(today) : preset.value;
  if (typeof raw !== "string") return raw;
  const range = resolvePreset(raw, today, weekStart);
  if (!range) return null;
  if (mode === "single") return range.from;
  if (mode === "range") return range;
  const days = Math.min(366, diffDays(range.from, range.to) + 1);
  return Array.from({ length: days }, (_, i) => addDays(range.from, i));
}

/** Rejilla de fechas: una, varias o un rango, en uno o varios meses, con vistas de mes y año. Valores ISO. */
export function Calendar(props: CalendarProps) {
  const {
    mode = "single",
    month,
    defaultMonth,
    onMonthChange,
    numberOfMonths = 1,
    pagedNavigation = false,
    view: viewProp,
    defaultView,
    onViewChange,
    minView = "day",
    maxView = "year",
    captionLayout = "label",
    min,
    max,
    isDateDisabled,
    isDateUnavailable,
    modifiers,
    weekStartsOn,
    locale,
    showOutsideDays,
    outsideDaySelectable,
    fixedWeeks = false,
    showWeekNumber = false,
    weekNumbering = "iso",
    onWeekNumberClick,
    weekdayFormat = "short",
    today: todayProp,
    showTodayButton = false,
    presets,
    presetsLabel = "Quick pick",
    presetsPlacement = "side",
    renderDay,
    getDayDescription,
    cellSize = "md",
    selectionUnit = "day",
    minRange,
    maxRange,
    rangeCrossesUnavailable,
    allowSingleDayRange,
    legend,
    footer,
    previousMonthLabel = "Previous month",
    nextMonthLabel = "Next month",
    todayLabel = "Today",
    weekLabel = "Week",
    unavailableLabel = "unavailable",
    isDateCheckoutOnly,
    rangeUnit = "days",
    checkoutOnlyLabel = "check-out only",
    minRangeLabel = rangeUnit === "nights" ? "{n}-night minimum" : "{n}-day minimum",
    showLengthStepper = false,
    lengthLabel = rangeUnit === "nights" ? "{n} nights" : "{n} days",
    lengthOneLabel = rangeUnit === "nights" ? "1 night" : "1 day",
    decreaseLabel = rangeUnit === "nights" ? "One night less" : "One day less",
    increaseLabel = rangeUnit === "nights" ? "One night more" : "One day more",
    flexibility: flexibilityProp,
    defaultFlexibility,
    onFlexibilityChange,
    flexibilityOptions,
    flexibilityGroupLabel = "Date flexibility",
    exactDatesLabel = "Exact dates",
    flexibilityLabel = "± {n} days",
    flexibilityOneLabel = "± 1 day",
    monthLabel = "Month",
    yearLabel = "Year",
    chooseMonthLabel = "Choose month",
    chooseYearLabel = "Choose year",
    autoFocus,
    id,
    className,
  } = props;
  const auto = useId();
  const titleId = `${auto}-title`;
  const presetsId = `${auto}-presets`;
  const root = useRef<HTMLDivElement | null>(null);
  const maxSelected = props.mode === "multiple" ? props.maxSelected : undefined;
  const unit: CalendarView = VIEWS.includes(minView) ? minView : "day";

  // ---- Valor ----
  const [inner, setInner] = useState<unknown>(() => normalizeInput(props.defaultValue ?? null));
  const raw = props.value === undefined ? inner : normalizeInput(props.value);
  const selection = readSelection(mode, raw, unit);
  const anchor = anchorOf(selection);

  // Hoy se resuelve tras montar: el HTML del servidor no depende del reloj.
  const [clockToday, setClockToday] = useState<string | null>(null);
  useEffect(() => setClockToday(todayISO()), []);
  const today = valid(todayProp) ? todayProp : clockToday;

  const week = useMemo(() => localeWeekInfo(locale), [locale]);
  const weekStart = (weekStartsOn ?? week.firstDay) % 7;
  const rules: CalendarRules = {
    min,
    max,
    isDateDisabled,
    isDateUnavailable,
    minRange,
    maxRange,
    rangeCrossesUnavailable,
    allowSingleDayRange: rangeUnit === "nights" ? false : allowSingleDayRange,
    maxSelected,
    isDateCheckoutOnly,
    nights: rangeUnit === "nights",
  };

  // ---- Vista y mes visible ----
  const [innerView, setInnerView] = useState<CalendarView>(() => clampView(defaultView ?? minView, minView, maxView));
  const view = clampView(viewProp ?? innerView, minView, maxView);
  const setView = (next: CalendarView) => {
    const clamped = clampView(next, minView, maxView);
    if (clamped === view) return;
    setInnerView(clamped);
    onViewChange?.(clamped);
  };

  // Sin `month`, `defaultMonth` ni valor, el mes sale del reloj. El reloj del servidor y el del navegador pueden
  // caer en meses distintos: durante la hidratación se toma el mes que el servidor dejó en `data-month`.
  const [innerMonth, setInnerMonth] = useState<string | null>(() =>
    validMonth(defaultMonth) ? defaultMonth : anchor ? monthOf(unitStart(anchor)) : null,
  );
  const clockMonth = () => initialMonth(null, null, todayProp && valid(todayProp) ? todayProp : todayISO(), rules);
  const fallbackMonth = useSyncExternalStore(noSubscription, clockMonth, () =>
    typeof document === "undefined"
      ? clockMonth()
      : (document.getElementById(titleId)?.closest<HTMLElement>(".z-calendar")?.dataset.month ?? clockMonth()),
  );
  const visibleMonth = validMonth(month) ? month : (innerMonth ?? fallbackMonth);
  const showMonth = (next: string) => {
    if (next === visibleMonth) return;
    setInnerMonth(next);
    onMonthChange?.(next);
  };

  const [focused, setFocused] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const moveFocus = useRef(false);
  const n = view === "day" ? Math.min(12, Math.max(1, numberOfMonths)) : 1;

  const model = buildCalendar({
    mode,
    selection,
    rules,
    month: visibleMonth,
    numberOfMonths: n,
    view,
    minView,
    weekStart,
    weekend: week.weekend,
    minimalDays: week.minimalDays,
    weekNumbering,
    showWeekNumber,
    fixedWeeks,
    showOutsideDays: showOutsideDays ?? n === 1,
    outsideDaySelectable,
    unit: selectionUnit,
    today,
    focused,
    preview,
    locale,
    weekdayFormat,
    labels: {
      unavailable: unavailableLabel,
      week: weekLabel,
      chooseMonth: chooseMonthLabel,
      chooseYear: chooseYearLabel,
      checkoutOnly: checkoutOnlyLabel,
      minimum: minRangeLabel,
    },
    modifiers,
    dayDescription: getDayDescription,
  });

  /** Mueve el foco a `target` (día, mes o año), acotado a los límites, y muestra su mes. */
  const focusTarget = (target: string) => {
    const value = clampUnit(target, rules);
    moveFocus.current = true;
    setFocused(value);
    showMonth(view === "day" ? revealMonth(visibleMonth, n, value, pagedNavigation) : monthOf(unitStart(value)));
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: el efecto debe repetirse al cambiar de mes o de vista, porque la celda del día activo solo existe una vez pintada.
  useEffect(() => {
    if (!moveFocus.current || !focused) return;
    moveFocus.current = false;
    const sel = `[data-date="${focused}"]`;
    (
      root.current?.querySelector<HTMLElement>(`${sel}:not([data-outside])`) ??
      root.current?.querySelector<HTMLElement>(sel) ??
      root.current?.querySelector<HTMLElement>(`.z-calendar__unit[data-value="${focused}"]`)
    )?.focus();
  }, [focused, visibleMonth, view]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: foco inicial; solo al montar (repetirlo robaría el foco en cada cambio).
  useEffect(() => {
    // Sin selección el foco va a hoy: `today` aún no está resuelto en este primer efecto, así que se busca por fecha.
    if (!autoFocus) return;
    const start = anchor ?? todayISO();
    (
      root.current?.querySelector<HTMLElement>(`.z-calendar__day[data-date="${start}"]:not([data-outside])`) ??
      root.current?.querySelector<HTMLElement>(`.z-calendar__unit[data-value="${start}"]`) ??
      root.current?.querySelector<HTMLElement>('.z-calendar__grid [tabindex="0"]')
    )?.focus();
  }, []);

  const commit = (next: CalendarValue) => {
    setInner(next);
    (props.onValueChange as ((value: CalendarValue) => void) | undefined)?.(next);
  };

  const [innerFlex, setInnerFlex] = useState(defaultFlexibility ?? 0);
  const flex = flexibilityProp ?? innerFlex;
  const flexOptions = flexibilityOptions ?? (flexibilityProp !== undefined || defaultFlexibility !== undefined ? [0, 1, 2, 3, 7] : []);
  const chooseFlex = (days: number) => {
    setInnerFlex(days);
    onFlexibilityChange?.(days);
  };
  const nights = mode === "range" ? rangeNights(selection.range) : null;
  const length = nights === null ? null : nights + (rangeUnit === "nights" ? 0 : 1);
  const shorter = mode === "range" ? stepRange(selection.range, -1, rules) : null;
  const longer = mode === "range" ? stepRange(selection.range, 1, rules) : null;

  const pick = (value: string) => {
    const next = choose(mode, selection, value, rules, { unit: selectionUnit, weekStart });
    setFocused(value);
    if (view === "day" && model.months.every((m) => m.month !== monthOf(value))) {
      moveFocus.current = true;
      showMonth(revealMonth(visibleMonth, n, value, pagedNavigation));
    }
    if (next === undefined) return;
    if (mode === "range") setPreview(null);
    commit(next);
  };

  const onWeekNumber = (row: { number: { value: number } | null; cells: DayCell[] }) => {
    const start = row.cells[0]?.date;
    if (!start || !row.number) return;
    const next = chooseWeek(mode, selection, start, rules);
    onWeekNumberClick?.({ week: row.number.value, from: start, to: addDays(start, 6) });
    if (next === undefined) return;
    const first = anchorOf(readSelection(mode, next, unit));
    if (first) setFocused(first);
    commit(next);
  };

  const onDay = (cell: DayCell) => {
    if (cell.disabled) return;
    if (cell.outside) {
      // Día de un mes vecino: se muestra su mes y el foco sigue al día.
      moveFocus.current = true;
      showMonth(revealMonth(visibleMonth, n, cell.date, pagedNavigation));
    }
    pick(cell.date);
  };

  const onUnit = (cell: UnitCell) => {
    if (cell.disabled) return;
    if (view === minView) {
      pick(cell.value);
      return;
    }
    // Baja una vista: del año a sus meses, del mes a sus días.
    const lower = VIEWS[VIEWS.indexOf(view) - 1]!;
    const nextMonth = view === "year" ? `${cell.value}-${visibleMonth.slice(5, 7)}` : cell.value;
    setInnerMonth(nextMonth);
    onMonthChange?.(nextMonth);
    setView(lower);
    const target =
      lower === "day" ? (anchor && monthOf(unitStart(anchor)) === nextMonth ? unitStart(anchor) : `${nextMonth}-01`) : nextMonth;
    moveFocus.current = true;
    setFocused(clampUnit(target, rules));
  };

  const goToday = () => {
    const now = today ?? todayISO();
    const target = unit === "day" ? now : unit === "month" ? now.slice(0, 7) : now.slice(0, 4);
    setView(minView);
    moveFocus.current = true;
    setFocused(target);
    showMonth(revealMonth(visibleMonth, view === "day" ? n : 1, unitStart(target), pagedNavigation));
    const next = choose(mode, selection, target, rules, { unit: selectionUnit, weekStart });
    if (next !== undefined && mode !== "multiple") commit(next);
  };

  const applyPreset = (preset: CalendarPreset) => {
    const next = presetValue(preset, mode, today ?? todayISO(), weekStart);
    commit(next);
    const first = anchorOf(readSelection(mode, next, unit));
    if (first) {
      setFocused(first);
      showMonth(revealMonth(visibleMonth, n, first, pagedNavigation));
    }
  };
  const currentText = valueText(mode, selection);

  const handleKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
    const target = event.target as HTMLElement;
    const key = logicalKey(event.key, event.currentTarget);
    if (view === "day") {
      const date = target.closest<HTMLElement>("[data-date]")?.dataset.date;
      if (!date) return;
      const next = dayKeyTarget({ ...event, key }, date, weekStart);
      if (!next) return;
      event.preventDefault();
      focusTarget(next);
      return;
    }
    const value = target.closest<HTMLElement>(".z-calendar__unit")?.dataset.value;
    if (!value) return;
    if (event.key === "Escape" && view !== minView) {
      // Vuelve a la vista de elección sin cambiar el valor (y sin cerrar un DatePicker).
      event.preventDefault();
      event.stopPropagation();
      setView(minView);
      moveFocus.current = true;
      setFocused(unit === "day" ? (anchor && monthOf(unitStart(anchor)) === visibleMonth ? anchor : `${visibleMonth}-01`) : value);
      return;
    }
    const next = unitKeyTarget(view as "month" | "year", { ...event, key }, value);
    if (!next) return;
    event.preventDefault();
    focusTarget(next);
  };

  const step = navStep(view, n, pagedNavigation);
  const shift = (direction: -1 | 1) => {
    setFocused(null);
    showMonth(shiftMonth(visibleMonth, direction * step));
  };
  const upView = VIEWS[VIEWS.indexOf(view) + 1];
  const canGoUp = Boolean(upView) && VIEWS.indexOf(view) < VIEWS.indexOf(clampView(maxView, minView, maxView));
  const dropdown = captionLayout !== "label" && view === "day" && n === 1;
  const caption = dropdown ? captionOptions(visibleMonth, rules, locale) : null;
  const multiselect = mode !== "single" || undefined;

  const legendItems = (["today", "selected", "unavailable"] as const).filter((k) => legend?.[k]);

  return (
    <div
      ref={root}
      id={id}
      className={cx("z-calendar", className)}
      data-mode={mode}
      data-month={visibleMonth}
      data-view={view}
      data-cell-size={cellSize}
      data-months={n > 1 ? n : undefined}
      data-caption={dropdown ? captionLayout : undefined}
      data-week-numbers={on(showWeekNumber)}
      data-week-select={on(showWeekNumber && Boolean(onWeekNumberClick))}
      data-presets={presets?.length ? "" : undefined}
      data-presets-placement={presets?.length && presetsPlacement === "top" ? "top" : undefined}
      style={n > 1 ? ({ "--z-calendar-months": n } as CSSProperties) : undefined}
    >
      {presets?.length ? (
        <div className="z-calendar__presets" role="group" aria-labelledby={presetsId}>
          <p className="z-calendar__presets-label" id={presetsId}>
            {presetsLabel}
          </p>
          {presets.map((preset) => {
            const value = presetValue(preset, mode, today ?? todayISO(), weekStart);
            const pressed = valueText(mode, readSelection(mode, value, unit)) === currentText && currentText !== "";
            return (
              <button
                key={preset.label}
                type="button"
                className="z-calendar__preset"
                aria-pressed={today ? pressed : false}
                onClick={() => applyPreset(preset)}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="z-calendar__main">
        <div className="z-calendar__header">
          <button
            type="button"
            className="z-calendar__nav"
            data-nav="previous"
            aria-label={previousMonthLabel}
            title={previousMonthLabel}
            disabled={!model.canPrevious}
            onClick={() => shift(-1)}
          >
            <Icon name="chevron-left" size={16} />
          </button>
          {caption ? (
            <div className="z-calendar__selects">
              {captionLayout !== "dropdown-years" ? (
                <span className="z-calendar__select-wrap">
                  <select
                    className="z-calendar__select"
                    data-part="month"
                    aria-label={monthLabel}
                    value={visibleMonth}
                    onChange={(event) => showMonth(event.target.value)}
                  >
                    {caption.months.map((m) => (
                      <option key={m.value} value={m.value} disabled={m.disabled}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <Icon name="chevron-up-down" size={14} />
                </span>
              ) : null}
              {captionLayout !== "dropdown-months" ? (
                <span className="z-calendar__select-wrap">
                  <select
                    className="z-calendar__select"
                    data-part="year"
                    aria-label={yearLabel}
                    value={visibleMonth.slice(0, 4)}
                    onChange={(event) => showMonth(`${event.target.value}-${visibleMonth.slice(5, 7)}`)}
                  >
                    {caption.years.map((y) => (
                      <option key={y.value} value={y.value}>
                        {y.label}
                      </option>
                    ))}
                  </select>
                  <Icon name="chevron-up-down" size={14} />
                </span>
              ) : null}
            </div>
          ) : null}
          <div className="z-calendar__title" id={titleId} aria-live="polite" data-hidden={caption ? "" : undefined}>
            {canGoUp && !caption ? (
              <button
                type="button"
                className="z-calendar__view"
                title={view === "day" ? chooseMonthLabel : chooseYearLabel}
                onClick={() => {
                  // Sube una vista y el foco entra en la rejilla, en el mes o el año visible.
                  setView(upView!);
                  moveFocus.current = true;
                  setFocused(view === "day" ? visibleMonth : visibleMonth.slice(0, 4));
                }}
              >
                {model.title}
              </button>
            ) : (
              model.title
            )}
          </div>
          <button
            type="button"
            className="z-calendar__nav"
            data-nav="next"
            aria-label={nextMonthLabel}
            title={nextMonthLabel}
            disabled={!model.canNext}
            onClick={() => shift(1)}
          >
            <Icon name="chevron-right" size={16} />
          </button>
        </div>
        <div className="z-calendar__months">
          {view === "day" ? (
            model.months.map((m) => (
              <div className="z-calendar__month" key={m.month} data-month={m.month}>
                <table
                  className="z-calendar__grid"
                  // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: patrón APG «date picker grid»: una tabla con role="grid" conserva filas, cabeceras y celdas y añade la navegación con flechas.
                  role="grid"
                  aria-labelledby={n === 1 ? titleId : undefined}
                  aria-label={n === 1 ? undefined : m.title}
                  aria-multiselectable={multiselect}
                  onKeyDown={handleKeyDown}
                  onMouseLeave={() => setPreview(null)}
                >
                  <thead>
                    <tr>
                      {showWeekNumber ? (
                        <th scope="col" abbr={weekLabel} className="z-calendar__weekday" data-week-number="">
                          <span className="z-sr-only">{weekLabel}</span>
                        </th>
                      ) : null}
                      {model.weekdays.map((weekday) => (
                        <th
                          key={weekday.long}
                          scope="col"
                          abbr={weekday.long}
                          className="z-calendar__weekday"
                          data-weekend={on(weekday.weekend)}
                        >
                          {weekday.short}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {m.weeks.map((row) => (
                      <tr key={row.key}>
                        {row.number ? (
                          <th
                            scope="row"
                            className="z-calendar__week-number"
                            aria-label={onWeekNumberClick ? undefined : row.number.ariaLabel}
                          >
                            {onWeekNumberClick ? (
                              <button
                                type="button"
                                className="z-calendar__week-button"
                                aria-label={row.number.ariaLabel}
                                onClick={() => onWeekNumber(row)}
                              >
                                {row.number.label}
                              </button>
                            ) : (
                              row.number.label
                            )}
                          </th>
                        ) : null}
                        {row.cells.map((cell) =>
                          cell.hidden ? (
                            <td key={cell.date} className="z-calendar__cell" data-outside="" />
                          ) : (
                            <DayCellView
                              key={cell.date}
                              cell={cell}
                              mode={mode}
                              unit={selectionUnit}
                              renderDay={renderDay}
                              onPick={() => onDay(cell)}
                              onFocus={() => {
                                setFocused(cell.date);
                                if (mode === "range" || selectionUnit === "week") setPreview(cell.date);
                              }}
                              onHover={() => setPreview(cell.date)}
                            />
                          ),
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          ) : (
            <div className="z-calendar__month">
              <table
                className="z-calendar__grid"
                // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: rejilla APG de meses o años.
                role="grid"
                data-view={view}
                aria-label={model.unitsLabel}
                aria-multiselectable={view === minView ? multiselect : undefined}
                onKeyDown={handleKeyDown}
                onMouseLeave={() => setPreview(null)}
              >
                <tbody>
                  {model.units.map((row) => (
                    <tr key={row[0]!.value}>
                      {row.map((cell) => (
                        // biome-ignore lint/a11y/useAriaPropsSupportedByRole: dentro de una tabla con role="grid" la celda es un gridcell implícito, que sí admite aria-selected.
                        <td
                          key={cell.value}
                          className="z-calendar__cell"
                          aria-selected={cell.inSelection}
                          data-range={cell.range}
                          data-preview={on(cell.preview)}
                        >
                          <button
                            type="button"
                            className="z-calendar__unit"
                            data-value={cell.value}
                            data-selected={on(cell.selected)}
                            data-current={on(cell.current)}
                            data-outside={on(cell.outside)}
                            aria-disabled={cell.disabled || undefined}
                            aria-label={cell.ariaLabel}
                            tabIndex={cell.tabbable ? 0 : -1}
                            onClick={() => onUnit(cell)}
                            onFocus={() => {
                              setFocused(cell.value);
                              if (mode === "range" && view === minView) setPreview(cell.value);
                            }}
                            onMouseEnter={mode === "range" && view === minView ? () => setPreview(cell.value) : undefined}
                          >
                            {cell.label}
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {flexOptions.length && mode === "range" ? (
          <div className="z-calendar__flex" role="group" aria-label={flexibilityGroupLabel}>
            {flexOptions.map((days) => (
              <button
                key={days}
                type="button"
                className="z-calendar__flex-chip"
                aria-pressed={flex === days}
                onClick={() => chooseFlex(days)}
              >
                {days === 0 ? exactDatesLabel : days === 1 ? flexibilityOneLabel : flexibilityLabel.replace("{n}", String(days))}
              </button>
            ))}
          </div>
        ) : null}
        {showLengthStepper && mode === "range" ? (
          <div className="z-calendar__stepper">
            <button
              type="button"
              className="z-calendar__stepper-btn"
              aria-label={decreaseLabel}
              aria-disabled={!shorter || undefined}
              onClick={() => shorter && commit(shorter)}
            >
              <Icon name="minus" size={16} />
            </button>
            <output className="z-calendar__length" aria-live="polite">
              {length === null ? "" : length === 1 ? lengthOneLabel : lengthLabel.replace("{n}", String(length))}
            </output>
            <button
              type="button"
              className="z-calendar__stepper-btn"
              aria-label={increaseLabel}
              aria-disabled={!longer || undefined}
              onClick={() => longer && commit(longer)}
            >
              <Icon name="plus" size={16} />
            </button>
          </div>
        ) : null}
        {showTodayButton || footer ? (
          <div className="z-calendar__footer">
            {showTodayButton ? (
              <button type="button" className="z-calendar__today" onClick={goToday}>
                {todayLabel}
              </button>
            ) : null}
            {footer}
          </div>
        ) : null}
        {legendItems.length ? (
          <ul className="z-calendar__legend">
            {legendItems.map((k) => (
              <li key={k} data-legend={k}>
                <span className="z-calendar__swatch" aria-hidden="true" />
                {legend?.[k]}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

interface DayCellViewProps {
  cell: DayCell;
  mode: CalendarMode;
  unit: SelectionUnit;
  renderDay: CalendarBaseProps["renderDay"];
  onPick: () => void;
  onFocus: () => void;
  onHover: () => void;
}

function DayCellView({ cell, mode, unit, renderDay, onPick, onFocus, onHover }: DayCellViewProps) {
  const content = renderDay?.(cell.date, {
    selected: cell.selected,
    today: cell.today,
    disabled: cell.disabled,
    unavailable: cell.unavailable,
    outside: cell.outside,
    modifiers: cell.modifiers,
  });
  const extra: Record<string, string> = {};
  for (const name of cell.modifiers) if (MODIFIER.test(name)) extra[`data-${name}`] = "";
  const previewing = mode === "range" || unit === "week";
  return (
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: dentro de una tabla con role="grid" la celda es un gridcell implícito, que sí admite aria-selected.
    <td
      className="z-calendar__cell"
      aria-selected={cell.inSelection}
      data-range={cell.range}
      data-preview={on(cell.preview)}
      data-row-start={on(cell.rowStart)}
      data-row-end={on(cell.rowEnd)}
    >
      <button
        type="button"
        className="z-calendar__day"
        data-date={cell.date}
        data-selected={on(cell.selected)}
        data-today={on(cell.today)}
        data-outside={on(cell.outside)}
        data-unavailable={on(cell.unavailable)}
        data-weekend={on(cell.weekend)}
        data-checkout-only={on(cell.checkoutOnly)}
        data-below-minimum={on(cell.belowMinimum)}
        {...extra}
        aria-disabled={cell.disabled || undefined}
        aria-current={cell.today ? "date" : undefined}
        aria-label={cell.ariaLabel}
        tabIndex={cell.tabbable ? 0 : -1}
        onClick={onPick}
        onFocus={onFocus}
        onMouseEnter={previewing ? onHover : undefined}
      >
        {cell.label}
      </button>
      {cell.hint ? (
        <span className="z-calendar__hint" aria-hidden="true">
          {cell.hint}
        </span>
      ) : null}
      {/* Fuera del botón: decorativo, sin alterar su nombre visible ni recibir el puntero. */}
      {content != null && content !== false ? (
        <span className="z-calendar__day-content" aria-hidden="true">
          {content}
        </span>
      ) : null}
    </td>
  );
}
