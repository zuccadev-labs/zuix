// Franjas de cita (SlotPicker): el anfitrión publica disponibilidad en su zona y el visitante la ve en la suya. Los
// días del calendario del visitante se calculan tras convertir (una franja de las 00:30 del anfitrión puede caer el
// día anterior del visitante). Instantes en milisegundos; horas con `Intl` y el ciclo de 12 o 24 h. Puro.

import { addDays, parse, valid } from "./date";
import { fmt } from "./vnode";
import { fromWall, toWall } from "./zone";

export interface Availability {
  /** Días de la semana del anfitrión (0 domingo … 6 sábado). */
  days: number[];
  /** `HH:mm` en la zona del anfitrión. */
  start: string;
  end: string;
}

export type HourCycle = "h12" | "h23";

const clock = (t: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/**
 * Instantes de inicio de franjas de `duration` minutos (cada `step`, por defecto la duración) dentro de la
 * disponibilidad del anfitrión, para las fechas del anfitrión `[from, to]`, sin las que pisan `busy` ni las anteriores
 * a `notBefore`.
 */
export function availabilitySlots(
  availability: Availability[],
  hostTimeZone: string,
  from: string,
  to: string,
  duration: number,
  options: { step?: number; busy?: { start: number; end: number }[]; notBefore?: number } = {},
): number[] {
  if (!valid(from) || !valid(to) || to < from || duration <= 0) return [];
  const step = Math.max(1, options.step ?? duration);
  const out: number[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const wd = parse(d).getUTCDay();
    for (const a of availability) {
      if (!a.days.includes(wd)) continue;
      const s = clock(a.start);
      const e = clock(a.end);
      if (s === null || e === null) continue;
      for (let m = s; m + duration <= e; m += step) {
        const ms = fromWall({ date: d, hour: Math.floor(m / 60), minute: m % 60, second: 0 }, hostTimeZone);
        if (ms === null) continue;
        const end = ms + duration * 60_000;
        if (options.notBefore !== undefined && ms < options.notBefore) continue;
        if (options.busy?.some((b) => b.start < end && b.end > ms)) continue;
        out.push(ms);
      }
    }
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

/** Franjas agrupadas por fecha del visitante (`YYYY-MM-DD` en `timeZone`), ordenadas. */
export function slotsByDay(slots: (string | number)[], timeZone: string): Map<string, number[]> {
  const out = new Map<string, number[]>();
  const sorted = slots
    .map((s) => (typeof s === "number" ? s : Date.parse(s)))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  for (const ms of sorted) {
    const date = toWall(ms, timeZone).date;
    const list = out.get(date) ?? [];
    if (list[list.length - 1] !== ms) list.push(ms);
    out.set(date, list);
  }
  return out;
}

/** Hora de una franja en la zona del visitante, en 12 o 24 h (por defecto, la del locale). */
export function slotLabel(ms: number, timeZone: string, locale?: string, hourCycle?: HourCycle): string {
  const options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  if (hourCycle) {
    options.hourCycle = hourCycle;
    if (hourCycle === "h12") options.hour = "numeric";
  }
  return fmt(locale, options, timeZone).format(ms);
}

/** Ciclo horario por defecto del locale. */
export function localeHourCycle(locale?: string): HourCycle {
  try {
    const cycle = new Intl.DateTimeFormat(locale, { hour: "numeric" }).resolvedOptions().hourCycle;
    return cycle === "h11" || cycle === "h12" ? "h12" : "h23";
  } catch {
    return "h23";
  }
}
