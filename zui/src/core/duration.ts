// Duraciones: lectura de ISO 8601 (`P1DT2H30M`), de milisegundos o de partes; reparto entre unidades; escritura en
// ISO para máquinas y texto legible para personas con `Intl.DurationFormat` (y un respaldo con unidades de
// `Intl.NumberFormat` donde falte). Solo unidades de duración fija (semanas, días, horas, minutos, segundos): meses y
// años dependen del calendario y no caben en una duración sin fecha de referencia. Puro y sin documento.

export const DURATION_UNITS = ["weeks", "days", "hours", "minutes", "seconds"] as const;
export type DurationUnit = (typeof DURATION_UNITS)[number];
export type DurationParts = Partial<Record<DurationUnit | "milliseconds", number>>;
export type DurationStyle = "long" | "short" | "narrow" | "digital";
export type DurationInput = number | string | DurationParts | null | undefined;

const MS: Record<DurationUnit | "milliseconds", number> = {
  weeks: 604_800_000,
  days: 86_400_000,
  hours: 3_600_000,
  minutes: 60_000,
  seconds: 1000,
  milliseconds: 1,
};

const ISO = /^P(?:(\d+(?:[.,]\d+)?)W)?(?:(\d+(?:[.,]\d+)?)D)?(?:T(?:(\d+(?:[.,]\d+)?)H)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)S)?)?$/i;

/** ISO 8601 (`PT1H30M`, `P2DT4H`, `P1W`) → partes. `null` si no es una duración de unidades fijas. */
export function parseISODuration(text: string | null | undefined): DurationParts | null {
  if (typeof text !== "string") return null;
  const raw = text.trim();
  const m = ISO.exec(raw);
  if (!m || raw.toUpperCase() === "P" || /T$/i.test(raw)) return null;
  const n = (v: string | undefined) => (v === undefined ? undefined : Number(v.replace(",", ".")));
  const parts: DurationParts = {};
  const values = [n(m[1]), n(m[2]), n(m[3]), n(m[4]), n(m[5])];
  DURATION_UNITS.forEach((unit, i) => {
    if (values[i] !== undefined) parts[unit] = values[i];
  });
  return parts;
}

/** Milisegundos de unas partes (los negativos y los no finitos cuentan como 0). */
export function partsToMs(parts: DurationParts): number {
  let total = 0;
  for (const [unit, value] of Object.entries(parts) as [keyof typeof MS, number | undefined][])
    if (unit in MS && typeof value === "number" && Number.isFinite(value) && value > 0) total += value * MS[unit];
  return Math.round(total);
}

/**
 * Cualquier forma de duración → milisegundos: número (ms), ISO 8601, texto de reloj (`1:30`, `1:30:15`), texto corto
 * (`90m`, `1h 30m`, `45s`) o partes. 0 si no se entiende.
 */
export function toMs(value: DurationInput): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
  if (typeof value === "object") return partsToMs(value);
  const text = value.trim();
  const iso = parseISODuration(text);
  if (iso) return partsToMs(iso);
  const clock = /^(\d+):([0-5]?\d)(?::([0-5]?\d))?$/.exec(text);
  if (clock) return partsToMs({ hours: Number(clock[1]), minutes: Number(clock[2]), seconds: Number(clock[3] ?? 0) });
  const short = [...text.matchAll(/(\d+(?:[.,]\d+)?)\s*(w|d|h|m(?:in)?|s)\b/gi)];
  if (
    short.length &&
    short
      .map((s) => s[0])
      .join("")
      .replace(/\s/g, "") === text.replace(/\s/g, "")
  ) {
    const unit: Record<string, DurationUnit> = { w: "weeks", d: "days", h: "hours", m: "minutes", min: "minutes", s: "seconds" };
    const parts: DurationParts = {};
    for (const [, num, u] of short) {
      const key = unit[u!.toLowerCase()]!;
      parts[key] = (parts[key] ?? 0) + Number(num!.replace(",", "."));
    }
    return partsToMs(parts);
  }
  return 0;
}

/**
 * Reparte `ms` entre unidades enteras de `largest` a `smallest` (lo que sobra por debajo de `smallest` se redondea
 * hacia abajo, o hacia arriba con `ceil`, como una cuenta atrás que no llega a 0 antes de tiempo).
 */
export function balance(
  ms: number,
  largest: DurationUnit = "hours",
  smallest: DurationUnit = "seconds",
  rounding: "floor" | "ceil" | "round" = "floor",
): Required<Pick<DurationParts, DurationUnit>> {
  const from = DURATION_UNITS.indexOf(largest);
  const to = Math.max(from, DURATION_UNITS.indexOf(smallest));
  const step = MS[DURATION_UNITS[to]!];
  let rest = Math[rounding](Math.max(0, ms) / step - (rounding === "ceil" ? 1e-9 : 0)) * step;
  const out = { weeks: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
  for (let i = from; i <= to; i++) {
    const unit = DURATION_UNITS[i]!;
    out[unit] = Math.floor(rest / MS[unit]);
    rest -= out[unit] * MS[unit];
  }
  return out;
}

/** Partes → ISO 8601 (`PT1H30M`, `P2DT3H`, `PT0S`), sin unidades a cero. */
export function toISODuration(parts: DurationParts | number): string {
  const p: DurationParts = typeof parts === "number" ? balance(parts, "days", "seconds", "round") : parts;
  const num = (v: number | undefined) => (v && Number.isFinite(v) && v > 0 ? v : 0);
  const seconds = num(p.seconds) + num(p.milliseconds) / 1000;
  const date = `${num(p.weeks) ? `${num(p.weeks)}W` : ""}${num(p.days) ? `${num(p.days)}D` : ""}`;
  const clock = `${num(p.hours) ? `${num(p.hours)}H` : ""}${num(p.minutes) ? `${num(p.minutes)}M` : ""}${seconds ? `${+seconds.toFixed(3)}S` : ""}`;
  if (!date && !clock) return "PT0S";
  return `P${date}${clock ? `T${clock}` : ""}`;
}

type DurationFormatCtor = new (locale?: string, options?: Record<string, string>) => { format(d: object): string };
const durationFormat = () => (Intl as unknown as { DurationFormat?: DurationFormatCtor }).DurationFormat;

const SINGULAR: Record<DurationUnit, "week" | "day" | "hour" | "minute" | "second"> = {
  weeks: "week",
  days: "day",
  hours: "hour",
  minutes: "minute",
  seconds: "second",
};

/** Respaldo sin `Intl.DurationFormat`: unidades de `NumberFormat` unidas con `ListFormat`. */
function fallbackFormat(parts: Record<DurationUnit, number>, style: Exclude<DurationStyle, "digital">, locale?: string): string {
  const items: string[] = [];
  for (const unit of DURATION_UNITS) {
    const value = parts[unit];
    if (!value) continue;
    try {
      items.push(new Intl.NumberFormat(locale, { style: "unit", unit: SINGULAR[unit], unitDisplay: style }).format(value));
    } catch {
      items.push(`${value} ${SINGULAR[unit]}${value === 1 ? "" : "s"}`);
    }
  }
  if (!items.length) {
    try {
      return new Intl.NumberFormat(locale, { style: "unit", unit: "second", unitDisplay: style }).format(0);
    } catch {
      return "0 seconds";
    }
  }
  try {
    return new Intl.ListFormat(locale, { style: style === "long" ? "long" : "narrow", type: "unit" }).format(items);
  } catch {
    return items.join(" ");
  }
}

const twoDigits = (n: number) => String(n).padStart(2, "0");

/** Cifras del locale para un texto de reloj (`1:05:00` → `١:٠٥:٠٠`). */
function localDigits(text: string, locale?: string): string {
  if (!locale) return text;
  try {
    const nf = new Intl.NumberFormat(locale, { useGrouping: false });
    const digits = Array.from({ length: 10 }, (_, i) => nf.format(i));
    return text.replace(/\d/g, (d) => digits[Number(d)] ?? d);
  } catch {
    return text;
  }
}

export interface FormatDurationOptions {
  style?: DurationStyle;
  /** Unidad mayor del reparto (por defecto la mayor que no queda a cero, hasta días). */
  largestUnit?: DurationUnit;
  /** Unidad menor que se muestra (por defecto segundos). */
  smallestUnit?: DurationUnit;
  locale?: string;
}

/**
 * Texto legible de una duración: «1 hour, 30 minutes» (`long`), «1 hr, 30 min» (`short`), «1h 30m» (`narrow`) o
 * «1:30:00» (`digital`). Con `Intl.DurationFormat` cuando existe; si no, el respaldo da el mismo estilo de texto.
 */
export function formatDuration(value: DurationInput, options: FormatDurationOptions = {}): string {
  const { style = "short", locale } = options;
  const ms = toMs(value);
  const smallest = options.smallestUnit ?? "seconds";
  const auto: DurationUnit = ms >= MS.days ? "days" : "hours";
  const largest = options.largestUnit ?? auto;
  const parts = balance(ms, largest, smallest, "round");
  if (style === "digital") {
    const hours = parts.hours + parts.days * 24 + parts.weeks * 168;
    const text =
      smallest === "minutes" || smallest === "hours"
        ? `${hours}:${twoDigits(parts.minutes)}`
        : `${hours}:${twoDigits(parts.minutes)}:${twoDigits(parts.seconds)}`;
    return localDigits(text, locale);
  }
  const DF = durationFormat();
  if (DF) {
    try {
      const present = Object.fromEntries(Object.entries(parts).filter(([, v]) => v > 0));
      const text = new DF(locale, { style }).format(Object.keys(present).length ? present : { seconds: 0 });
      if (text) return text;
    } catch {
      // Locale no admitido: respaldo.
    }
  }
  return fallbackFormat(parts, style, locale);
}
