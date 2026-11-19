// Horas de reloj civiles: `HH:mm` o `HH:mm:ss`, siempre en 24 h en el valor (12 h es solo presentación). Sin
// zona: es lo que marca un reloj, como `Temporal.PlainTime`. Los campos se leen del texto ISO; `Intl` solo da la
// presentación (ciclo horario del locale, AM/PM, etiquetas). La usan TimeField, TimePicker y DateField con hora.

/** Ciclo horario de `Intl`: h11 (0–11), h12 (1–12), h23 (0–23), h24 (1–24). */
export type HourCycle = "h11" | "h12" | "h23" | "h24";

export interface TimeParts {
  hour: number;
  minute: number;
  second: number;
}

const TIME = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

/** Verdadero si es una hora `HH:mm` o `HH:mm:ss` que existe. */
export const validTime = (time: string | null | undefined): time is string => typeof time === "string" && TIME.test(time);

const two = (n: number) => String(n).padStart(2, "0");

/** `HH:mm[:ss]` → partes, o null. */
export function parseTime(time: string | null | undefined): TimeParts | null {
  const m = typeof time === "string" ? TIME.exec(time) : null;
  return m ? { hour: Number(m[1]), minute: Number(m[2]), second: Number(m[3] ?? 0) } : null;
}

/** Partes → `HH:mm`, o `HH:mm:ss` con `seconds`. */
export const formatTime = ({ hour, minute, second }: TimeParts, seconds = false) =>
  `${two(hour)}:${two(minute)}${seconds ? `:${two(second)}` : ""}`;

/** `HH:mm` → `HH:mm:ss`: la forma con la que se comparan dos horas como texto. */
export const fullTime = (time: string) => (time.length === 5 ? `${time}:00` : time);

/**
 * Verdadero si `time` cae entre `min` y `max`, incluidos. Con `min > max` la franja cruza la medianoche
 * (`22:00`–`02:00` admite 23:30 y 01:00). Sin límites, siempre.
 */
export function inTimeRange(time: string, min?: string | null, max?: string | null): boolean {
  const t = fullTime(time);
  const lo = validTime(min) ? fullTime(min) : null;
  const hi = validTime(max) ? fullTime(max) : null;
  if (lo && hi && lo > hi) return t >= lo || t <= hi;
  return (!lo || t >= lo) && (!hi || t <= hi);
}

/** Ciclo horario: el del locale o, con `prefer`, su variante de 12 o 24 h (h11/h12, h23/h24). */
export function localeHourCycle(locale?: string, prefer?: 12 | 24): HourCycle {
  try {
    const options: Intl.DateTimeFormatOptions = { hour: "numeric", timeZone: "UTC" };
    if (prefer) options.hour12 = prefer === 12;
    const cycle = new Intl.DateTimeFormat(locale, options).resolvedOptions().hourCycle;
    if (cycle === "h11" || cycle === "h12" || cycle === "h23" || cycle === "h24") return cycle;
  } catch {
    // Locale no admitido: se usa el ciclo pedido o 24 h.
  }
  return prefer === 12 ? "h12" : "h23";
}

export const is12h = (cycle: HourCycle) => cycle === "h11" || cycle === "h12";

/** Primera y última hora que se muestran en el ciclo. */
export function hourBounds(cycle: HourCycle): [number, number] {
  return cycle === "h11" ? [0, 11] : cycle === "h12" ? [1, 12] : cycle === "h23" ? [0, 23] : [1, 24];
}

/** Hora de 0 a 23 → la que se muestra en el ciclo, y el periodo (0 AM, 1 PM). */
export function toDisplayHour(hour: number, cycle: HourCycle): { hour: number; period: 0 | 1 } {
  const period = hour >= 12 ? 1 : 0;
  if (cycle === "h11") return { hour: hour % 12, period };
  if (cycle === "h12") return { hour: hour % 12 || 12, period };
  if (cycle === "h24") return { hour: hour || 24, period };
  return { hour, period };
}

/** Hora mostrada en el ciclo (y periodo en 12 h) → hora de 0 a 23. 12 AM es 00; 24 en h24 es 00. */
export function fromDisplayHour(hour: number, period: number | undefined, cycle: HourCycle): number {
  if (is12h(cycle)) return (hour % 12) + (period ? 12 : 0);
  return hour % 24;
}

/** Textos de AM y PM del locale (`Intl`), o `AM`/`PM`. */
export function dayPeriods(locale?: string): [string, string] {
  const at = (hour: number) => {
    try {
      return (
        new Intl.DateTimeFormat(locale, { hour: "numeric", hourCycle: "h12", timeZone: "UTC" })
          .formatToParts(new Date(Date.UTC(2000, 0, 1, hour)))
          .find((p) => p.type === "dayPeriod")?.value ?? ""
      );
    } catch {
      return "";
    }
  };
  return [at(1) || "AM", at(13) || "PM"];
}

/** Etiqueta de una hora en el locale y el ciclo (`9:30 AM`, `09:30`). */
export function timeLabel(time: string, locale: string | undefined, cycle: HourCycle, seconds = false): string {
  const parts = parseTime(time);
  if (!parts) return time;
  const date = new Date(Date.UTC(2000, 0, 1, parts.hour, parts.minute, parts.second));
  try {
    return new Intl.DateTimeFormat(locale, {
      // En 24 h la hora va con dos cifras (09:30); en 12 h, sin relleno (9:30 AM).
      hour: is12h(cycle) ? "numeric" : "2-digit",
      minute: "2-digit",
      ...(seconds ? { second: "2-digit" as const } : {}),
      hourCycle: cycle,
      timeZone: "UTC",
    }).format(date);
  } catch {
    return formatTime(parts, seconds);
  }
}

/** Hora local del dispositivo, como `HH:mm` (o `HH:mm:ss`). */
export function nowTime(seconds = false, now: Date = new Date()): string {
  return formatTime({ hour: now.getHours(), minute: now.getMinutes(), second: now.getSeconds() }, seconds);
}

/** Paso válido (entero de 1 a 60) o 1. */
export const safeStep = (step: unknown) => {
  const n = Number(step);
  return Number.isInteger(n) && n >= 1 && n <= 60 ? n : 1;
};

/** Múltiplos de `step` entre 0 y 59 (minutos o segundos). */
export const stepValues = (step: number) => Array.from({ length: Math.ceil(60 / safeStep(step)) }, (_, i) => i * safeStep(step));

/**
 * Franjas de `step` minutos (`HH:mm`) dentro de `min`–`max`. La cuenta empieza en `min` (o en 00:00) y, si la franja
 * cruza la medianoche, sigue tras las 00:00. Un paso que no divide el día no repite franjas.
 */
export function timeSlots(step: number, min?: string | null, max?: string | null): string[] {
  const minutes = Math.max(1, Math.min(24 * 60, Math.floor(Number(step)) || 30));
  const lo = parseTime(min);
  const start = lo ? lo.hour * 60 + lo.minute + (lo.second ? 1 : 0) : 0;
  const slots: string[] = [];
  for (let offset = 0; offset < 24 * 60; offset += minutes) {
    const total = (start + offset) % (24 * 60);
    const time = formatTime({ hour: Math.floor(total / 60), minute: total % 60, second: 0 });
    if (inTimeRange(time, min, max)) slots.push(time);
  }
  return slots;
}

/* ---------- Selector en columnas (TimePicker) ---------- */

export type ColumnType = "hour" | "minute" | "second" | "dayPeriod";

export interface ColumnOption {
  value: number;
  label: string;
  disabled: boolean;
}

export interface TimeColumn {
  type: ColumnType;
  options: ColumnOption[];
  /** Valor elegido en la columna (hora mostrada en el ciclo, minuto, segundo o periodo), o null. */
  selected: number | null;
}

export interface ColumnsOptions {
  value: string | null;
  cycle: HourCycle;
  seconds?: boolean;
  minuteStep?: number;
  secondStep?: number;
  min?: string | null;
  max?: string | null;
  isTimeDisabled?: (time: string) => boolean;
  /** Número con los dígitos y el relleno de la presentación. */
  digits?: (n: number, width: number) => string;
  periods?: [string, string];
}

/** Columnas de horas, minutos, (segundos) y (AM/PM) con su opción elegida y las que no se pueden elegir. */
export function timeColumns(options: ColumnsOptions): TimeColumn[] {
  const { cycle, seconds = false, min, max, isTimeDisabled } = options;
  const digits = options.digits ?? ((n: number, width: number) => String(n).padStart(width, "0"));
  const periods = options.periods ?? ["AM", "PM"];
  const current = parseTime(options.value);
  const shown = current ? toDisplayHour(current.hour, cycle) : null;
  const minutes = stepValues(options.minuteStep ?? 1);
  const secs = seconds ? stepValues(options.secondStep ?? 1) : [0];
  const allowed = (hour: number, minute: number, second: number) => {
    const time = formatTime({ hour, minute, second }, seconds);
    return inTimeRange(time, min, max) && !isTimeDisabled?.(time);
  };
  const anyIn = (hour: number) => minutes.some((m) => secs.some((s) => allowed(hour, m, s)));
  const [lo, hi] = hourBounds(cycle);
  // En 12 h, las horas se ordenan como en un reloj: 12, 1, 2… 11.
  const hours = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  if (cycle === "h12") hours.unshift(hours.pop()!);
  const period = shown?.period ?? 0;
  const columns: TimeColumn[] = [
    {
      type: "hour",
      selected: shown?.hour ?? null,
      options: hours.map((h) => ({
        value: h,
        label: digits(h, 2),
        // Sin periodo elegido en 12 h, la hora vale si vale en alguna de las dos mitades.
        disabled:
          is12h(cycle) && !current
            ? !anyIn(fromDisplayHour(h, 0, cycle)) && !anyIn(fromDisplayHour(h, 1, cycle))
            : !anyIn(fromDisplayHour(h, period, cycle)),
      })),
    },
    {
      type: "minute",
      selected: current?.minute ?? null,
      options: minutes.map((m) => ({
        value: m,
        label: digits(m, 2),
        disabled: current ? !secs.some((s) => allowed(current.hour, m, s)) : false,
      })),
    },
  ];
  if (seconds)
    columns.push({
      type: "second",
      selected: current?.second ?? null,
      options: secs.map((s) => ({ value: s, label: digits(s, 2), disabled: current ? !allowed(current.hour, current.minute, s) : false })),
    });
  if (is12h(cycle))
    columns.push({
      type: "dayPeriod",
      selected: current ? toDisplayHour(current.hour, cycle).period : null,
      options: [0, 1].map((p) => ({
        value: p,
        label: periods[p]!,
        disabled: !hours.some((h) => anyIn(fromDisplayHour(h, p, cycle))),
      })),
    });
  return columns;
}

/**
 * Hora que resulta de elegir `option` en la columna `type` partiendo de `value`. Sin valor, el resto de campos sale
 * de `seed` (por defecto 00:00:00, es decir, 12 AM).
 */
export function pickColumn(
  value: string | null,
  type: ColumnType,
  option: number,
  cycle: HourCycle,
  seconds = false,
  seed: string | null = null,
): string {
  const base = parseTime(value) ?? parseTime(seed) ?? { hour: 0, minute: 0, second: 0 };
  const shown = toDisplayHour(base.hour, cycle);
  const next = { ...base };
  if (type === "hour") next.hour = fromDisplayHour(option, shown.period, cycle);
  else if (type === "dayPeriod") next.hour = fromDisplayHour(shown.hour, option, cycle);
  else if (type === "minute") next.minute = option;
  else next.second = option;
  return formatTime(next, seconds);
}

/** Texto para filtrar franjas: solo letras y dígitos, sin acentos ni mayúsculas (`9:30 a. m.` → `930am`). */
export const slotKey = (text: string) =>
  text
    .normalize("NFD")
    .toLowerCase()
    .replace(/[^0-9a-z]/g, "");

/** Verdadero si la franja (`HH:mm` y su etiqueta) empieza por lo tecleado, en 12 h o en 24 h. */
export function slotMatches(time: string, label: string, query: string): boolean {
  const q = slotKey(query);
  if (!q) return true;
  const parts = parseTime(time);
  const h24 = parts ? `${parts.hour}${two(parts.minute)}` : "";
  return slotKey(label).startsWith(q) || slotKey(time).startsWith(q) || h24.startsWith(q);
}

/** Desplaza una lista para que `option` quede a la vista, sin mover la página. */
export function revealOption(list: HTMLElement, option: HTMLElement, center = false): void {
  const top = option.offsetTop - list.clientTop;
  const bottom = top + option.offsetHeight;
  if (center) list.scrollTop = Math.max(0, top - (list.clientHeight - option.offsetHeight) / 2);
  else if (top < list.scrollTop) list.scrollTop = top;
  else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
}
