// «Buscar hueco»: unión de los ocupados de cada persona, sus horas de trabajo en su propia zona, la intersección de
// los libres y las franjas comunes de una duración. Trabaja con instantes (milisegundos): una reunión ocurre a la vez
// para todos. Puro, sin documento.

import { addDays, parse, valid } from "./date";
import { fromWall, toWall } from "./zone";

export interface Interval {
  start: number;
  end: number;
}

export interface WorkingHours {
  /** Días de la semana (0 domingo … 6 sábado). Por defecto, de lunes a viernes. */
  days?: number[];
  /** `HH:mm` en la zona de la persona. */
  start: string;
  end: string;
}

export interface Attendee {
  id: string;
  name: string;
  /** Zona IANA de la persona (para sus horas de trabajo). */
  timeZone?: string;
  /** Ocupados: instantes ISO o milisegundos. */
  busy: { start: string | number; end: string | number }[];
  workingHours?: WorkingHours | null;
  /** No hace falta que esté libre (aparece, pero no limita las franjas). */
  optional?: boolean;
}

const MIN = 60_000;
export const toMs = (v: string | number) => (typeof v === "number" ? v : Date.parse(v));

/** Ordena y une intervalos que se solapan o se tocan. Quita los vacíos o inválidos. */
export function mergeIntervals(list: Interval[]): Interval[] {
  const sorted = list.filter((i) => Number.isFinite(i.start) && Number.isFinite(i.end) && i.end > i.start).sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ ...i });
  }
  return out;
}

/** `base` menos `remove` (los dos se unen antes). */
export function subtractIntervals(base: Interval[], remove: Interval[]): Interval[] {
  const cut = mergeIntervals(remove);
  const out: Interval[] = [];
  for (const b of mergeIntervals(base)) {
    let cursor = b.start;
    for (const r of cut) {
      if (r.end <= cursor || r.start >= b.end) continue;
      if (r.start > cursor) out.push({ start: cursor, end: r.start });
      cursor = Math.max(cursor, r.end);
    }
    if (cursor < b.end) out.push({ start: cursor, end: b.end });
  }
  return out;
}

/** Intersección de dos listas de intervalos. */
export function intersectIntervals(a: Interval[], b: Interval[]): Interval[] {
  const x = mergeIntervals(a);
  const y = mergeIntervals(b);
  const out: Interval[] = [];
  let i = 0;
  let j = 0;
  while (i < x.length && j < y.length) {
    const start = Math.max(x[i]!.start, y[j]!.start);
    const end = Math.min(x[i]!.end, y[j]!.end);
    if (end > start) out.push({ start, end });
    if (x[i]!.end < y[j]!.end) i++;
    else j++;
  }
  return out;
}

const clock = (t: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  return m ? { hour: Number(m[1]), minute: Number(m[2]) } : null;
};

/** Horas de trabajo de una persona, como instantes, en `[from, to)`. Sin horario: todo el rango. */
export function workingIntervals(hours: WorkingHours | null | undefined, timeZone: string, from: number, to: number): Interval[] {
  if (!hours) return [{ start: from, end: to }];
  const a = clock(hours.start);
  const b = clock(hours.end);
  if (!a || !b) return [{ start: from, end: to }];
  const days = new Set(hours.days ?? [1, 2, 3, 4, 5]);
  const out: Interval[] = [];
  // Fechas del reloj de la persona que tocan el rango (un día de margen a cada lado por las zonas).
  let d = addDays(toWall(from, timeZone).date, -1);
  const last = addDays(toWall(to, timeZone).date, 1);
  for (; d <= last; d = addDays(d, 1)) {
    if (!valid(d) || !days.has(parse(d).getUTCDay())) continue;
    const start = fromWall({ date: d, hour: a.hour, minute: a.minute, second: 0 }, timeZone);
    const endDay = b.hour * 60 + b.minute <= a.hour * 60 + a.minute ? addDays(d, 1) : d;
    const end =
      b.hour === 24
        ? fromWall({ date: addDays(d, 1), hour: 0, minute: 0, second: 0 }, timeZone)
        : fromWall({ date: endDay, hour: b.hour, minute: b.minute, second: 0 }, timeZone);
    if (start === null || end === null) continue;
    out.push({ start: Math.max(start, from), end: Math.min(end, to) });
  }
  return mergeIntervals(out);
}

/** Ocupados de una persona, unidos y en milisegundos. */
export const busyOf = (a: Attendee): Interval[] => mergeIntervals(a.busy.map((b) => ({ start: toMs(b.start), end: toMs(b.end) })));

/** Libres de una persona en `[from, to)`: sus horas de trabajo menos sus ocupados. */
export function freeOf(a: Attendee, from: number, to: number, fallbackZone = "UTC"): Interval[] {
  return subtractIntervals(workingIntervals(a.workingHours, a.timeZone ?? fallbackZone, from, to), busyOf(a));
}

/** Libre común de los asistentes obligatorios en `[from, to)`. */
export function commonFree(attendees: Attendee[], from: number, to: number, fallbackZone = "UTC"): Interval[] {
  let free: Interval[] = [{ start: from, end: to }];
  for (const a of attendees) if (!a.optional) free = intersectIntervals(free, freeOf(a, from, to, fallbackZone));
  return free;
}

/**
 * Franjas de `duration` minutos dentro del libre común, alineadas a `step` minutos (desde la época, que es la hora en
 * punto en las zonas de desfase entero). Como mucho `limit`.
 */
export function findSlots(
  attendees: Attendee[],
  from: number,
  to: number,
  duration: number,
  options: { step?: number; limit?: number; fallbackZone?: string } = {},
): Interval[] {
  const step = Math.max(1, options.step ?? 15) * MIN;
  const length = Math.max(1, duration) * MIN;
  const limit = options.limit ?? 50;
  const out: Interval[] = [];
  for (const window of commonFree(attendees, from, to, options.fallbackZone)) {
    for (let s = Math.ceil(window.start / step) * step; s + length <= window.end && out.length < limit; s += step)
      out.push({ start: s, end: s + length });
    if (out.length >= limit) break;
  }
  return out;
}

/** Primera franja común, o `null`. */
export const firstSlot = (attendees: Attendee[], from: number, to: number, duration: number, options: { step?: number; fallbackZone?: string } = {}) =>
  findSlots(attendees, from, to, duration, { ...options, limit: 1 })[0] ?? null;
