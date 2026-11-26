// Cálculos de las piezas de métricas (MetricCard, DeltaBadge, ProgressGoal, BarList, Leaderboard): variación frente
// al periodo anterior con su sentido (que bajen los errores es bueno), texto hablado que no depende del color, ritmo
// hacia un objetivo y proporciones de barras. Sin documento: recibe números y devuelve datos.
import { localize } from "./locale";
import { format } from "./locale";

export type DeltaDirection = "up" | "down" | "flat";
/** Lo que es bueno para la métrica: que suba (ventas) o que baje (errores, latencia). */
export type DeltaPositive = "up" | "down";
export type DeltaSentiment = "good" | "bad" | "neutral";

export interface Delta {
  /** Diferencia absoluta (valor − anterior). */
  abs: number;
  /** Diferencia relativa (fracción: 0.124 = 12,4 %); `null` si el anterior es 0. */
  rel: number | null;
  direction: DeltaDirection;
  sentiment: DeltaSentiment;
}

/** Por debajo de este umbral relativo (o absoluto, sin relativo) la variación cuenta como plana. */
export const FLAT_EPSILON = 0.0005;

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Dirección de una variación, con una banda plana para no pintar «sube 0,0 %». */
export function deltaDirection(change: number, epsilon = FLAT_EPSILON): DeltaDirection {
  if (!finite(change) || Math.abs(change) < epsilon) return "flat";
  return change > 0 ? "up" : "down";
}

/** Sentimiento de una dirección según lo que es bueno para la métrica. */
export function deltaSentiment(direction: DeltaDirection, positive: DeltaPositive = "up"): DeltaSentiment {
  if (direction === "flat") return "neutral";
  return direction === positive ? "good" : "bad";
}

/** Variación de `value` frente a `previous`. */
export function computeDelta(value: number, previous: number, positive: DeltaPositive = "up"): Delta {
  const abs = finite(value) && finite(previous) ? value - previous : 0;
  const rel = finite(previous) && previous !== 0 && finite(value) ? (value - previous) / Math.abs(previous) : null;
  const direction = deltaDirection(rel ?? abs, rel === null ? Number.EPSILON : FLAT_EPSILON);
  return { abs, rel, direction, sentiment: deltaSentiment(direction, positive) };
}

/** Variación dada ya como fracción (`delta={0.124}`), sin valor anterior. */
export function deltaFromRelative(rel: number, positive: DeltaPositive = "up"): Delta {
  const direction = deltaDirection(rel);
  return { abs: 0, rel: finite(rel) ? rel : null, direction, sentiment: deltaSentiment(direction, positive) };
}

const formats = new Map<string, Intl.NumberFormat>();
/** `Intl.NumberFormat` cacheado, tolerante a un locale inválido. */
export function numberFormat(locale: string | undefined, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const key = `${locale ?? ""}|${JSON.stringify(options)}`;
  let f = formats.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat(locale, options);
    } catch {
      f = new Intl.NumberFormat(undefined, options);
    }
    formats.set(key, f);
  }
  return f;
}

/** Valor formateado: una cadena se respeta tal cual, un número pasa por `Intl.NumberFormat`. */
export function formatValue(value: number | string | null | undefined, locale?: string, options?: Intl.NumberFormatOptions): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return finite(value) ? numberFormat(locale, options).format(value) : "";
}

/** Magnitud visible de la variación, sin signo (la flecha y el texto dicen el sentido): «12.4%». */
export function deltaMagnitude(delta: Delta, locale?: string, absFormat?: Intl.NumberFormatOptions): string {
  if (delta.rel !== null)
    return numberFormat(locale, { style: "percent", maximumFractionDigits: 1, minimumFractionDigits: 0 }).format(Math.abs(delta.rel));
  return numberFormat(locale, absFormat ?? { maximumFractionDigits: 2 }).format(Math.abs(delta.abs));
}

export interface DeltaLabels {
  /** «up {value}» */
  up: string;
  /** «down {value}» */
  down: string;
  /** «no change» */
  flat: string;
  /** «, better than {period}» */
  better: string;
  /** «, worse than {period}» */
  worse: string;
  /** Periodo de comparación por defecto. */
  period: string;
}

export const DELTA_LABELS: DeltaLabels = {
  up: "up {value}",
  down: "down {value}",
  flat: "no change",
  better: ", better than {period}",
  worse: ", worse than {period}",
  period: "the previous period",
};

const put = (template: string, values: Record<string, string>) => format(template, values, { missing: () => "" });

/** Frase hablada de la variación: «up 12.4%, better than last month». No depende del color ni de la flecha. */
export function deltaSpoken(delta: Delta, magnitude: string, period?: string, labels: Partial<DeltaLabels> = {}): string {
  const l = { ...localize("delta", DELTA_LABELS), ...labels };
  if (delta.direction === "flat") return l.flat;
  const base = put(delta.direction === "up" ? l.up : l.down, { value: magnitude });
  if (delta.sentiment === "neutral") return base;
  return base + put(delta.sentiment === "good" ? l.better : l.worse, { period: period ?? l.period });
}

/* ---------- Objetivo y ritmo ---------- */

export type PaceStatus = "ahead" | "on-track" | "behind" | "done";

export interface Pace {
  /** Avance hacia el objetivo, 0…1 (acotado). */
  progress: number;
  /** Avance que tocaría con el tiempo transcurrido (0…1), o `null` sin periodo. */
  expected: number | null;
  /** Avance / esperado (1 = justo al ritmo); `null` sin periodo o al principio. */
  ratio: number | null;
  status: PaceStatus;
}

/** Margen alrededor del ritmo esperado que todavía cuenta como «en ritmo». */
export const PACE_TOLERANCE = 0.05;

/**
 * Ritmo hacia `target` con `elapsed` (0…1) del periodo transcurrido. Sin `elapsed`, solo el avance.
 * `start` es el valor de partida (por defecto 0).
 */
export function computePace(value: number, target: number, elapsed?: number | null, start = 0): Pace {
  const span = target - start;
  const raw = span === 0 ? (value >= target ? 1 : 0) : (value - start) / span;
  const progress = finite(raw) ? Math.min(1, Math.max(0, raw)) : 0;
  if (progress >= 1) return { progress: 1, expected: elapsed ?? null, ratio: elapsed ? 1 / Math.max(elapsed, 1e-9) : null, status: "done" };
  if (elapsed === undefined || elapsed === null || !finite(elapsed)) return { progress, expected: null, ratio: null, status: "on-track" };
  const expected = Math.min(1, Math.max(0, elapsed));
  if (expected === 0) return { progress, expected, ratio: null, status: progress > 0 ? "ahead" : "on-track" };
  const ratio = progress / expected;
  const status: PaceStatus = ratio > 1 + PACE_TOLERANCE ? "ahead" : ratio < 1 - PACE_TOLERANCE ? "behind" : "on-track";
  return { progress, expected, ratio, status };
}

/** Fracción transcurrida de un periodo entre dos instantes (ms), acotada a 0…1. */
export function elapsedFraction(start: number, end: number, now: number): number {
  if (!(end > start)) return now >= end ? 1 : 0;
  return Math.min(1, Math.max(0, (now - start) / (end - start)));
}

/* ---------- Barras proporcionales ---------- */

/** Fracción de cada valor sobre el máximo (o `max`), para barras de BarList y Leaderboard. Negativos y NaN cuentan 0. */
export function barFractions(values: readonly number[], max?: number): number[] {
  const top = max ?? values.reduce((m, v) => (finite(v) && v > m ? v : m), 0);
  return values.map((v) => (top > 0 && finite(v) && v > 0 ? Math.min(1, v / top) : 0));
}

/** Fracción de cada valor sobre el total (barra de categorías apilada). */
export function shareFractions(values: readonly number[]): number[] {
  const total = values.reduce((s, v) => s + (finite(v) && v > 0 ? v : 0), 0);
  return values.map((v) => (total > 0 && finite(v) && v > 0 ? v / total : 0));
}

/** Rangos con empates (1, 2, 2, 4) de una lista ordenada de mayor a menor. */
export function competitionRanks(values: readonly number[]): number[] {
  const ranks: number[] = [];
  values.forEach((v, i) => {
    ranks.push(i > 0 && values[i - 1] === v ? ranks[i - 1]! : i + 1);
  });
  return ranks;
}

export interface MetricCardLabels {
  /** Sin datos para el periodo. */
  empty: string;
  /** No se pudo cargar. */
  error: string;
  /** Nombre de la meta bajo el valor. */
  target: string;
  /** Periodo visible junto a la variación: «vs {period}». */
  versus: string;
}

export const METRIC_CARD_LABELS: MetricCardLabels = {
  empty: "No data for this period",
  error: "Couldn't load this metric",
  target: "Goal",
  versus: "vs {period}",
};
