// Campo de fecha y hora por segmentos (DateField, TimeField): el modelo sin DOM ni React. Cada segmento es un
// spinbutton (APG) con su valor numérico tal como se muestra (la hora en el ciclo del locale y el periodo AM/PM
// aparte). El orden y los separadores salen de `Intl.DateTimeFormat#formatToParts` (presentación); los valores se
// leen y se escriben como texto ISO civil: `YYYY-MM-DD`, `HH:mm[:ss]` o `YYYY-MM-DDTHH:mm[:ss]`, sin zona.
import { daysInMonth, pad, safeLocale, todayISO, valid as validDate } from "./date";
import {
  dayPeriods,
  formatTime,
  fromDisplayHour,
  fullTime,
  hourBounds,
  inTimeRange,
  is12h,
  localeHourCycle,
  parseTime,
  safeStep,
  toDisplayHour,
  validTime,
  type HourCycle,
} from "./time";

export type SegmentType = "year" | "month" | "day" | "hour" | "minute" | "second" | "dayPeriod";
export type Granularity = "day" | "hour" | "minute" | "second";
export type FieldKind = "date" | "datetime" | "time";

/** Pieza del campo en orden de lectura: un segmento editable o un literal (separador). */
export interface Part {
  type: SegmentType | "literal";
  text: string;
}

/** Valor de cada segmento tal como se muestra: hora en el ciclo del locale, periodo 0 (AM) o 1 (PM). */
export type Values = Partial<Record<SegmentType, number>>;

export interface FieldState {
  values: Values;
  /** Dígitos tecleados en el segmento activo; se vacía al cambiar de segmento. */
  typed: { type: SegmentType; text: string } | null;
}

export interface FieldOptions {
  locale?: string;
  /** Solo hora (TimeField). */
  time?: boolean;
  /** Segmento más fino: `day` (solo fecha), `hour`, `minute` o `second`. */
  granularity?: Granularity;
  /** 12 o 24 h; por defecto, el ciclo del locale. */
  hourCycle?: 12 | 24;
  minuteStep?: number;
  secondStep?: number;
  min?: string | null;
  max?: string | null;
  /** Valor que siembran las flechas en un segmento vacío. Por defecto, hoy a las 00:00. */
  placeholderValue?: string | null;
  /** Mes, día y hora con dos cifras (por defecto). Año, minuto y segundo siempre van rellenos. */
  forceLeadingZeros?: boolean;
}

export interface FieldConfig {
  locale: string | undefined;
  kind: FieldKind;
  granularity: Granularity;
  cycle: HourCycle;
  parts: Part[];
  /** Segmentos editables en orden de lectura. */
  types: SegmentType[];
  minuteStep: number;
  secondStep: number;
  /** Límites normalizados: fecha, fecha-hora con segundos u hora con segundos. */
  min: string | null;
  max: string | null;
  seed: Values;
  leadingZeros: boolean;
  periods: [string, string];
  /** Número con los dígitos del locale y `width` cifras. */
  digits: (n: number, width: number) => string;
  monthName: (month: number) => string;
}

export type Validity = "empty" | "incomplete" | "invalid" | "outOfRange" | "valid";

/** Nombre accesible de cada segmento (inglés por defecto; las aplicaciones pasan el suyo). */
export const SEGMENT_LABELS: Record<SegmentType, string> = {
  year: "Year",
  month: "Month",
  day: "Day",
  hour: "Hour",
  minute: "Minute",
  second: "Second",
  dayPeriod: "AM/PM",
};

/** Texto visible de un segmento vacío. */
export const SEGMENT_PLACEHOLDERS: Record<SegmentType, string> = {
  year: "yyyy",
  month: "mm",
  day: "dd",
  hour: "––",
  minute: "––",
  second: "––",
  dayPeriod: "––",
};

/** Textos por defecto (inglés) del grupo y de los mensajes de validación, para fecha y para hora. */
export const FIELD_TEXTS = {
  date: {
    group: "Date",
    incomplete: "Enter a complete date.",
    invalid: "Enter a date that exists.",
    range: "Enter a date within the allowed range.",
  },
  time: {
    group: "Time",
    incomplete: "Enter a complete time.",
    invalid: "Enter a valid time.",
    range: "Enter a time within the allowed range.",
  },
} as const;

const DATE_TYPES: SegmentType[] = ["year", "month", "day"];
const LITERAL_MARKS = /[‎‏؜]/g;

/** Piezas en el orden del locale. Si `Intl` no da algún segmento, se usa el orden ISO. */
function layout(locale: string | undefined, kind: FieldKind, granularity: Granularity, cycle: HourCycle): Part[] {
  const wanted: SegmentType[] = [];
  const options: Intl.DateTimeFormatOptions = { timeZone: "UTC", calendar: "gregory" };
  if (kind !== "time") {
    Object.assign(options, { year: "numeric", month: "2-digit", day: "2-digit" });
    wanted.push(...DATE_TYPES);
  }
  if (kind !== "date") {
    Object.assign(options, { hour: "2-digit", hourCycle: cycle });
    wanted.push("hour");
    if (granularity !== "hour") {
      options.minute = "2-digit";
      wanted.push("minute");
    }
    if (granularity === "second") {
      options.second = "2-digit";
      wanted.push("second");
    }
    if (is12h(cycle)) wanted.push("dayPeriod");
  }
  const parts: Part[] = [];
  try {
    for (const part of new Intl.DateTimeFormat(locale, options).formatToParts(new Date(Date.UTC(2000, 10, 22, 13, 44, 55)))) {
      const type = part.type as string;
      if (type === "literal") {
        const text = part.value.replace(LITERAL_MARKS, "");
        const last = parts.at(-1);
        if (!text) continue;
        if (last?.type === "literal") last.text += text;
        else parts.push({ type: "literal", text });
      } else if ((wanted as string[]).includes(type) && !parts.some((p) => p.type === type))
        parts.push({ type: type as SegmentType, text: "" });
    }
  } catch {
    parts.length = 0;
  }
  if (wanted.every((type) => parts.some((p) => p.type === type))) {
    // Un literal al principio o al final (p. ej. «2026. 11. 13.» en coreano) se conserva; dos seguidos ya se unieron.
    return parts;
  }
  // Orden ISO de reserva: año-mes-día hora:minuto:segundo periodo.
  const fallback: Part[] = [];
  wanted.forEach((type, i) => {
    if (i > 0) {
      const prev = wanted[i - 1]!;
      const text = DATE_TYPES.includes(type) ? "-" : DATE_TYPES.includes(prev) ? " " : type === "dayPeriod" ? " " : ":";
      fallback.push({ type: "literal", text });
    }
    fallback.push({ type, text: "" });
  });
  return fallback;
}

const cache = new Map<string, FieldConfig>();

/** Configuración resuelta de un campo: orden de segmentos, ciclo horario, límites y siembra. */
export function fieldConfig(options: FieldOptions = {}): FieldConfig {
  const today = todayISO();
  // La siembra por defecto es hoy: el día forma parte de la clave.
  const key = `${today}|${JSON.stringify(options)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const locale = safeLocale(options.locale);
  const granularity: Granularity = options.time
    ? options.granularity === "second" || options.granularity === "hour"
      ? options.granularity
      : "minute"
    : (options.granularity ?? "day");
  const kind: FieldKind = options.time ? "time" : granularity === "day" ? "date" : "datetime";
  const cycle = localeHourCycle(locale, options.hourCycle);
  const parts = layout(locale, kind, granularity, cycle);
  let numbers: Intl.NumberFormat;
  try {
    numbers = new Intl.NumberFormat(locale, { useGrouping: false });
  } catch {
    numbers = new Intl.NumberFormat(undefined, { useGrouping: false });
  }
  const zero = numbers.format(0);
  let months: Intl.DateTimeFormat | null = null;
  try {
    months = new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC", calendar: "gregory" });
  } catch {
    months = null;
  }
  const config: FieldConfig = {
    locale,
    kind,
    granularity,
    cycle,
    parts,
    types: parts.filter((p) => p.type !== "literal").map((p) => p.type as SegmentType),
    minuteStep: safeStep(options.minuteStep),
    secondStep: safeStep(options.secondStep),
    min: normalizeBound(options.min, kind, "min"),
    max: normalizeBound(options.max, kind, "max"),
    seed: {},
    leadingZeros: options.forceLeadingZeros !== false,
    periods: dayPeriods(locale),
    digits: (n, width) => {
      const text = numbers.format(n);
      return text.length >= width ? text : zero.repeat(width - text.length) + text;
    },
    monthName: (month) => (months ? months.format(new Date(Date.UTC(2000, month - 1, 1))) : String(month)),
  };
  const seed = options.placeholderValue ?? null;
  config.seed = { ...valuesFrom(`${today}T00:00:00`, { ...config, kind: "datetime" }), ...valuesFrom(seed, config) };
  if (cache.size > 200) cache.clear();
  cache.set(key, config);
  return config;
}

/** Límite en la forma con la que se compara: fecha, `YYYY-MM-DDTHH:mm:ss` u `HH:mm:ss`. */
function normalizeBound(raw: string | null | undefined, kind: FieldKind, side: "min" | "max"): string | null {
  if (typeof raw !== "string" || !raw) return null;
  if (kind === "time") return validTime(raw) ? fullTime(raw) : null;
  const [date, time] = splitIso(raw);
  if (!validDate(date)) return null;
  if (kind === "date") return date;
  if (time === null) return `${date}T${side === "min" ? "00:00:00" : "23:59:59"}`;
  return validTime(time) ? `${date}T${fullTime(time)}` : null;
}

/** `YYYY-MM-DD[THH:mm[:ss]]` (también con espacio) → [fecha, hora o null]. */
function splitIso(value: string): [string, string | null] {
  const match = /^(\d{4}-\d{2}-\d{2})(?:[T ](.+))?$/.exec(value.trim());
  return match ? [match[1]!, match[2] ?? null] : ["", null];
}

/** Valor ISO → valores de los segmentos del campo. Lo que no se entiende, vacío. */
export function valuesFrom(value: string | null | undefined, config: FieldConfig): Values {
  const out: Values = {};
  if (typeof value !== "string" || !value) return out;
  let date = "";
  let time: string | null = null;
  if (config.kind === "time") time = value.trim();
  else [date, time] = splitIso(value);
  if (validDate(date)) {
    out.year = Number(date.slice(0, 4));
    out.month = Number(date.slice(5, 7));
    out.day = Number(date.slice(8, 10));
  }
  const parts = parseTime(time);
  if (parts) {
    const shown = toDisplayHour(parts.hour, config.cycle);
    out.hour = shown.hour;
    out.dayPeriod = shown.period;
    out.minute = parts.minute;
    out.second = parts.second;
  }
  const kept: Values = {};
  for (const type of config.types) if (out[type] !== undefined) kept[type] = out[type];
  return kept;
}

/** Mínimo y máximo de un segmento. Al teclear, el día admite hasta 31 (el 31 de febrero se marca al salir). */
export function bounds(type: SegmentType, values: Values, config: FieldConfig, typing = false): [number, number] {
  switch (type) {
    case "year":
      return [1, 9999];
    case "month":
      return [1, 12];
    case "day": {
      if (typing || values.month === undefined) return [1, 31];
      // Sin año, febrero admite el 29 (un año bisiesto).
      return [1, daysInMonth(values.year ?? 2000, values.month - 1)];
    }
    case "hour":
      return hourBounds(config.cycle);
    case "dayPeriod":
      return [0, 1];
    default:
      return [0, 59];
  }
}

const maxDigits = (type: SegmentType) => (type === "year" ? 4 : type === "dayPeriod" ? 0 : 2);

/** Texto visible de un segmento (dígitos del locale), o null si está vacío. */
export function segmentText(type: SegmentType, state: FieldState, config: FieldConfig): string | null {
  if (state.typed?.type === type && state.typed.text) return [...state.typed.text].map((d) => config.digits(Number(d), 1)).join("");
  const value = state.values[type];
  if (value === undefined) return null;
  if (type === "dayPeriod") return config.periods[value] ?? null;
  const width = type === "year" ? 4 : type === "minute" || type === "second" || config.leadingZeros ? 2 : 1;
  return config.digits(value, width);
}

/** Texto que anuncia el lector de pantalla (`aria-valuetext`): el visible y, en el mes, su nombre. */
export function segmentValueText(type: SegmentType, state: FieldState, config: FieldConfig): string | null {
  const text = segmentText(type, state, config);
  const value = state.values[type];
  if (text === null || value === undefined) return text;
  if (type === "month") return `${text} – ${config.monthName(value)}`;
  if (type === "hour" && is12h(config.cycle) && state.values.dayPeriod !== undefined)
    return `${text} ${config.periods[state.values.dayPeriod]}`;
  return text;
}

/** Verdadero si no hay ningún segmento con valor. */
export const isEmpty = (values: Values) => Object.values(values).every((v) => v === undefined);

/** Verdadero si todos los segmentos del campo tienen valor. */
export const isComplete = (values: Values, config: FieldConfig) => config.types.every((type) => values[type] !== undefined);

/** Valor ISO del campo, o null si falta algún segmento o la fecha no existe (31 de febrero). */
export function fieldValue(values: Values, config: FieldConfig): string | null {
  if (!isComplete(values, config)) return null;
  let date = "";
  if (config.kind !== "time") {
    date = `${pad(values.year!, 4)}-${pad(values.month!)}-${pad(values.day!)}`;
    if (!validDate(date)) return null;
    if (config.kind === "date") return date;
  }
  const time = formatTime(
    {
      hour: fromDisplayHour(values.hour!, values.dayPeriod, config.cycle),
      minute: config.granularity === "hour" ? 0 : values.minute!,
      second: config.granularity === "second" ? values.second! : 0,
    },
    config.granularity === "second",
  );
  return config.kind === "time" ? time : `${date}T${time}`;
}

/** Verdadero si el valor ISO completo respeta `min` y `max`. En TimeField la franja puede cruzar la medianoche. */
export function inBounds(value: string, config: FieldConfig): boolean {
  if (config.kind === "time") return inTimeRange(value, config.min, config.max);
  const comparable = config.kind === "date" ? value : `${value.slice(0, 10)}T${fullTime(value.slice(11))}`;
  return (!config.min || comparable >= config.min) && (!config.max || comparable <= config.max);
}

/**
 * Estado de validez: vacío, incompleto (algún segmento sin valor), inválido (la fecha no existe), fuera de
 * `min`/`max` o válido.
 */
export function validity(values: Values, config: FieldConfig): Validity {
  if (isEmpty(values)) return "empty";
  if (!isComplete(values, config)) return "incomplete";
  const value = fieldValue(values, config);
  if (value === null) return "invalid";
  return inBounds(value, config) ? "valid" : "outOfRange";
}

/* ---------- Teclado ---------- */

export interface KeyOutcome {
  state: FieldState;
  /** El foco pasa al segmento anterior o al siguiente. */
  focus?: "prev" | "next";
  /** La tecla es del campo: el adaptador cancela su acción por defecto. */
  handled: boolean;
}

const BIG_STEP: Record<SegmentType, number> = { year: 10, month: 3, day: 7, hour: 2, minute: 15, second: 15, dayPeriod: 1 };

/** Paso de las flechas en el segmento. */
const stepOf = (type: SegmentType, config: FieldConfig) =>
  type === "minute" ? config.minuteStep : type === "second" ? config.secondStep : 1;

/** Suma `delta` (múltiplo del paso) con vuelta al otro extremo, sobre los valores alineados al paso. */
function cycleValue(current: number, delta: number, lo: number, hi: number, step: number): number {
  if (step > 1) {
    const count = Math.floor((hi - lo) / step) + 1;
    const index = Math.floor((current - lo) / step);
    // Un valor fuera del paso (07 con paso 5) baja primero a su múltiplo (05) y sube al siguiente (10).
    const from = delta < 0 && (current - lo) % step !== 0 ? index + 1 : index;
    const next = (((from + delta / step) % count) + count) % count;
    return lo + next * step;
  }
  const size = hi - lo + 1;
  return ((((current - lo + delta) % size) + size) % size) + lo;
}

/** Valor sembrado en un segmento vacío: el de `placeholderValue` (u hoy a las 00:00), dentro de sus límites. */
function seedValue(type: SegmentType, values: Values, config: FieldConfig): number {
  const [lo, hi] = bounds(type, values, config);
  let value = config.seed[type] ?? lo;
  if (type === "hour" && config.seed.hour === undefined) value = hourBounds(config.cycle)[0];
  const step = stepOf(type, config);
  value = Math.min(hi, Math.max(lo, value));
  return step > 1 ? Math.floor(value / step) * step : value;
}

/** Flechas, RePág/AvPág e Inicio/Fin sobre un segmento. */
function stepSegment(state: FieldState, type: SegmentType, key: string, config: FieldConfig): FieldState {
  const values = { ...state.values };
  const [lo, hi] = bounds(type, values, config);
  const current = values[type];
  const step = stepOf(type, config);
  if (key === "Home") values[type] = lo;
  else if (key === "End") values[type] = step > 1 ? lo + Math.floor((hi - lo) / step) * step : hi;
  else if (current === undefined) values[type] = seedValue(type, values, config);
  else {
    const big = type === "dayPeriod" ? 1 : Math.max(step, Math.ceil(BIG_STEP[type] / step) * step);
    const delta = { ArrowUp: step, ArrowDown: -step, PageUp: big, PageDown: -big }[key] ?? 0;
    values[type] = cycleValue(Math.min(hi, current), delta, lo, hi, type === "dayPeriod" ? 1 : step);
  }
  return { values, typed: null };
}

/** Dígito de cualquier sistema de numeración (latino, árabe, devanagari, de ancho completo…) o null. */
export function digitOf(key: string): number | null {
  if (typeof key !== "string" || key.length !== 1) return null;
  if (key >= "0" && key <= "9") return key.charCodeAt(0) - 48;
  const code = key.charCodeAt(0);
  for (const zero of [0x660, 0x6f0, 0x7c0, 0x966, 0x9e6, 0xa66, 0xae6, 0xb66, 0xbe6, 0xc66, 0xce6, 0xd66, 0xe50, 0xed0, 0xff10])
    if (code >= zero && code <= zero + 9) return code - zero;
  return null;
}

/** Un dígito en el segmento: escribe, y pasa al siguiente cuando el segmento está completo o no cabe otra cifra. */
function typeDigit(state: FieldState, type: SegmentType, digit: number, config: FieldConfig): KeyOutcome {
  if (type === "dayPeriod") return { state, handled: true };
  const [lo, hi] = bounds(type, state.values, config, true);
  const limit = maxDigits(type);
  const previous = state.typed?.type === type ? state.typed.text : "";
  let text = previous + String(digit);
  if (text.length > limit || Number(text) > hi) text = String(digit);
  const n = Number(text);
  // Una cifra que completaría un valor imposible (00 en el mes) no se escribe.
  if (text.length >= limit && n < lo) return { state, handled: true };
  const values = { ...state.values };
  if (n >= lo && n <= hi) values[type] = n;
  else delete values[type];
  const full = text.length >= limit || n * 10 > hi;
  if (full && values[type] !== undefined) return { state: { values, typed: null }, focus: "next", handled: true };
  return { state: { values, typed: { type, text } }, handled: true };
}

/** Letras que eligen AM y PM: la inicial de cada texto del locale, y además `a` y `p`. */
function periodFor(key: string, config: FieldConfig): 0 | 1 | null {
  const k = key.normalize("NFD").toLowerCase();
  const initial = (text: string) =>
    text
      .normalize("NFD")
      .toLowerCase()
      .replace(/[^\p{L}]/gu, "")[0];
  const [am, pm] = [initial(config.periods[0]), initial(config.periods[1])];
  if (am !== pm) {
    if (k === am) return 0;
    if (k === pm) return 1;
  }
  return k === "a" ? 0 : k === "p" ? 1 : null;
}

/**
 * Tecla en un segmento (`key` ya reflejada en RTL con `logicalKey`). Sin modificadores: el adaptador deja pasar
 * Ctrl, Cmd y Alt (atajos, Alt+Flecha abajo de un selector).
 */
export function segmentKey(state: FieldState, type: SegmentType, key: string, config: FieldConfig, readOnly = false): KeyOutcome {
  if (key === "ArrowLeft") return { state: { ...state, typed: null }, focus: "prev", handled: true };
  if (key === "ArrowRight") return { state: { ...state, typed: null }, focus: "next", handled: true };
  if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(key))
    return { state: readOnly ? state : stepSegment(state, type, key, config), handled: true };
  if (key === "Backspace" || key === "Delete") {
    const filled = state.values[type] !== undefined || (state.typed?.type === type && state.typed.text !== "");
    if (filled && !readOnly) {
      const values = { ...state.values };
      delete values[type];
      return { state: { values, typed: null }, handled: true };
    }
    return { state, focus: key === "Backspace" && !filled ? "prev" : undefined, handled: true };
  }
  if (readOnly) return { state, handled: key.length === 1 };
  const digit = digitOf(key);
  if (digit !== null) return typeDigit(state, type, digit, config);
  if (type === "dayPeriod" && key.length === 1) {
    const period = periodFor(key, config);
    if (period === null) return { state, handled: true };
    return { state: { values: { ...state.values, dayPeriod: period }, typed: null }, focus: "next", handled: true };
  }
  // Cualquier otro carácter no se escribe en el segmento.
  return { state, handled: key.length === 1 };
}

/* ---------- Pegar ---------- */

/** Cambia los dígitos de otros sistemas de numeración por los latinos. */
const latinDigits = (text: string) => [...text].map((ch) => digitOf(ch) ?? ch).join("");

/**
 * Texto pegado → valores de los segmentos que contiene (fecha, hora o las dos), o null si no se entiende o la fecha
 * no existe. Acepta ISO (`2026-11-13`, `2026-11-13T09:30`, `09:30`) y el formato del locale (`11/13/2026`,
 * `13/11/2026 9:30`, `9:30 PM`).
 */
export function parsePasted(raw: string, config: FieldConfig): Values | null {
  const text = latinDigits(String(raw ?? "")).trim();
  if (!text) return null;
  const fold = (s: string) =>
    s
      .normalize("NFD")
      .toLowerCase()
      .replace(/[^\p{L}]/gu, "");
  const iso = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}(?::\d{2})?))?$/.exec(text);
  const isoTime = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(text);
  let date: string | null = null;
  let time: { hour: number; minute: number; second: number } | null = null;
  if (iso) {
    date = iso[1]!;
    if (iso[2]) time = parseTime(iso[2]);
    if (!validDate(date) || (iso[2] && !time)) return null;
  } else if (isoTime) {
    time = { hour: Number(isoTime[1]), minute: Number(isoTime[2]), second: Number(isoTime[3] ?? 0) };
  } else {
    // Formato del locale: los números en el orden de los segmentos y, si aparece, el texto de AM o PM.
    const numbers = [...text.matchAll(/\d+/g)].map((m) => m[0]);
    const words = fold(text.replace(/\d+/g, " "));
    const [am, pm] = config.periods.map(fold);
    const period =
      pm && words.includes(pm)
        ? 1
        : am && words.includes(am)
          ? 0
          : /p/.test(words) && /m/.test(words)
            ? 1
            : /a/.test(words) && /m/.test(words)
              ? 0
              : null;
    const order = config.types.filter((t) => t !== "dayPeriod");
    const dateOrder = order.filter((t) => DATE_TYPES.includes(t));
    const timeOrder: SegmentType[] = ["hour", "minute", "second"];
    const read: Values = {};
    let i = 0;
    if (config.kind !== "time") {
      if (numbers.length < 3) return null;
      for (const type of dateOrder) read[type] = Number(numbers[i++]);
      date = `${pad(read.year!, 4)}-${pad(read.month!)}-${pad(read.day!)}`;
      if (numbers[dateOrder.indexOf("year")]!.length > 4 || !validDate(date)) return null;
    }
    if (config.kind !== "date" && i < numbers.length) {
      const [h, m = "0", s = "0"] = timeOrder.map((_, k) => numbers[i + k]);
      if (h === undefined) return null;
      let hour = Number(h);
      if (period !== null) {
        if (hour < 1 || hour > 12) return null;
        hour = (hour % 12) + (period ? 12 : 0);
      }
      time = { hour, minute: Number(m), second: Number(s) };
    } else if (config.kind === "time") return null;
  }
  if (time && (time.hour > 23 || time.minute > 59 || time.second > 59)) return null;
  if (config.kind === "time" && !time) return null;
  if (config.kind !== "time" && !date) return null;
  const iso8601 = config.kind === "time" ? formatTime(time!, true) : time ? `${date}T${formatTime(time, true)}` : date!;
  const values = valuesFrom(iso8601, config.kind === "time" ? config : { ...config, kind: time ? "datetime" : "date" });
  // Una fecha pegada en un campo con hora rellena la fecha y deja la hora como estaba.
  const kept: Values = {};
  for (const type of config.types) if (values[type] !== undefined) kept[type] = values[type];
  return Object.keys(kept).length ? kept : null;
}

/** Índice del segmento que recibe el foco al pulsar en el campo: el primero vacío o el primero. */
export function firstEditable(values: Values, config: FieldConfig): number {
  const index = config.types.findIndex((type) => values[type] === undefined);
  return Math.max(index, 0);
}
