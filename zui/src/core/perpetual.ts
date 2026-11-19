// Año perpetuo de una página (la lámina de calendario de referencia): una tabla de 7 × 7 días de la semana, cada
// columna desplazada un día; cada mes se coloca sobre la columna cuyo primer día coincide con el día de la semana del
// 1 del mes; a la derecha, los números 1–31 en filas de 7. Para leer: la fila del número da la fila de la tabla y la
// columna del mes da el día de la semana. Puro: fechas civiles, sin documento.

import { daysInMonth, parse, valid } from "./date";

export interface PerpetualMonth {
  /** 1–12. */
  month: number;
  days: number;
  /** Columna de la tabla (0–6). */
  column: number;
}

export interface PerpetualModel {
  year: number;
  weekStart: number;
  /** `weekdays[fila][columna]`: día de la semana (0 domingo … 6 sábado). */
  weekdays: number[][];
  /** Meses de cada columna, en orden. */
  columns: PerpetualMonth[][];
  /** `numbers[fila]`: los días del mes de esa fila (1, 8, 15, 22, 29 en la primera). */
  numbers: number[][];
}

/** Día de la semana (0 domingo) de una fecha civil. */
export const weekdayOf = (iso: string) => parse(iso).getUTCDay();

/** Columna de la tabla de un mes: la que empieza por el día de la semana de su día 1. */
export function monthColumn(year: number, month: number, weekStart: number): number {
  const first = new Date(Date.UTC(2000, 0, 1));
  first.setUTCFullYear(year, month - 1, 1);
  return (first.getUTCDay() - weekStart + 7) % 7;
}

/** Modelo de la lámina de un año. */
export function perpetualYear(year: number, weekStart = 1): PerpetualModel {
  const ws = ((weekStart % 7) + 7) % 7;
  const weekdays = Array.from({ length: 7 }, (_, r) => Array.from({ length: 7 }, (_, c) => (ws + c + r) % 7));
  const columns: PerpetualMonth[][] = Array.from({ length: 7 }, () => []);
  for (let m = 1; m <= 12; m++) {
    const column = monthColumn(year, m, ws);
    columns[column]!.push({ month: m, days: daysInMonth(year, m - 1), column });
  }
  const numbers = Array.from({ length: 7 }, (_, r) => [r + 1, r + 8, r + 15, r + 22, r + 29].filter((n) => n <= 31));
  return { year, weekStart: ws, weekdays, columns, numbers };
}

export interface PerpetualCell {
  /** Fila (0–6) por el número del día y columna (0–6) por el mes. */
  row: number;
  column: number;
  weekday: number;
}

/** Dónde se lee una fecha en la lámina y qué día de la semana es. `null` si la fecha no es válida. */
export function perpetualLookup(date: string | null | undefined, weekStart = 1): PerpetualCell | null {
  if (!valid(date)) return null;
  const ws = ((weekStart % 7) + 7) % 7;
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  const column = monthColumn(year, month, ws);
  const row = (day - 1) % 7;
  return { row, column, weekday: (ws + column + row) % 7 };
}
