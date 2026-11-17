// Orden de celdas de tabla. Los vacíos (null, undefined, NaN, fecha inválida) van al final.

// `instanceof Date` falla con fechas creadas en otro realm (un iframe, un entorno de pruebas): se mira la etiqueta.
export const isDate = (value: unknown): value is Date => Object.prototype.toString.call(value) === "[object Date]";

const empty = (value: unknown) => value == null || (typeof value === "number" && Number.isNaN(value)) || (isDate(value) && Number.isNaN(value.getTime()));

/** Compara dos valores de celda en orden ascendente; el texto, sin distinguir mayúsculas y con números naturales. */
export function compare(a: unknown, b: unknown): number {
  const ea = empty(a);
  const eb = empty(b);
  if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1;
  if (isDate(a) && isDate(b)) return a.getTime() - b.getTime();
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

/** Número escrito en una celda («1.234», «$ 12», «-5»); `null` si el texto no contiene ninguna cifra o no es un número. */
export function parseNumber(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.eE+-]/g, "");
  if (!/\d/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isNaN(n) ? null : n;
}
