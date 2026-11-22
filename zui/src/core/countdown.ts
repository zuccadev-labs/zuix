// Cuenta atrás hasta un instante (un lanzamiento, el fin de una oferta): partes que faltan en las unidades pedidas,
// si ya pasó, cuándo toca anunciar y el texto hablado. La diferencia es entre instantes absolutos, así que un cambio
// de hora en medio no la altera; la zona solo sirve para mostrar el instante objetivo. Puro y sin documento.

import { formatDuration, type DurationUnit } from "./duration";
import { toInstant } from "./relative";

export type CountdownUnit = Extract<DurationUnit, "days" | "hours" | "minutes" | "seconds">;
export const COUNTDOWN_UNITS: readonly CountdownUnit[] = ["days", "hours", "minutes", "seconds"];

const MS: Record<CountdownUnit, number> = { days: 86_400_000, hours: 3_600_000, minutes: 60_000, seconds: 1000 };

/** Instante objetivo: ISO con zona, milisegundos o `Date`. `null` si no vale. */
export const countdownTarget = (to: number | string | Date | null | undefined) => toInstant(to);

/** Unidades válidas, en orden de mayor a menor y sin repetir. Vacío → las cuatro. */
export function countdownUnits(units: readonly string[] | null | undefined): CountdownUnit[] {
  const wanted = COUNTDOWN_UNITS.filter((u) => units?.includes(u));
  return wanted.length ? wanted : [...COUNTDOWN_UNITS];
}

export interface Remaining {
  /** Milisegundos que faltan (0 si ya pasó). */
  ms: number;
  /** Ya llegó el instante. */
  done: boolean;
  /** Valor de cada unidad pedida; la mayor absorbe lo de las que no se piden (sin días, las horas pasan de 24). */
  parts: Partial<Record<CountdownUnit, number>>;
}

/**
 * Lo que falta de `now` a `to` en las unidades pedidas. Se redondea hacia arriba en la menor: «00:00:01» se ve
 * hasta el último instante, y 0 solo cuando de verdad llegó.
 */
export function until(to: number, now: number, units: readonly CountdownUnit[] = COUNTDOWN_UNITS): Remaining {
  const list = countdownUnits(units);
  const ms = Math.max(0, to - now);
  const smallest = MS[list[list.length - 1]!];
  let rest = Math.ceil(ms / smallest - 1e-9) * smallest;
  const parts: Partial<Record<CountdownUnit, number>> = {};
  for (const unit of list) {
    parts[unit] = Math.floor(rest / MS[unit]);
    rest -= parts[unit]! * MS[unit];
  }
  return { ms, done: ms === 0, parts };
}

/**
 * Cada cuánto se anuncia según lo que falta, si la aplicación no lo fija: cada hora con horas por delante, cada
 * cuarto de hora en la última hora y cada minuto en los últimos cinco. En segundos.
 */
export function autoAnnounceStep(msLeft: number): number {
  if (msLeft > 3_600_000) return 3600;
  if (msLeft > 300_000) return 900;
  return 60;
}

/**
 * ¿Se cruzó un hito al pasar de `before` a `after` milisegundos restantes? `every` en segundos fija el paso; sin él,
 * el paso automático. 0 desactiva los hitos (solo se anuncia el final, aparte). Devuelve los ms del hito o `null`.
 * Un salto largo (la pestaña estuvo oculta) cuenta como un solo hito.
 */
export function countdownMilestone(before: number, after: number, every?: number | null): number | null {
  if (!(after < before) || after <= 0) return null;
  const step = (every === undefined || every === null ? autoAnnounceStep(after) : every) * 1000;
  if (!(step > 0)) return null;
  const a = Math.ceil(before / 1000 - 1e-9) * 1000;
  const b = Math.ceil(after / 1000 - 1e-9) * 1000;
  if (a === b) return null;
  // Hay un múltiplo del paso en [b, a): se cruzó.
  const m = Math.floor((a - 1) / step) * step;
  return m > 0 && m >= b ? b : null;
}

/**
 * Texto hablado de lo que falta: «2 days, 3 hours, 5 minutes». Los segundos solo en el último minuto, para que el
 * nombre del temporizador no cambie cada segundo.
 */
export function countdownSpoken(remaining: Remaining, locale?: string): string {
  const { parts } = remaining;
  const hasSeconds = parts.seconds !== undefined;
  const lastMinute = remaining.ms <= 60_000;
  const spoken = {
    days: parts.days ?? 0,
    hours: parts.hours ?? 0,
    minutes: parts.minutes ?? 0,
    seconds: hasSeconds && lastMinute ? (parts.seconds ?? 0) : 0,
  };
  const ms = ((spoken.days * 24 + spoken.hours) * 60 + spoken.minutes) * 60_000 + spoken.seconds * 1000;
  const smallest = hasSeconds && lastMinute ? "seconds" : "minutes";
  // Más de un minuto con segundos visibles: se habla redondeando hacia arriba al minuto.
  const rounded = smallest === "minutes" && hasSeconds && (parts.seconds ?? 0) > 0 ? ms + 60_000 : ms;
  return formatDuration(rounded, {
    style: "long",
    locale,
    largestUnit: parts.days !== undefined ? "days" : "hours",
    smallestUnit: smallest,
  });
}

/** Cifras de una unidad con dos dígitos como mínimo (los días, tal cual). */
export const unitDigits = (unit: CountdownUnit, value: number) => (unit === "days" ? String(value) : String(value).padStart(2, "0"));
