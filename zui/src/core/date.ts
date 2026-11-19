// Aritmética de fechas del calendario. Fechas ISO `YYYY-MM-DD`, cálculo en UTC para que el día no dependa de la
// zona horaria. Sin librerías.

/** Rango de fechas ISO (`YYYY-MM-DD`). `to` es `null` mientras solo se ha elegido el inicio. */
export interface DateRange {
  from: string | null;
  to: string | null;
}

export const DAY_MS = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export const pad = (n: number, width = 2) => String(n).padStart(width, "0");
/** Fecha UTC a medianoche. `Date.UTC` toma los años 0 a 99 como 1900 a 1999; `setUTCFullYear` no. */
function utc(year: number, monthIndex: number, day: number): Date {
  const date = new Date(0);
  date.setUTCFullYear(year, monthIndex, day);
  return date;
}
export const parse = (iso: string) => utc(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
export const format = (date: Date) => `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
/** Verdadero si es una fecha ISO que existe (2026-02-30 no). */
export const valid = (iso: string | null | undefined): iso is string =>
  typeof iso === "string" && ISO_DATE.test(iso) && format(parse(iso)) === iso;
export const addDays = (iso: string, days: number) => format(new Date(parse(iso).getTime() + days * DAY_MS));
export const monthOf = (iso: string) => iso.slice(0, 7);
export const daysInMonth = (year: number, monthIndex: number) => utc(year, monthIndex + 1, 0).getUTCDate();

/** Suma meses conservando el día; si no existe (31 en un mes de 30), usa el último del mes. */
export function addMonths(iso: string, months: number): string {
  const date = parse(iso);
  const target = utc(date.getUTCFullYear(), date.getUTCMonth() + months, 1);
  const day = Math.min(date.getUTCDate(), daysInMonth(target.getUTCFullYear(), target.getUTCMonth()));
  return format(utc(target.getUTCFullYear(), target.getUTCMonth(), day));
}

/** Hoy en la zona horaria local, como fecha ISO. */
export function todayISO(): string {
  const now = new Date();
  return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** El locale si el entorno lo admite; si no, `undefined` (el del entorno). */
export function safeLocale(locale: string | undefined): string | undefined {
  try {
    return locale ? Intl.DateTimeFormat.supportedLocalesOf(locale)[0] : undefined;
  } catch {
    return undefined;
  }
}

/** Primer día de la semana según el locale (Intl.Locale.weekInfo), o lunes. 0 domingo … 6 sábado. */
export function localeWeekStart(locale?: string): number {
  try {
    const resolved = new Intl.Locale(locale ?? new Intl.DateTimeFormat().resolvedOptions().locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay?: number };
      weekInfo?: { firstDay?: number };
    };
    const first = (resolved.getWeekInfo?.() ?? resolved.weekInfo)?.firstDay;
    return typeof first === "number" ? first % 7 : 1;
  } catch {
    return 1;
  }
}

/** `desde/hasta` → rango; las fechas que no son válidas quedan en `null`. */
export function parseRange(raw: string | undefined | null): DateRange {
  const [from, to] = (raw ?? "").split("/");
  return { from: valid(from) ? from : null, to: valid(to) ? to : null };
}

/** Rango → `desde/hasta` (el valor que envía un formulario); vacío sin inicio. */
export const rangeText = (range: DateRange | null | undefined) => (range?.from ? `${range.from}/${range.to ?? ""}` : "");

/* ---------- Ampliación de la familia de fecha y hora (meses, años, semanas, preajustes) ---------- */

/** Primer y último día admitidos (años de 4 dígitos, como el `<input type="date">`). */
export const FIRST_DAY = "0001-01-01";
export const LAST_DAY = "9999-12-31";
const ISO_WEEK = /^(\d{4})-W(\d{2})$/;
const ISO_YEAR = /^\d{4}$/;

/** Verdadero si es un mes `YYYY-MM` entre 0001-01 y 9999-12. */
export const validMonth = (value: string | null | undefined): value is string =>
  typeof value === "string" && MONTH.test(value) && value >= "0001-01";
/** Verdadero si es un año `YYYY` entre 0001 y 9999. */
export const validYear = (value: string | null | undefined): value is string =>
  typeof value === "string" && ISO_YEAR.test(value) && value !== "0000";

export const addYears = (iso: string, years: number) => addMonths(iso, years * 12);
/** Día de la semana: 0 domingo … 6 sábado. */
export const weekdayOf = (iso: string) => parse(iso).getUTCDay();
/** Días de `from` a `to` (negativo si `to` es anterior). */
export const diffDays = (from: string, to: string) => Math.round((parse(to).getTime() - parse(from).getTime()) / DAY_MS);
export const startOfMonth = (iso: string) => `${iso.slice(0, 7)}-01`;
export const endOfMonth = (iso: string) =>
  `${iso.slice(0, 7)}-${pad(daysInMonth(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1))}`;
/** Primer día de la semana que contiene `iso`, con la semana empezando en `weekStart` (0 domingo). */
export const startOfWeek = (iso: string, weekStart: number) => addDays(iso, -((weekdayOf(iso) - weekStart + 7) % 7));
/** La fecha acotada a `[min, max]` (los extremos nulos no acotan). */
export function clampDate(iso: string, min?: string | null, max?: string | null): string {
  if (valid(min) && iso < min) return min;
  if (valid(max) && iso > max) return max;
  return iso;
}
/** Verdadero si la fecha cae dentro del intervalo admitido (0001-01-01 … 9999-12-31). */
export const inSupportedRange = (iso: string) => iso >= FIRST_DAY && iso <= LAST_DAY;

/** Número de semana y año al que pertenece, con primer día `firstDay` y `minimalDays` días mínimos en la semana 1.
 *  Con lunes y 4 días es la semana ISO 8601 (la regla del jueves). */
export function weekNumber(iso: string, firstDay = 1, minimalDays = 4): { year: number; week: number } {
  const start = startOfWeek(iso, firstDay);
  const end = parse(start);
  end.setUTCDate(end.getUTCDate() + 6);
  // La semana es del año de su último día si ese año tiene en ella al menos `minimalDays` días.
  const startYear = parse(start).getUTCFullYear();
  const year = end.getUTCFullYear() !== startYear && end.getUTCDate() >= minimalDays ? end.getUTCFullYear() : startYear;
  let first = startOfWeek(`${pad(year, 4)}-01-01`, firstDay);
  if (7 - diffDays(first, `${pad(year, 4)}-01-01`) < minimalDays) first = addDays(first, 7);
  return { year, week: Math.floor(diffDays(first, start) / 7) + 1 };
}

/** Semana ISO 8601 de una fecha, como `YYYY-Www` (lo que envía `<input type="week">`). */
export function isoWeekText(iso: string): string {
  const { year, week } = weekNumber(iso, 1, 4);
  return `${pad(year, 4)}-W${pad(week)}`;
}
/** Semanas ISO del año: 53 si el año empieza en jueves o es bisiesto y empieza en miércoles. */
export function weeksInYear(year: number): number {
  return weekNumber(`${pad(year, 4)}-12-28`, 1, 4).week;
}
/** `YYYY-Www` → el lunes de esa semana; `null` si no es una semana ISO que exista. */
export function weekStartOf(week: string | null | undefined): string | null {
  const match = typeof week === "string" ? ISO_WEEK.exec(week) : null;
  if (!match) return null;
  const year = Number(match[1]);
  const n = Number(match[2]);
  if (year < 1 || n < 1 || n > weeksInYear(year)) return null;
  // El 4 de enero siempre está en la semana 1.
  return addDays(startOfWeek(`${pad(year, 4)}-01-04`, 1), (n - 1) * 7);
}

/** Datos de semana del locale (Intl.Locale#getWeekInfo o weekInfo): primer día, fin de semana y días mínimos de la
 *  semana 1. Días 0 domingo … 6 sábado. Sin datos: lunes, sábado y domingo, 4 (ISO 8601). */
export function localeWeekInfo(locale?: string): { firstDay: number; weekend: number[]; minimalDays: number } {
  try {
    const resolved = new Intl.Locale(locale ?? new Intl.DateTimeFormat().resolvedOptions().locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay?: number; weekend?: number[]; minimalDays?: number };
      weekInfo?: { firstDay?: number; weekend?: number[]; minimalDays?: number };
    };
    const info = resolved.getWeekInfo?.() ?? resolved.weekInfo ?? {};
    return {
      firstDay: typeof info.firstDay === "number" ? info.firstDay % 7 : 1,
      weekend: Array.isArray(info.weekend) ? info.weekend.map((d) => d % 7) : [6, 0],
      minimalDays: typeof info.minimalDays === "number" ? info.minimalDays : 4,
    };
  } catch {
    return { firstDay: 1, weekend: [6, 0], minimalDays: 4 };
  }
}

/** Valor de fecha de entrada: cadena ISO o un objeto con `year`, `month` y `day` (p. ej. `Temporal.PlainDate`). */
export function toISODate(value: unknown): string | null {
  if (typeof value === "string") return valid(value) ? value : null;
  if (value && typeof value === "object" && "year" in value && "month" in value && "day" in value) {
    const { year, month, day } = value as { year: unknown; month: unknown; day: unknown };
    if ([year, month, day].every((n) => Number.isInteger(n))) {
      const iso = `${pad(Number(year), 4)}-${pad(Number(month))}-${pad(Number(day))}`;
      return valid(iso) ? iso : null;
    }
  }
  return null;
}

/** Preajustes de rango sin textos, relativos a `today`. La aplicación pone las etiquetas. */
export const PRESET_KEYS = [
  "today",
  "yesterday",
  "tomorrow",
  "last-7-days",
  "last-30-days",
  "next-7-days",
  "next-30-days",
  "this-week",
  "last-week",
  "next-week",
  "this-month",
  "last-month",
  "next-month",
  "this-year",
  "last-year",
] as const;
export type PresetKey = (typeof PRESET_KEYS)[number];

/** Todos los preajustes de rango para `today` (semanas desde `weekStart`, 0 domingo). */
export function rangePresets(today: string, weekStart = 1): Record<PresetKey, { from: string; to: string }> {
  const day = (n: number) => addDays(today, n);
  const week = startOfWeek(today, weekStart);
  const month = startOfMonth(today);
  const year = `${today.slice(0, 4)}-01-01`;
  const span = (from: string, to: string) => ({ from, to });
  return {
    today: span(today, today),
    yesterday: span(day(-1), day(-1)),
    tomorrow: span(day(1), day(1)),
    "last-7-days": span(day(-6), today),
    "last-30-days": span(day(-29), today),
    "next-7-days": span(today, day(6)),
    "next-30-days": span(today, day(29)),
    "this-week": span(week, addDays(week, 6)),
    "last-week": span(addDays(week, -7), addDays(week, -1)),
    "next-week": span(addDays(week, 7), addDays(week, 13)),
    "this-month": span(month, endOfMonth(month)),
    "last-month": span(addMonths(month, -1), addDays(month, -1)),
    "next-month": span(addMonths(month, 1), endOfMonth(addMonths(month, 1))),
    "this-year": span(year, `${today.slice(0, 4)}-12-31`),
    "last-year": span(addYears(year, -1), addDays(year, -1)),
  };
}

/** Resuelve el valor de un preajuste: una clave de `rangePresets`, una fecha ISO o un rango `desde/hasta`. */
export function resolvePreset(value: string, today: string, weekStart = 1): { from: string; to: string } | null {
  if ((PRESET_KEYS as readonly string[]).includes(value)) return rangePresets(today, weekStart)[value as PresetKey];
  if (valid(value)) return { from: value, to: value };
  const { from, to } = parseRange(value);
  return from && to ? (from <= to ? { from, to } : { from: to, to: from }) : null;
}

/** Rango legible con `Intl.DateTimeFormat#formatRange` («12–18 nov 2026»), sin desplazamiento de zona. */
export function formatDateRange(range: DateRange | null | undefined, locale?: string, options?: Intl.DateTimeFormatOptions): string {
  if (!range?.from) return "";
  const formatter = new Intl.DateTimeFormat(safeLocale(locale), { ...(options ?? { dateStyle: "medium" }), timeZone: "UTC" });
  if (!range.to || range.to === range.from) return formatter.format(parse(range.from));
  const [a, b] = range.from < range.to ? [range.from, range.to] : [range.to, range.from];
  return formatter.formatRange(parse(a), parse(b));
}
