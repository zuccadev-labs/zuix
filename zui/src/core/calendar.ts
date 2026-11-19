// Modelo del calendario: lo que comparten el binding de React y el modo DOM. A partir de la configuración y del
// estado (mes visible, vista, día activo, vista previa) calcula qué se pinta en cada celda, qué día recibe el
// tabulador, adónde lleva cada tecla y qué valor deja cada clic. Sin React ni documento: solo cadenas ISO e `Intl`.
import {
  addDays,
  addMonths,
  clampDate,
  daysInMonth,
  diffDays,
  endOfMonth,
  FIRST_DAY,
  LAST_DAY,
  monthOf,
  pad,
  parse,
  safeLocale,
  startOfMonth,
  startOfWeek,
  valid,
  validMonth,
  validYear,
  weekdayOf,
  weekNumber,
  type DateRange,
} from "./date";

export type CalendarMode = "single" | "range" | "multiple";
export type CalendarView = "day" | "month" | "year";
export type SelectionUnit = "day" | "week";
export type WeekNumbering = "iso" | "locale";
export type WeekdayFormat = "narrow" | "short" | "long";
export type CaptionLayout = "label" | "dropdown" | "dropdown-months" | "dropdown-years";
export type CalendarValue = string | null | DateRange | string[];

export const VIEWS: readonly CalendarView[] = ["day", "month", "year"];
const rank = (view: CalendarView) => VIEWS.indexOf(view);
/** Columnas de las vistas de mes y año (rejilla de 3 × 4). */
export const UNIT_COLUMNS = 3;

/** Normaliza una vista con sus límites: `minView ≤ view ≤ maxView`. */
export function clampView(view: string | null | undefined, minView: CalendarView = "day", maxView: CalendarView = "year"): CalendarView {
  const lo = rank(minView);
  const hi = Math.max(lo, rank(maxView));
  const at = rank((VIEWS as readonly string[]).includes(view ?? "") ? (view as CalendarView) : minView);
  return VIEWS[Math.min(hi, Math.max(lo, at))]!;
}

/** Valida un valor según la unidad de la vista mínima: fecha (`day`), `YYYY-MM` (`month`) o `YYYY` (`year`). */
export function validUnit(value: unknown, unit: CalendarView): value is string {
  if (typeof value !== "string") return false;
  return unit === "day" ? valid(value) : unit === "month" ? validMonth(value) : validYear(value);
}
/** Primer día que representa un valor de cualquier unidad. */
export const unitStart = (value: string) => (value.length === 4 ? `${value}-01-01` : value.length === 7 ? `${value}-01` : value);
/** Último día que representa un valor de cualquier unidad. */
export const unitEnd = (value: string) => (value.length === 4 ? `${value}-12-31` : value.length === 7 ? endOfMonth(`${value}-01`) : value);

export interface CalendarSelection {
  single: string | null;
  range: DateRange;
  multiple: string[];
}

/** Lee el valor bruto (cadena, `{ from, to }`, lista o `null`) según el modo y la unidad. */
export function readSelection(mode: CalendarMode, raw: unknown, unit: CalendarView = "day"): CalendarSelection {
  const ok = (v: unknown): v is string => validUnit(v, unit);
  const empty: CalendarSelection = { single: null, range: { from: null, to: null }, multiple: [] };
  if (mode === "single") return { ...empty, single: ok(raw) ? raw : null };
  if (mode === "range") {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const { from, to } = raw as DateRange;
      const a = ok(from) ? from : null;
      const b = a && ok(to) ? to : null;
      return { ...empty, range: a && b && b < a ? { from: b, to: a } : { from: a, to: b } };
    }
    return empty;
  }
  const list = Array.isArray(raw) ? raw.filter(ok) : [];
  return { ...empty, multiple: [...new Set(list)].sort() };
}

/** Valor público de la selección según el modo. */
export function selectionValue(mode: CalendarMode, selection: CalendarSelection): CalendarValue {
  return mode === "single" ? selection.single : mode === "range" ? selection.range : selection.multiple;
}

/** Primer valor elegido: marca el mes inicial y el día que recibe el foco. */
export const anchorOf = (selection: CalendarSelection) => selection.single ?? selection.range.from ?? selection.multiple[0] ?? null;

/** Texto para el formulario y los atributos `data-value`: fecha, `desde/hasta` o lista separada por comas. */
export function valueText(mode: CalendarMode, selection: CalendarSelection): string {
  if (mode === "single") return selection.single ?? "";
  if (mode === "range") return selection.range.from ? `${selection.range.from}/${selection.range.to ?? ""}` : "";
  return selection.multiple.join(",");
}
/** Lo contrario de `valueText`: lee `data-value`. */
export function parseValueText(mode: CalendarMode, text: string | null | undefined, unit: CalendarView = "day"): CalendarSelection {
  const raw = text ?? "";
  if (mode === "single") return readSelection(mode, raw, unit);
  if (mode === "range") {
    const [from, to] = raw.split("/");
    return readSelection(mode, { from, to }, unit);
  }
  return readSelection(
    mode,
    raw.split(",").map((v) => v.trim()),
    unit,
  );
}

/* ---------- Reglas de elegibilidad ---------- */

export interface CalendarRules {
  /** Primer día elegible (`YYYY-MM-DD`; también `YYYY-MM` o `YYYY`, que cuentan desde su primer día). */
  min?: string | null;
  /** Último día elegible (`YYYY-MM-DD`; también `YYYY-MM` o `YYYY`, que cuentan hasta su último día). */
  max?: string | null;
  isDateDisabled?: ((date: string) => boolean) | undefined;
  /** Reservada: visible y enfocable, marcada, no seleccionable; en rango, corta el rango. */
  isDateUnavailable?: ((date: string) => boolean) | undefined;
  /** Días mínimos y máximos de un rango (ambos extremos incluidos). */
  minRange?: number | undefined;
  maxRange?: number | undefined;
  rangeCrossesUnavailable?: "block" | "allow" | undefined;
  allowSingleDayRange?: boolean | undefined;
  maxSelected?: number | undefined;
}

/** Límites normalizados a días (`min > max` ignora `max`). */
export function bounds(rules: CalendarRules): { min: string; max: string } {
  const norm = (v: string | null | undefined, end: boolean) =>
    v && (valid(v) || validMonth(v) || validYear(v)) ? (end ? unitEnd(v) : unitStart(v)) : null;
  const min = norm(rules.min, false) ?? FIRST_DAY;
  let max = norm(rules.max, true) ?? LAST_DAY;
  if (max < min) max = LAST_DAY;
  return { min, max };
}

/** Estado propio de un día: fuera de límites o deshabilitado (`disabled`), reservado (`unavailable`) o elegible. */
export function dayStatus(date: string, rules: CalendarRules): "disabled" | "unavailable" | null {
  const { min, max } = bounds(rules);
  if (date < min || date > max || rules.isDateDisabled?.(date)) return "disabled";
  if (rules.isDateUnavailable?.(date)) return "unavailable";
  return null;
}

/** Ventana que puede alcanzar el fin de un rango que empieza en `from`: corta en la primera fecha reservada o no
 *  elegible a cada lado (si `rangeCrossesUnavailable` no es `allow`) y en `maxRange`. */
export function rangeWindow(from: string, rules: CalendarRules): { lo: string; hi: string } {
  const { min, max } = bounds(rules);
  const reach = rules.maxRange && rules.maxRange > 0 ? rules.maxRange - 1 : null;
  let lo = reach === null ? min : clampDate(addDays(from, -reach), min, max);
  let hi = reach === null ? max : clampDate(addDays(from, reach), min, max);
  const reserved = rules.isDateUnavailable;
  if (reserved && rules.rangeCrossesUnavailable !== "allow") {
    // Se busca la primera reservada a cada lado (como mucho tres años: más allá se da por libre).
    for (let i = 1, d = addDays(from, -1); i <= 1100 && d >= lo; i++, d = addDays(d, -1))
      if (reserved(d)) {
        lo = addDays(d, 1);
        break;
      }
    for (let i = 1, d = addDays(from, 1); i <= 1100 && d <= hi; i++, d = addDays(d, 1))
      if (reserved(d)) {
        hi = addDays(d, -1);
        break;
      }
  }
  return { lo, hi };
}

/** Verdadero si `date` no puede cerrar el rango que empieza en `from` (fuera de la ventana o del mínimo de días). */
export function rangeBlocked(from: string, date: string, rules: CalendarRules, window = rangeWindow(from, rules)): boolean {
  if (date < window.lo || date > window.hi) return true;
  const days = Math.abs(diffDays(from, date)) + 1;
  if (rules.minRange && days < rules.minRange && date !== from) return true;
  return false;
}

export interface ChooseOptions {
  unit?: SelectionUnit;
  weekStart?: number;
}

/** Valor que deja elegir `value` (un día, mes o año). `undefined` si el clic no cambia nada. */
export function choose(
  mode: CalendarMode,
  selection: CalendarSelection,
  value: string,
  rules: CalendarRules,
  options: ChooseOptions = {},
): CalendarValue | undefined {
  const isDay = value.length === 10;
  if (isDay && dayStatus(value, rules)) return undefined;
  if (!isDay) {
    const { min, max } = bounds(rules);
    if (unitEnd(value) < min || unitStart(value) > max) return undefined;
  }
  const week = isDay && options.unit === "week";
  const start = week ? startOfWeek(value, options.weekStart ?? 1) : value;
  if (mode === "single") return start;
  if (mode === "multiple") {
    const has = selection.multiple.includes(value);
    if (!has && rules.maxSelected && selection.multiple.length >= rules.maxSelected) return undefined;
    return has ? selection.multiple.filter((v) => v !== value) : [...selection.multiple, value].sort();
  }
  const { from, to } = selection.range;
  if (!from || to) return week ? { from: start, to: null } : { from: value, to: null };
  if (week) {
    const [a, b] = start < from ? [start, from] : [from, start];
    return { from: a, to: addDays(b, 6) };
  }
  if (value === from && rules.allowSingleDayRange === false) return undefined;
  if (isDay && rangeBlocked(from, value, rules)) return { from: value, to: null };
  return value < from ? { from: value, to: from } : { from, to: value };
}

/**
 * Valor que deja pulsar el número de una semana que empieza en `start`: en rango, la semana entera (recortada a los
 * días elegibles de los extremos); en múltiple, añade sus días elegibles (o los quita si ya estaban todos); en fecha
 * única, su primer día elegible. `undefined` si ningún día de la semana se puede elegir.
 */
export function chooseWeek(
  mode: CalendarMode,
  selection: CalendarSelection,
  start: string,
  rules: CalendarRules,
): CalendarValue | undefined {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i)).filter((d) => !dayStatus(d, rules));
  if (!days.length) return undefined;
  const first = days[0]!;
  const last = days[days.length - 1]!;
  if (mode === "single") return first;
  if (mode === "range") return { from: first, to: last };
  const all = days.every((d) => selection.multiple.includes(d));
  if (all) return selection.multiple.filter((d) => !days.includes(d));
  const next = [...new Set([...selection.multiple, ...days])].sort();
  return rules.maxSelected && next.length > rules.maxSelected ? undefined : next;
}

/* ---------- Formatos ---------- */

export interface CalendarFormats {
  title: Intl.DateTimeFormat;
  monthLong: Intl.DateTimeFormat;
  monthShort: Intl.DateTimeFormat;
  year: Intl.DateTimeFormat;
  weekday: Intl.DateTimeFormat;
  weekdayLong: Intl.DateTimeFormat;
  day: Intl.DateTimeFormat;
  full: Intl.DateTimeFormat;
  number: Intl.NumberFormat;
}
const formatCache = new Map<string, CalendarFormats>();

/** Formateadores de `Intl` para el locale (en UTC: las fechas son civiles). Se guardan por locale y formato. */
export function calendarFormats(locale?: string, weekdayFormat: WeekdayFormat = "short"): CalendarFormats {
  const resolved = safeLocale(locale);
  const key = `${resolved ?? ""}|${weekdayFormat}`;
  let formats = formatCache.get(key);
  if (!formats) {
    const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(resolved, { ...options, timeZone: "UTC" });
    formats = {
      title: fmt({ month: "long", year: "numeric" }),
      monthLong: fmt({ month: "long" }),
      monthShort: fmt({ month: "short" }),
      year: fmt({ year: "numeric" }),
      weekday: fmt({ weekday: weekdayFormat }),
      weekdayLong: fmt({ weekday: "long" }),
      day: fmt({ day: "numeric" }),
      full: fmt({ dateStyle: "full" }),
      number: new Intl.NumberFormat(resolved, { useGrouping: false }),
    };
    formatCache.set(key, formats);
  }
  return formats;
}

/* ---------- Modelo de la vista ---------- */

export interface CalendarLabels {
  /** Se añade al nombre accesible de una fecha reservada («…, booked»). */
  unavailable?: string;
  /** Prefijo del número de semana («Week 47»). */
  week?: string;
  chooseMonth?: string;
  chooseYear?: string;
}

export interface CalendarInput {
  mode: CalendarMode;
  selection: CalendarSelection;
  rules: CalendarRules;
  /** Primer mes visible, `YYYY-MM`. En las vistas de mes y año marca el año y la década. */
  month: string;
  numberOfMonths?: number;
  view?: CalendarView;
  minView?: CalendarView;
  weekStart: number;
  weekend?: number[];
  minimalDays?: number;
  weekNumbering?: WeekNumbering;
  showWeekNumber?: boolean;
  fixedWeeks?: boolean;
  showOutsideDays?: boolean;
  outsideDaySelectable?: boolean;
  unit?: SelectionUnit;
  today?: string | null;
  focused?: string | null;
  preview?: string | null;
  locale?: string;
  weekdayFormat?: WeekdayFormat;
  labels?: CalendarLabels;
  modifiers?: Record<string, (date: string) => boolean> | undefined;
  dayDescription?: ((date: string) => string | null | undefined) | undefined;
}

export type RangePart = "start" | "middle" | "end" | "single";

export interface DayCell {
  date: string;
  label: string;
  ariaLabel: string;
  outside: boolean;
  /** Día de otro mes sin mostrar: celda vacía. */
  hidden: boolean;
  selected: boolean;
  /** `aria-selected` de la celda: elegido o dentro del rango elegido. */
  inSelection: boolean;
  range: RangePart | undefined;
  preview: boolean;
  /** Extremos de la banda del rango en la fila (redondeo). */
  rowStart: boolean;
  rowEnd: boolean;
  today: boolean;
  disabled: boolean;
  unavailable: boolean;
  weekend: boolean;
  modifiers: string[];
  tabbable: boolean;
}

export interface WeekRow {
  key: string;
  number: { value: number; label: string; ariaLabel: string } | null;
  cells: DayCell[];
}

export interface MonthModel {
  month: string;
  title: string;
  weeks: WeekRow[];
}

export interface UnitCell {
  value: string;
  label: string;
  ariaLabel: string;
  outside: boolean;
  selected: boolean;
  inSelection: boolean;
  range: RangePart | undefined;
  preview: boolean;
  current: boolean;
  disabled: boolean;
  tabbable: boolean;
}

export interface CalendarModel {
  view: CalendarView;
  title: string;
  weekdays: { short: string; long: string; weekend: boolean }[];
  months: MonthModel[];
  /** Vistas de mes y año: filas de 3 celdas. */
  units: UnitCell[][];
  unitsLabel: string;
  canPrevious: boolean;
  canNext: boolean;
  /** Valor que recibe el tabulador (fecha, mes o año). */
  tabbable: string;
  firstMonth: string;
  lastMonth: string;
}

/** Último mes visible con `n` meses desde `month`. */
export const lastVisibleMonth = (month: string, n: number) => monthOf(addMonths(`${month}-01`, Math.max(1, n) - 1));

/** Mes que hay que mostrar primero para que `target` sea visible, desde `first` con `n` meses. */
export function revealMonth(first: string, n: number, target: string, paged = false): string {
  const count = Math.max(1, n);
  const last = lastVisibleMonth(first, count);
  const t = monthOf(target.length === 4 ? `${target}-01-01` : target.length === 7 ? `${target}-01` : target);
  if (t >= first && t <= last) return first;
  if (paged) {
    const months = (Number(t.slice(0, 4)) - Number(first.slice(0, 4))) * 12 + Number(t.slice(5, 7)) - Number(first.slice(5, 7));
    return monthOf(addMonths(`${first}-01`, Math.floor(months / count) * count));
  }
  return t < first ? t : monthOf(addMonths(`${t}-01`, -(count - 1)));
}

/** Meses que avanza cada flecha de la cabecera según la vista. */
export function navStep(view: CalendarView, numberOfMonths = 1, paged = false): number {
  return view === "year" ? 120 : view === "month" ? 12 : paged ? Math.max(1, numberOfMonths) : 1;
}

/** Desplaza el primer mes visible `months` meses, sin salir de 0001-01 … 9999-12. */
export function shiftMonth(month: string, months: number): string {
  const next = monthOf(addMonths(`${month}-01`, months));
  return next < "0001-01" ? "0001-01" : next > "9999-12" ? "9999-12" : next;
}

function bandPart(date: string, from: string | null, to: string | null): RangePart | undefined {
  if (!from) return undefined;
  if (!to || from === to) return date === from ? "single" : undefined;
  if (date === from) return "start";
  if (date === to) return "end";
  return date > from && date < to ? "middle" : undefined;
}

/** La banda pintada: el rango elegido o, mientras se elige el fin, la vista previa hasta el día activo. */
function band(input: CalendarInput): { from: string | null; to: string | null; preview: boolean } {
  const { mode, selection, preview, unit, weekStart } = input;
  if (unit === "week" && mode === "single") {
    const hovered = preview ? startOfWeek(preview, weekStart) : null;
    if (hovered && hovered !== selection.single) return { from: hovered, to: addDays(hovered, 6), preview: true };
    return selection.single
      ? { from: selection.single, to: addDays(selection.single, 6), preview: false }
      : { from: null, to: null, preview: false };
  }
  if (mode !== "range") return { from: null, to: null, preview: false };
  const { from, to } = selection.range;
  if (from && !to && preview && preview !== from) {
    if (unit === "week") {
      const end = startOfWeek(preview, weekStart);
      return end < from ? { from: end, to: addDays(from, 6), preview: true } : { from, to: addDays(end, 6), preview: true };
    }
    if (preview.length !== from.length) return { from, to: null, preview: false };
    return preview < from ? { from: preview, to: from, preview: true } : { from, to: preview, preview: true };
  }
  return { from, to, preview: false };
}

/** Calcula todo lo que pinta el calendario. */
export function buildCalendar(input: CalendarInput): CalendarModel {
  const view = clampView(input.view, input.minView);
  const n = view === "day" ? Math.min(12, Math.max(1, Math.floor(input.numberOfMonths ?? 1))) : 1;
  const firstMonth = validMonth(input.month) ? input.month : "2000-01";
  const lastMonth = lastVisibleMonth(firstMonth, n);
  const formats = calendarFormats(input.locale, input.weekdayFormat);
  const { min, max } = bounds(input.rules);
  const anchor = anchorOf(input.selection);
  const canPrevious =
    view === "year"
      ? Number(firstMonth.slice(0, 4)) - (Number(firstMonth.slice(0, 4)) % 10) - 1 >= Math.max(1, Number(min.slice(0, 4)))
      : view === "month"
        ? Number(firstMonth.slice(0, 4)) - 1 >= Math.max(1, Number(min.slice(0, 4)))
        : firstMonth > "0001-01" && addDays(`${firstMonth}-01`, -1) >= min;
  const lastYear = Number(lastMonth.slice(0, 4));
  const canNext =
    view === "year"
      ? lastYear - (lastYear % 10) + 10 <= Math.min(9999, Number(max.slice(0, 4)))
      : view === "month"
        ? lastYear + 1 <= Math.min(9999, Number(max.slice(0, 4)))
        : lastMonth < "9999-12" && addDays(endOfMonth(`${lastMonth}-01`), 1) <= max;

  if (view !== "day") return unitModel(input, view, firstMonth, formats, { min, max }, canPrevious, canNext, anchor);

  const weekend = new Set(input.weekend ?? [6, 0]);
  const showOutside = input.showOutsideDays ?? n === 1;
  const today = input.today && valid(input.today) ? input.today : null;
  const b = band(input);
  const pickingFrom = input.mode === "range" && input.selection.range.from && !input.selection.range.to ? input.selection.range.from : null;
  const window = pickingFrom && pickingFrom.length === 10 ? rangeWindow(pickingFrom, input.rules) : null;
  const multiple = new Set(input.selection.multiple);
  const firstDay = `${firstMonth}-01`;
  const lastDay = endOfMonth(`${lastMonth}-01`);
  const visible = (d: string | null | undefined): d is string => Boolean(d) && (d as string) >= firstDay && (d as string) <= lastDay;
  const candidates = [input.focused, anchor && anchor.length === 10 ? anchor : null, today];
  let tabbable = candidates.find(visible) ?? firstDay;
  if (dayStatus(tabbable, input.rules) === "disabled" && !visible(input.focused)) {
    // El primer día elegible de la vista, si lo hay; si no, el primero.
    for (let d = firstDay; d <= lastDay; d = addDays(d, 1))
      if (!dayStatus(d, input.rules)) {
        tabbable = d;
        break;
      }
  }
  const weekdays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(startOfWeek("2026-11-01", input.weekStart), i);
    return {
      short: formats.weekday.format(parse(date)),
      long: formats.weekdayLong.format(parse(date)),
      weekend: weekend.has(weekdayOf(date)),
    };
  });

  const months: MonthModel[] = [];
  for (let m = 0; m < n; m++) {
    const month = monthOf(addMonths(firstDay, m));
    const first = `${month}-01`;
    const last = endOfMonth(first);
    const lead = (weekdayOf(first) - input.weekStart + 7) % 7;
    const rows = input.fixedWeeks ? 6 : Math.ceil((lead + daysInMonth(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1)) / 7);
    const origin = addDays(first, -lead);
    const weeks: WeekRow[] = [];
    for (let r = 0; r < rows; r++) {
      const rowStart = addDays(origin, r * 7);
      const cells: DayCell[] = [];
      for (let c = 0; c < 7; c++) {
        const date = addDays(rowStart, c);
        const outside = date < first || date > last;
        const hidden = (outside && !showOutside) || date < FIRST_DAY || date > LAST_DAY;
        const status = dayStatus(date, input.rules);
        const blocked = Boolean(pickingFrom && window && date !== pickingFrom && rangeBlocked(pickingFrom, date, input.rules, window));
        const disabled = Boolean(status) || blocked || (outside && input.outsideDaySelectable === false);
        const part = bandPart(date, b.from, b.to);
        const selected =
          input.mode === "single"
            ? input.unit === "week"
              ? Boolean(input.selection.single) && (date === input.selection.single || date === addDays(input.selection.single!, 6))
              : date === input.selection.single
            : input.mode === "range"
              ? date === input.selection.range.from || date === input.selection.range.to
              : multiple.has(date);
        const range = input.selection.range;
        const inRange = input.mode === "range" && Boolean(range.from && range.to && date >= range.from && date <= range.to);
        const inWeek =
          input.unit === "week" &&
          input.mode === "single" &&
          Boolean(input.selection.single) &&
          date >= input.selection.single! &&
          date <= addDays(input.selection.single!, 6);
        const extra: string[] = [];
        if (status === "unavailable" && input.labels?.unavailable) extra.push(input.labels.unavailable);
        const description = input.dayDescription?.(date);
        if (description) extra.push(description);
        const mods = input.modifiers ? Object.keys(input.modifiers).filter((k) => input.modifiers![k]!(date)) : [];
        cells.push({
          date,
          label: formats.day.format(parse(date)),
          ariaLabel: [formats.full.format(parse(date)), ...extra].join(", "),
          outside,
          hidden,
          selected,
          inSelection: selected || inRange || inWeek,
          range: part,
          preview: Boolean(part && b.preview),
          rowStart: false,
          rowEnd: false,
          today: date === today,
          disabled,
          unavailable: status === "unavailable",
          weekend: weekend.has(weekdayOf(date)),
          modifiers: mods,
          tabbable: !outside && date === tabbable,
        });
      }
      // Extremos de la banda en la fila: primera o última celda pintada (las vacías cortan la banda).
      cells.forEach((cell, i) => {
        if (!cell.range || cell.hidden) return;
        cell.rowStart = i === 0 || Boolean(cells[i - 1]!.hidden);
        cell.rowEnd = i === 6 || Boolean(cells[i + 1]!.hidden);
      });
      let number: WeekRow["number"] = null;
      if (input.showWeekNumber) {
        const value =
          input.weekNumbering === "locale"
            ? weekNumber(rowStart, input.weekStart, input.minimalDays ?? 4).week
            : weekNumber(startOfWeek(addDays(rowStart, 6), 1), 1, 4).week;
        const label = formats.number.format(value);
        number = { value, label, ariaLabel: `${input.labels?.week ?? "Week"} ${label}` };
      }
      weeks.push({ key: rowStart, number, cells });
    }
    months.push({ month, title: formats.title.format(parse(first)), weeks });
  }

  const title =
    n === 1
      ? formats.title.format(parse(firstDay))
      : ((formats.title as Intl.DateTimeFormat & { formatRange?: (a: Date, b: Date) => string }).formatRange?.(
          parse(firstDay),
          parse(`${lastMonth}-01`),
        ) ?? `${formats.title.format(parse(firstDay))} – ${formats.title.format(parse(`${lastMonth}-01`))}`);
  return { view, title, weekdays, months, units: [], unitsLabel: "", canPrevious, canNext, tabbable, firstMonth, lastMonth };
}

function unitModel(
  input: CalendarInput,
  view: "month" | "year",
  firstMonth: string,
  formats: CalendarFormats,
  { min, max }: { min: string; max: string },
  canPrevious: boolean,
  canNext: boolean,
  anchor: string | null,
): CalendarModel {
  const year = Number(firstMonth.slice(0, 4));
  const minView = clampView(input.minView);
  const isValue = rank(minView) === rank(view);
  const today = input.today && valid(input.today) ? input.today : null;
  const cut = (v: string) => (view === "month" ? v.slice(0, 7) : v.slice(0, 4));
  const b = isValue ? band(input) : { from: null, to: null, preview: false };
  const picked = new Set(
    isValue
      ? input.mode === "multiple"
        ? input.selection.multiple
        : input.mode === "single"
          ? [input.selection.single].filter(Boolean)
          : [input.selection.range.from, input.selection.range.to].filter(Boolean)
      : anchor
        ? [cut(anchor)]
        : [],
  ) as Set<string>;
  const values: { value: string; outside: boolean }[] = [];
  if (view === "month") for (let m = 1; m <= 12; m++) values.push({ value: `${pad(year, 4)}-${pad(m)}`, outside: false });
  else {
    const decade = year - (year % 10);
    for (let y = decade - 1; y <= decade + 10; y++)
      if (y >= 1 && y <= 9999) values.push({ value: pad(y, 4), outside: y < decade || y > decade + 9 });
  }
  const focused = input.focused && input.focused.length === (view === "month" ? 7 : 4) ? input.focused : null;
  const has = (v: string | null | undefined) => Boolean(v) && values.some((u) => u.value === v);
  const firstPicked = [...picked][0];
  const tabbable = [focused, firstPicked, today ? cut(today) : null].find(has) ?? values.find((u) => !u.outside)?.value ?? values[0]!.value;
  const range = input.selection.range;
  const units = values.map(({ value, outside }) => {
    const start = unitStart(value);
    const end = unitEnd(value);
    const part = bandPart(value, b.from, b.to);
    const inRange = isValue && input.mode === "range" && Boolean(range.from && range.to && value >= range.from && value <= range.to);
    const date = parse(start);
    const label = view === "month" ? formats.monthShort.format(date) : formats.year.format(date);
    return {
      value,
      label,
      ariaLabel: view === "month" ? formats.title.format(date) : label,
      outside,
      selected: picked.has(value),
      inSelection: picked.has(value) || inRange,
      range: part,
      preview: Boolean(part && b.preview),
      current: Boolean(today && cut(today) === value),
      disabled: end < min || start > max,
      tabbable: value === tabbable,
    };
  });
  const rows: UnitCell[][] = [];
  for (let i = 0; i < units.length; i += UNIT_COLUMNS) rows.push(units.slice(i, i + UNIT_COLUMNS));
  const decade = year - (year % 10);
  const title =
    view === "month"
      ? formats.year.format(parse(`${pad(year, 4)}-01-01`))
      : `${formats.year.format(parse(`${pad(Math.max(1, decade), 4)}-01-01`))} – ${formats.year.format(parse(`${pad(Math.min(9999, decade + 9), 4)}-01-01`))}`;
  const label = view === "month" ? (input.labels?.chooseMonth ?? "Choose month") : (input.labels?.chooseYear ?? "Choose year");
  return {
    view,
    title,
    weekdays: [],
    months: [],
    units: rows,
    unitsLabel: label,
    canPrevious,
    canNext,
    tabbable,
    firstMonth,
    lastMonth: firstMonth,
  };
}

/* ---------- Teclado (APG «Date Picker Dialog», rejilla) ---------- */

export interface KeyInput {
  key: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
}

/** Día al que lleva una tecla en la vista de días (`key` ya en sentido lógico: en RTL se invierten las flechas). */
export function dayKeyTarget(event: KeyInput, date: string, weekStart: number): string | null {
  const ctrl = Boolean(event.ctrlKey || event.metaKey);
  let next: string | null;
  switch (event.key) {
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
      next = ctrl ? startOfMonth(date) : startOfWeek(date, weekStart);
      break;
    case "End":
      next = ctrl ? endOfMonth(date) : addDays(startOfWeek(date, weekStart), 6);
      break;
    case "PageUp":
      next = addMonths(date, event.shiftKey ? -12 : -1);
      break;
    case "PageDown":
      next = addMonths(date, event.shiftKey ? 12 : 1);
      break;
    default:
      return null;
  }
  // Fuera de 0001–9999 (un año de cinco cifras se ordena mal como texto): se queda en el extremo.
  if (next.length !== 10 || next > LAST_DAY) return LAST_DAY;
  return next < FIRST_DAY ? FIRST_DAY : next;
}

/** Mes (`YYYY-MM`) o año (`YYYY`) al que lleva una tecla en las vistas de mes y año. */
export function unitKeyTarget(view: "month" | "year", event: KeyInput, value: string): string | null {
  const ctrl = Boolean(event.ctrlKey || event.metaKey);
  if (view === "month") {
    const index = Number(value.slice(5, 7)) - 1;
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -UNIT_COLUMNS,
      ArrowDown: UNIT_COLUMNS,
      Home: ctrl ? -index : -(index % UNIT_COLUMNS),
      End: ctrl ? 11 - index : UNIT_COLUMNS - 1 - (index % UNIT_COLUMNS),
      PageUp: event.shiftKey ? -120 : -12,
      PageDown: event.shiftKey ? 120 : 12,
    };
    const step = steps[event.key];
    if (step === undefined) return null;
    return shiftMonth(value, step);
  }
  const year = Number(value);
  const decade = year - (year % 10);
  const index = year - (decade - 1);
  const steps: Record<string, number> = {
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -UNIT_COLUMNS,
    ArrowDown: UNIT_COLUMNS,
    Home: ctrl ? -index : -(index % UNIT_COLUMNS),
    End: ctrl ? 11 - index : UNIT_COLUMNS - 1 - (index % UNIT_COLUMNS),
    PageUp: event.shiftKey ? -100 : -10,
    PageDown: event.shiftKey ? 100 : 10,
  };
  const step = steps[event.key];
  if (step === undefined) return null;
  return pad(Math.min(9999, Math.max(1, year + step)), 4);
}

/** Acota un día, mes o año a los límites (en su propia unidad). */
export function clampUnit(value: string, rules: CalendarRules): string {
  const { min, max } = bounds(rules);
  if (value.length === 10) return clampDate(value, min, max);
  const cut = (d: string) => d.slice(0, value.length);
  return value < cut(min) ? cut(min) : value > cut(max) ? cut(max) : value;
}

/** Opciones de los desplegables de mes y año de la cabecera. */
export function captionOptions(
  month: string,
  rules: CalendarRules,
  locale?: string,
): { months: { value: string; label: string; disabled: boolean }[]; years: { value: string; label: string }[] } {
  const formats = calendarFormats(locale);
  const { min, max } = bounds(rules);
  const year = Number(month.slice(0, 4));
  const months = Array.from({ length: 12 }, (_, i) => {
    const value = `${pad(year, 4)}-${pad(i + 1)}`;
    return {
      value,
      label: formats.monthLong.format(parse(`${value}-01`)),
      disabled: endOfMonth(`${value}-01`) < min || `${value}-01` > max,
    };
  });
  const lo = Math.max(1, min === FIRST_DAY ? year - 100 : Number(min.slice(0, 4)));
  const hi = Math.min(9999, max === LAST_DAY ? year + 50 : Number(max.slice(0, 4)));
  const years: { value: string; label: string }[] = [];
  for (let y = Math.min(lo, year); y <= Math.max(hi, year); y++) {
    const value = pad(y, 4);
    years.push({ value, label: formats.year.format(parse(`${value}-01-01`)) });
  }
  return { months, years };
}

/** Mes inicial: el pedido, el del valor o el de hoy acotado a los límites. */
export function initialMonth(requested: string | null | undefined, anchor: string | null, today: string, rules: CalendarRules): string {
  if (validMonth(requested)) return requested;
  if (anchor) return monthOf(unitStart(anchor));
  return monthOf(clampDate(today, bounds(rules).min, bounds(rules).max));
}

export { startOfMonth };

/** Texto de un valor para el campo de un selector: fecha, mes o año según la unidad; rango con guion; varias fechas
 *  en lista (hasta dos) o contadas con `count`. */
export function selectionText(
  mode: CalendarMode,
  selection: CalendarSelection,
  options: { locale?: string; format?: Intl.DateTimeFormatOptions; unit?: CalendarView; count?: (n: number) => string } = {},
): string {
  const unit = options.unit ?? "day";
  const base: Intl.DateTimeFormatOptions =
    unit === "month"
      ? { month: "long", year: "numeric" }
      : unit === "year"
        ? { year: "numeric" }
        : (options.format ?? { dateStyle: "medium" });
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat(safeLocale(options.locale), { ...base, timeZone: "UTC" });
  } catch {
    formatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" });
  }
  const show = (v: string) => formatter.format(parse(unitStart(v)));
  if (mode === "range") {
    const { from, to } = selection.range;
    return from ? `${show(from)} – ${to ? show(to) : "…"}` : "";
  }
  if (mode === "multiple") {
    const n = selection.multiple.length;
    if (!n) return "";
    return n <= 2 ? selection.multiple.map(show).join(", ") : (options.count?.(n) ?? `${n} dates`);
  }
  return selection.single ? show(selection.single) : "";
}
