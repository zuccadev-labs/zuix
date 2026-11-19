// Tiempo relativo («hace 3 min», «en 2 días»). Aquí sí se trata de un instante (ISO con zona o milisegundos desde
// la época), no de una fecha civil. `Intl.RelativeTimeFormat` pone el texto; este módulo elige la unidad y cuándo
// volver a pintar. Sin documento ni temporizadores: los pone quien lo usa.

export type RelativeUnit = "second" | "minute" | "hour" | "day" | "week" | "month" | "year";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const STEPS: [RelativeUnit, number][] = [
  ["year", 365 * DAY],
  ["month", 30 * DAY],
  ["week", 7 * DAY],
  ["day", DAY],
  ["hour", HOUR],
  ["minute", MINUTE],
  ["second", SECOND],
];

/** Lee un instante: milisegundos, `Date` o cadena ISO 8601 con zona. `null` si no es válido. */
export function toInstant(value: number | string | Date | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const ms = typeof value === "number" ? value : value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/** Valor y unidad para la distancia `then − now` (negativo en el pasado), con la unidad más grande que cabe. */
export function relativeParts(then: number, now: number, minUnit: RelativeUnit = "second"): { value: number; unit: RelativeUnit } {
  const diff = then - now;
  const abs = Math.abs(diff);
  const floor = STEPS.findIndex(([unit]) => unit === minUnit);
  for (let i = 0; i < STEPS.length; i++) {
    const [unit, size] = STEPS[i]!;
    if (abs >= size || i >= floor) return { value: Math.round(diff / size), unit };
  }
  return { value: 0, unit: minUnit };
}

/** Milisegundos hasta que el texto puede cambiar: cada segundo cerca de ahora, cada minuto en la primera hora… */
export function nextUpdate(then: number, now: number): number {
  const abs = Math.abs(then - now);
  if (abs < MINUTE) return SECOND;
  if (abs < HOUR) return 15 * SECOND;
  if (abs < DAY) return 5 * MINUTE;
  return HOUR;
}

/** Texto relativo con `Intl.RelativeTimeFormat` (`numeric: "auto"`: «ayer», «ahora»). */
export function formatRelative(
  then: number,
  now: number,
  locale?: string,
  options: { style?: "long" | "short" | "narrow"; numeric?: "always" | "auto"; minUnit?: RelativeUnit } = {},
): string {
  const { value, unit } = relativeParts(then, now, options.minUnit);
  let format: Intl.RelativeTimeFormat;
  try {
    format = new Intl.RelativeTimeFormat(locale, { style: options.style ?? "long", numeric: options.numeric ?? "auto" });
  } catch {
    format = new Intl.RelativeTimeFormat(undefined, { style: options.style ?? "long", numeric: options.numeric ?? "auto" });
  }
  return format.format(value, unit);
}
