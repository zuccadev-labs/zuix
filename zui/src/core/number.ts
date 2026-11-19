// Números en un campo de texto: leer lo que escribe la persona en su formato local, mostrarlo con
// `Intl.NumberFormat` y moverlo por pasos dentro de un rango. Sin DOM ni efectos al importar.

export interface NumberRange {
  min?: number;
  max?: number;
  /** Paso; el valor se ajusta a múltiplos de él contados desde `min` (o desde 0). */
  step?: number;
}

const cache = new Map<string, { group: string; decimal: string; minus: string }>();

/** Separadores de miles y decimal, y el signo menos, del locale. */
export function numberSymbols(locale?: string): { group: string; decimal: string; minus: string } {
  const key = locale ?? "";
  const hit = cache.get(key);
  if (hit) return hit;
  const parts = new Intl.NumberFormat(locale, { useGrouping: true }).formatToParts(-12345.6);
  const symbols = {
    group: parts.find((p) => p.type === "group")?.value ?? ",",
    decimal: parts.find((p) => p.type === "decimal")?.value ?? ".",
    minus: parts.find((p) => p.type === "minusSign")?.value ?? "-",
  };
  cache.set(key, symbols);
  return symbols;
}

/** Decimales de un número escrito en notación normal (0.25 → 2). */
export function decimalsOf(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const text = String(value);
  const exp = /e-(\d+)$/.exec(text);
  if (exp) return Number(exp[1]) + (text.split("e")[0]!.split(".")[1]?.length ?? 0);
  return text.split(".")[1]?.length ?? 0;
}

/** Redondea a `decimals` sin el error de coma flotante de 0.1 + 0.2. */
const round = (value: number, decimals: number) => Number(value.toFixed(Math.min(20, Math.max(0, decimals))));

/**
 * Lee un número escrito en el formato del locale (separador de miles opcional, decimal del locale o el punto, signo
 * menos de cualquier tipo). Con `percent` divide entre 100 (el campo muestra 25 % y vale 0.25). Devuelve `null` si
 * el texto está vacío o no es un número.
 */
export function parseNumber(text: string, locale?: string, percent = false): number | null {
  const { group, decimal } = numberSymbols(locale);
  let clean = text
    .normalize("NFKC")
    .replace(/[\s  %‰]/g, "")
    .replace(/[−‒–﹣－]/g, "-");
  // Quita símbolos de moneda y letras: el campo admite «$ 1,200» o «1.200 €».
  clean = clean.replace(/[^\d.,'’\-+]/g, "");
  if (!clean || clean === "-" || clean === "+") return null;
  const spaced = /^[\s\u00a0\u202f]$/.test(group);
  // Separador de miles del locale escrito como decimal («1.5» en es-ES): una sola aparición, sin el decimal del
  // locale y sin tres cifras detrás, es un decimal.
  const parts = group && !spaced ? clean.split(group) : [clean];
  const asDecimal = parts.length === 2 && !clean.includes(decimal) && parts[1]!.replace(/\D/g, "").length !== 3;
  if (group && !spaced) clean = asDecimal ? parts.join(".") : parts.join("");
  clean = clean.replace(/['’]/g, "");
  if (decimal !== ".") clean = clean.split(decimal).join(".");
  if (clean.split(".").length - 1 > 1) return null;
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(clean)) return null;
  const value = Number(clean);
  if (!Number.isFinite(value)) return null;
  return percent ? round(value / 100, decimalsOf(value) + 2) : value;
}

/** Texto del número con `Intl.NumberFormat`. `null` → "". */
export function formatNumber(value: number | null | undefined, locale?: string, options?: Intl.NumberFormatOptions): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return new Intl.NumberFormat(locale, options).format(value);
}

/** Lleva el valor al rango y al paso más cercano. */
export function clampNumber(value: number, { min, max, step }: NumberRange = {}): number {
  let next = value;
  if (step && step > 0) {
    const base = min ?? 0;
    const decimals = Math.max(decimalsOf(step), decimalsOf(base));
    next = round(base + Math.round((next - base) / step) * step, decimals);
  }
  if (max !== undefined && next > max) next = max;
  if (min !== undefined && next < min) next = min;
  // Si el tope no cae en un paso, el valor tampoco sale del rango al ajustarlo.
  return next;
}

/**
 * Siguiente valor al pulsar una flecha (`delta` pasos, negativo para bajar). Sin valor, empieza en `min` al subir,
 * en `max` al bajar o, si no hay tope, en 0.
 */
export function stepNumber(value: number | null, delta: number, range: NumberRange = {}): number {
  const step = range.step && range.step > 0 ? range.step : 1;
  if (value === null || !Number.isFinite(value)) {
    const start = delta > 0 ? (range.min ?? 0) : (range.max ?? range.min ?? 0);
    return clampNumber(start, range);
  }
  const decimals = Math.max(decimalsOf(step), decimalsOf(value), decimalsOf(range.min ?? 0));
  // Desde un valor fuera de paso, el primer paso lleva al múltiplo siguiente en esa dirección.
  const base = range.min ?? 0;
  const offset = round((value - base) / step, 10);
  const aligned = Number.isInteger(offset);
  const index = aligned ? offset + delta : delta > 0 ? Math.floor(offset) + delta : Math.ceil(offset) + delta;
  const raw = round(base + index * step, decimals);
  let next = raw;
  if (range.max !== undefined && next > range.max) next = range.max;
  if (range.min !== undefined && next < range.min) next = range.min;
  return next;
}
