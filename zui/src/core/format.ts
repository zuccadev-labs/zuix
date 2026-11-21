// Formato de números, tamaños en bytes y fechas con Intl, y resaltado de coincidencias en un texto. Puro: sin
// documento y sin React. Lo usan FormatNumber, FormatByte, FormatDate y Highlight (React y modo DOM).

import { numberFormat } from "./chart";

/** Texto de un número con `Intl.NumberFormat` (compacto, moneda, porcentaje, unidad…). `""` si no es un número. */
export function formatNumber(value: number | null | undefined, locale?: string, options: Intl.NumberFormatOptions = {}): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return numberFormat(locale, options).format(value);
}

export type ByteSystem = "decimal" | "binary";
const DECIMAL = ["byte", "kilobyte", "megabyte", "gigabyte", "terabyte", "petabyte"] as const;
const BINARY = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"] as const;

export interface ByteParts {
  value: number;
  /** Índice de la unidad (0 = bytes). */
  exponent: number;
}

/** Unidad que deja el valor entre 1 y la base (1000 en decimal, 1024 en binario). */
export function byteParts(bytes: number, system: ByteSystem = "decimal"): ByteParts {
  const base = system === "binary" ? 1024 : 1000;
  const abs = Math.abs(bytes);
  let exponent = 0;
  while (abs >= base ** (exponent + 1) && exponent < DECIMAL.length - 1) exponent++;
  return { value: bytes / base ** exponent, exponent };
}

export interface ByteOptions {
  system?: ByteSystem;
  unitDisplay?: "short" | "long" | "narrow";
  maximumFractionDigits?: number;
}

/**
 * «1.5 MB», «1,5 megabytes» o «1.4 MiB». Decimal con las unidades de `Intl` (localizadas); binario con el número de
 * `Intl` y el símbolo IEC (que `Intl` no tiene).
 */
export function formatByte(bytes: number | null | undefined, locale?: string, options: ByteOptions = {}): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return "";
  const { system = "decimal", unitDisplay = "short", maximumFractionDigits = 1 } = options;
  const { value, exponent } = byteParts(bytes, system);
  const digits = exponent === 0 ? 0 : maximumFractionDigits;
  if (system === "binary") return `${numberFormat(locale, { maximumFractionDigits: digits }).format(value)} ${BINARY[exponent]}`;
  return numberFormat(locale, { style: "unit", unit: DECIMAL[exponent], unitDisplay, maximumFractionDigits: digits }).format(value);
}

/** Instante de una fecha: `Date`, milisegundos o cadena ISO (una fecha civil sin hora se toma a mediodía UTC). */
export function toDate(value: Date | number | string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const d =
    value instanceof Date
      ? value
      : typeof value === "number"
        ? new Date(value)
        : new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Texto y atributo `datetime` de una fecha con `Intl.DateTimeFormat`. */
export function formatDate(
  value: Date | number | string | null | undefined,
  locale?: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
): { text: string; datetime: string } {
  const d = toDate(value);
  if (!d) return { text: "", datetime: "" };
  let f: Intl.DateTimeFormat;
  try {
    f = new Intl.DateTimeFormat(locale, options);
  } catch {
    f = new Intl.DateTimeFormat(undefined, options);
  }
  const civil = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  return { text: f.format(d), datetime: civil ? (value as string) : d.toISOString() };
}

// —— Resaltado ——

export interface HighlightOptions {
  /** Sin distinguir mayúsculas (por defecto, sí). */
  ignoreCase?: boolean;
  /** Sin distinguir acentos ni diacríticos («cafe» encuentra «café»). */
  ignoreAccents?: boolean;
  /** Solo palabras completas. */
  wholeWord?: boolean;
}

export interface HighlightPart {
  text: string;
  match: boolean;
}

const fold = (s: string, accents: boolean, kase: boolean) => {
  let out = s;
  if (accents) out = out.normalize("NFD").replace(/\p{M}/gu, "");
  return kase ? out.toLocaleLowerCase() : out;
};

/**
 * Trozos de `text` con las coincidencias de una o varias consultas marcadas (las que se solapan se unen). Con
 * `ignoreAccents` se compara la forma sin diacríticos, carácter a carácter, y se devuelve el texto original.
 */
export function highlightParts(text: string, query: string | readonly string[], options: HighlightOptions = {}): HighlightPart[] {
  const { ignoreCase = true, ignoreAccents = false, wholeWord = false } = options;
  const queries = (typeof query === "string" ? [query] : [...query]).map((q) => q.trim()).filter(Boolean);
  if (!text || !queries.length) return text ? [{ text, match: false }] : [];
  // Mapa del texto plegado al original: cada carácter original da uno o más plegados (con NFD, «é» → «e»).
  const chars = [...text];
  let folded = "";
  const origin: number[] = [];
  const starts: number[] = [];
  let pos = 0;
  chars.forEach((ch, i) => {
    starts.push(pos);
    const f = fold(ch, ignoreAccents, ignoreCase);
    for (let k = 0; k < f.length; k++) origin.push(i);
    folded += f;
    pos += ch.length;
  });
  starts.push(pos);
  const ranges: Array<[number, number]> = [];
  const isWord = (c: string | undefined) => c !== undefined && /[\p{L}\p{N}_]/u.test(c);
  for (const q of queries) {
    const needle = fold(q, ignoreAccents, ignoreCase);
    if (!needle) continue;
    let at = folded.indexOf(needle);
    while (at !== -1) {
      const a = origin[at]!;
      const b = origin[at + needle.length - 1]! + 1;
      if (!wholeWord || (!isWord(chars[a - 1]) && !isWord(chars[b]))) ranges.push([a, b]);
      at = folded.indexOf(needle, at + Math.max(1, needle.length));
    }
  }
  if (!ranges.length) return [{ text, match: false }];
  ranges.sort((x, y) => x[0] - y[0] || y[1] - x[1]);
  const merged: Array<[number, number]> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  const out: HighlightPart[] = [];
  let cursor = 0;
  const slice = (a: number, b: number) => text.slice(starts[a], starts[b]);
  for (const [a, b] of merged) {
    if (a > cursor) out.push({ text: slice(cursor, a), match: false });
    out.push({ text: slice(a, b), match: true });
    cursor = b;
  }
  if (cursor < chars.length) out.push({ text: slice(cursor, chars.length), match: false });
  return out;
}
