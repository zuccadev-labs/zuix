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
