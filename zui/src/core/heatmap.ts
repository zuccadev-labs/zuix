// Mapa de calor y rachas: semanas de un rango, niveles por cuantiles, rachas (actual y mayor), día de la semana más
// activo y el estado de las rachas de hábitos. Puro: fechas civiles `YYYY-MM-DD`, sin documento.

import { addDays, diffDays, parse, startOfWeek, valid } from "./date";

/** Columnas de 7 días (una por semana) que cubren `[from, to]`; los días fuera del rango son `null`. */
export function heatmapWeeks(from: string, to: string, weekStart = 1): (string | null)[][] {
  if (!valid(from) || !valid(to) || to < from) return [];
  const first = startOfWeek(from, weekStart);
  const weeks: (string | null)[][] = [];
  for (let d = first; d <= to; d = addDays(d, 7))
    weeks.push(
      Array.from({ length: 7 }, (_, i) => {
        const day = addDays(d, i);
        return day < from || day > to ? null : day;
      }),
    );
  return weeks;
}

/** Columna en la que empieza cada mes (la primera semana que contiene su día 1). */
export function monthStarts(weeks: (string | null)[][]): { column: number; month: string }[] {
  const out: { column: number; month: string }[] = [];
  weeks.forEach((week, column) => {
    const first = week.find((d) => d && (d.endsWith("-01") || (column === 0 && d)));
    if (first && !out.some((m) => m.month === first.slice(0, 7))) out.push({ column, month: first.slice(0, 7) });
  });
  return out;
}

/**
 * Umbrales de los niveles 1…`levels` sobre los valores positivos: cuantiles, de modo que cada nivel recoge una parte
 * parecida de los días con actividad. Devuelve `levels` umbrales crecientes (el nivel `i` empieza en `t[i-1]`).
 */
export function heatmapThresholds(values: number[], levels = 4): number[] {
  const positive = values.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (!positive.length) return Array.from({ length: levels }, (_, i) => i + 1);
  const out: number[] = [];
  for (let i = 0; i < levels; i++) {
    const q = positive[Math.min(positive.length - 1, Math.floor((i / levels) * positive.length))]!;
    // Estrictamente crecientes: con muchos valores iguales, el valor repetido cae en el nivel más bajo que lo recoge.
    const prev = out[i - 1];
    out.push(prev !== undefined && q <= prev ? prev + Math.max(1e-9, Math.abs(prev) * 1e-9) : q);
  }
  return out;
}

/** Nivel 0…`thresholds.length` de un valor (0 = sin actividad). */
export function heatmapLevel(value: number | null | undefined, thresholds: number[]): number {
  if (!value || !Number.isFinite(value) || value <= 0) return 0;
  let level = 1;
  for (let i = 1; i < thresholds.length; i++) if (value >= thresholds[i]!) level = i + 1;
  return level;
}

export interface Streaks {
  /** Días seguidos con actividad que terminan hoy (o ayer, si hoy aún no tiene). */
  current: number;
  longest: number;
  /** Fechas de la racha mayor y de la actual. */
  longestRange: { from: string; to: string } | null;
  currentRange: { from: string; to: string } | null;
}

/** Rachas de días con valor positivo hasta `today` incluido. */
export function streaks(values: Record<string, number>, today: string): Streaks {
  const days = Object.keys(values)
    .filter((d) => valid(d) && d <= today && values[d]! > 0)
    .sort();
  let longest = 0;
  let longestRange: Streaks["longestRange"] = null;
  let runFrom: string | null = null;
  let prev: string | null = null;
  let run = 0;
  for (const d of days) {
    if (prev && diffDays(prev, d) === 1) run++;
    else {
      run = 1;
      runFrom = d;
    }
    if (run > longest) {
      longest = run;
      longestRange = { from: runFrom!, to: d };
    }
    prev = d;
  }
  let current = 0;
  let currentRange: Streaks["currentRange"] = null;
  const last = days[days.length - 1];
  if (last && (last === today || last === addDays(today, -1))) {
    let d = last;
    while (values[d]! > 0) {
      current++;
      d = addDays(d, -1);
    }
    currentRange = { from: addDays(d, 1), to: last };
  }
  return { current, longest, longestRange, currentRange };
}

/** Día de la semana (0 domingo) con más actividad total; `null` si no hay. */
export function busiestWeekday(values: Record<string, number>): number | null {
  const totals = Array(7).fill(0) as number[];
  let any = false;
  for (const [d, v] of Object.entries(values))
    if (valid(d) && v > 0) {
      totals[parse(d).getUTCDay()]! += v;
      any = true;
    }
  if (!any) return null;
  return totals.indexOf(Math.max(...totals));
}

/** Suma de los valores dentro de `[from, to]`. */
export function heatmapTotal(values: Record<string, number>, from: string, to: string): number {
  let total = 0;
  for (const [d, v] of Object.entries(values)) if (d >= from && d <= to && Number.isFinite(v) && v > 0) total += v;
  return total;
}

/* ---------- Hábitos ---------- */

export type HabitState = "done" | "missed" | "rest" | { progress: number };

export interface HabitStreak {
  /** Días cumplidos seguidos hasta hoy (el descanso no la rompe ni suma; hoy en curso no la rompe). */
  current: number;
  longest: number;
  /** Fechas que dibujan la banda de la racha actual (incluidos los descansos intermedios). */
  run: string[];
}

const isDone = (s: HabitState | undefined) => s === "done" || (typeof s === "object" && s !== null && s.progress >= 100);

/** Racha de hábitos: cumplido suma, descanso no suma ni rompe, fallado o vacío (en el pasado) rompe; hoy sin
 *  cumplir aún (en curso o vacío) no rompe la racha. */
export function habitStreak(states: Record<string, HabitState>, today: string): HabitStreak {
  const keys = Object.keys(states)
    .filter((d) => valid(d) && d <= today)
    .sort();
  const pending = (d: string) => d === today && !isDone(states[d]) && states[d] !== "missed";
  let longest = 0;
  let count = 0;
  if (keys.length)
    for (let d = keys[0]!; d <= today; d = addDays(d, 1)) {
      const s = states[d];
      if (isDone(s)) count++;
      else if (s !== "rest" && !pending(d)) count = 0;
      longest = Math.max(longest, count);
    }
  let current = 0;
  const run: string[] = [];
  for (let d = pending(today) ? addDays(today, -1) : today, i = 0; i < 3660; i++, d = addDays(d, -1)) {
    const s = states[d];
    if (isDone(s)) {
      current++;
      run.push(d);
    } else if (s === "rest") run.push(d);
    else break;
  }
  // La banda empieza y acaba en un día cumplido.
  while (run.length && !isDone(states[run[run.length - 1]!])) run.pop();
  while (run.length && !isDone(states[run[0]!])) run.shift();
  return { current, longest, run: run.reverse() };
}
