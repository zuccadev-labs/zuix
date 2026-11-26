// Trimestres del calendario civil (QuarterPicker) sin documento: valor `YYYY-Qn` (n de 1 a 4), como `YYYY-MM` en
// MonthPicker. Días que abarca, desplazamiento, límites y la tecla que mueve el foco en la rejilla de 2 × 2.
import { endOfMonth, pad } from "./date";

const QUARTER = /^(\d{4})-Q([1-4])$/;

export const validQuarter = (value: string | null | undefined): value is string => typeof value === "string" && QUARTER.test(value);

export function parseQuarter(value: string | null | undefined): { year: number; quarter: number } | null {
  const m = typeof value === "string" ? QUARTER.exec(value) : null;
  return m ? { year: Number(m[1]), quarter: Number(m[2]) } : null;
}

export const quarterText = (year: number, quarter: number) => `${pad(year, 4)}-Q${quarter}`;

/** Trimestre de una fecha `YYYY-MM-DD` (o de un mes `YYYY-MM`). */
export const quarterOf = (iso: string) => quarterText(Number(iso.slice(0, 4)), Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1);

/** Suma trimestres (negativos restan). Fuera de 0001–9999, null. */
export function addQuarters(value: string, count: number): string | null {
  const q = parseQuarter(value);
  if (!q) return null;
  const index = q.year * 4 + (q.quarter - 1) + count;
  const year = Math.floor(index / 4);
  if (year < 1 || year > 9999) return null;
  return quarterText(year, (index % 4) + 1);
}

/** Primer y último día del trimestre. */
export function quarterRange(value: string): { from: string; to: string } | null {
  const q = parseQuarter(value);
  if (!q) return null;
  const first = (q.quarter - 1) * 3 + 1;
  return { from: `${pad(q.year, 4)}-${pad(first)}-01`, to: endOfMonth(`${pad(q.year, 4)}-${pad(first + 2)}-01`) };
}

/** Dentro de los límites (`YYYY-Qn`); un límite que no es trimestre no limita. */
export function inQuarterBounds(value: string, min?: string | null, max?: string | null): boolean {
  if (validQuarter(min) && value < min) return false;
  if (validQuarter(max) && value > max) return false;
  return true;
}

/** Meses del trimestre en el locale: «Jan – Mar». */
export function quarterMonths(quarter: number, locale?: string): string {
  const format = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
  const first = (quarter - 1) * 3;
  return `${format.format(Date.UTC(2000, first, 1))} – ${format.format(Date.UTC(2000, first + 2, 1))}`;
}

/** Columnas de la rejilla: T1 T2 / T3 T4. */
export const QUARTER_COLUMNS = 2;

/**
 * Trimestre al que lleva una tecla en la rejilla (patrón APG «grid»): flechas a los lados (±1) y en vertical (±2),
 * Inicio y Fin al principio o al final de la fila, Re Pág y Av Pág al año anterior o siguiente (con Mayús, la década).
 * Cruzar un borde pasa al año de al lado. `null` si la tecla no mueve.
 */
export function quarterKeyTarget(key: string, value: string, shift = false): string | null {
  const q = parseQuarter(value);
  if (!q) return null;
  const col = (q.quarter - 1) % QUARTER_COLUMNS;
  switch (key) {
    case "ArrowRight":
      return addQuarters(value, 1);
    case "ArrowLeft":
      return addQuarters(value, -1);
    case "ArrowDown":
      return addQuarters(value, QUARTER_COLUMNS);
    case "ArrowUp":
      return addQuarters(value, -QUARTER_COLUMNS);
    case "Home":
      return addQuarters(value, -col);
    case "End":
      return addQuarters(value, QUARTER_COLUMNS - 1 - col);
    case "PageUp":
      return addQuarters(value, shift ? -40 : -4);
    case "PageDown":
      return addQuarters(value, shift ? 40 : 4);
    default:
      return null;
  }
}

/** Trimestre dentro de los límites más cercano (para el foco al abrir). */
export function clampQuarter(value: string, min?: string | null, max?: string | null): string {
  if (validQuarter(min) && value < min) return min;
  if (validQuarter(max) && value > max) return max;
  return value;
}
