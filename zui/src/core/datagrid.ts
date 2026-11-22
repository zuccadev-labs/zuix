// Funciones de DataTable que no son orden ni selección: filtro por columna, CSV, ancho de columna y desplazamiento de
// las columnas fijadas. Puro, sin documento: lo usan el binding de React y el modo DOM.

import { fold } from "./search";

/** Coincide si cada palabra de `query` aparece en `text` (sin acentos ni mayúsculas). Vacío coincide siempre. */
export function matchesFilter(text: string, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = fold(text);
  return words.every((w) => haystack.includes(w));
}

/** Filas que cumplen todos los filtros (`{ clave de columna: texto }`). */
export function filterRows<T>(rows: readonly T[], filters: Readonly<Record<string, string>>, textOf: (row: T, key: string) => string): T[] {
  const active = Object.entries(filters).filter(([, q]) => q.trim());
  if (!active.length) return [...rows];
  return rows.filter((row) => active.every(([key, q]) => matchesFilter(textOf(row, key), q)));
}

export type CsvCell = string | number | boolean | Date | null | undefined;

/**
 * CSV (RFC 4180): comillas cuando hace falta, comillas dobladas y CRLF entre filas. Un texto que empieza por `=`,
 * `+`, `-`, `@`, tabulador o retorno se antepone con `'` para que una hoja de cálculo no lo ejecute como fórmula.
 */
export function toCSV(rows: readonly (readonly CsvCell[])[], separator = ","): string {
  const cell = (v: CsvCell): string => {
    if (v === null || v === undefined) return "";
    let s = v instanceof Date ? (Number.isNaN(v.getTime()) ? "" : v.toISOString()) : String(v);
    if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) || s.includes(separator) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(separator)).join("\r\n");
}

/** Ancho de columna acotado y redondeado. */
export const clampWidth = (w: number, min = 48, max = 1200): number =>
  Math.round(Math.min(max, Math.max(min, Number.isFinite(w) ? w : min)));

/** Desplazamiento (px) de cada columna fijada al inicio: la suma de los anchos de las fijadas anteriores. */
export function pinOffsets(widths: readonly number[], pinned: readonly boolean[]): number[] {
  let x = 0;
  return widths.map((w, i) => {
    const at = x;
    if (pinned[i]) x += w;
    return pinned[i] ? at : 0;
  });
}
