// Relojes: ángulos de las agujas y geometría de la esfera (marcas y números) en un lienzo de 100 × 100, texto del
// reloj digital por partes (para que los separadores puedan latir sin tocar las cifras), diferencia con otra zona
// («+6 h», «mañana») y día o noche aproximado por la hora local. Las horas de pared salen de `toWall` (core/zone).
// Puro y sin documento.

import { offsetAt, safeTimeZone, toWall, type Wall } from "./zone";
import { safeLocale } from "./date";
import { fmt } from "./vnode";

export interface HandAngles {
  hour: number;
  minute: number;
  second: number;
}

/** Ángulos en grados desde las 12, en el sentido de las agujas. `smooth` reparte también los milisegundos. */
export function handAngles(wall: Pick<Wall, "hour" | "minute" | "second">, ms = 0, smooth = false): HandAngles {
  const seconds = wall.second + (smooth ? (((ms % 1000) + 1000) % 1000) / 1000 : 0);
  return {
    hour: ((wall.hour % 12) + wall.minute / 60 + seconds / 3600) * 30,
    minute: (wall.minute + seconds / 60) * 6,
    second: seconds * 6,
  };
}

export interface FaceMark {
  angle: number;
  /** Marca de hora (más larga y gruesa). */
  major: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface FaceNumeral {
  value: number;
  x: number;
  y: number;
}

const round = (n: number) => Math.round(n * 100) / 100;
/** Punto a `r` del centro (50, 50) con el ángulo del reloj. */
export function polar(angle: number, r: number): { x: number; y: number } {
  const rad = (angle * Math.PI) / 180;
  return { x: round(50 + r * Math.sin(rad)), y: round(50 - r * Math.cos(rad)) };
}

/** Marcas de la esfera: las 12 horas, o los 60 minutos con las horas destacadas. */
export function faceMarks(kind: "hours" | "minutes" | "none", radius = 46): FaceMark[] {
  if (kind === "none") return [];
  const count = kind === "minutes" ? 60 : 12;
  return Array.from({ length: count }, (_, i) => {
    const angle = (360 / count) * i;
    const major = kind === "hours" || i % 5 === 0;
    const inner = radius - (major ? 6 : 3);
    const a = polar(angle, inner);
    const b = polar(angle, radius);
    return { angle, major, x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  });
}

/** Números de la esfera: ninguno, los cuartos (12, 3, 6, 9) o los doce. */
export function faceNumerals(kind: "none" | "quarters" | "all", radius = 34): FaceNumeral[] {
  if (kind === "none") return [];
  const values = kind === "quarters" ? [12, 3, 6, 9] : Array.from({ length: 12 }, (_, i) => i + 1);
  return values.map((value) => ({ value, ...polar((value % 12) * 30, radius) }));
}

/** Instante → reloj de pared en la zona (válida o la del dispositivo). */
export const wallAt = (ms: number, timeZone?: string | null): Wall => toWall(ms, safeTimeZone(timeZone));

export interface ClockFormat {
  timeZone?: string | null;
  locale?: string;
  /** Ciclo horario: `h12`/`h23`; por defecto el del locale. */
  hourCycle?: "h11" | "h12" | "h23" | "h24";
  seconds?: boolean;
}

export interface ClockPart {
  type: "hour" | "minute" | "second" | "dayPeriod" | "separator" | "literal";
  value: string;
}

/** Texto del reloj digital en partes: cifras, separadores (`:`), periodo del día y literales. */
export function clockParts(ms: number, options: ClockFormat = {}): ClockPart[] {
  const tz = safeTimeZone(options.timeZone);
  const locale = safeLocale(options.locale);
  const f = fmt(
    locale,
    {
      hour: "2-digit",
      minute: "2-digit",
      ...(options.seconds ? { second: "2-digit" } : {}),
      ...(options.hourCycle ? { hourCycle: options.hourCycle } : {}),
    },
    tz,
  );
  return f.formatToParts(ms).map((p) => {
    if (p.type === "hour" || p.type === "minute" || p.type === "second" || p.type === "dayPeriod") return { type: p.type, value: p.value };
    return { type: /^[\s ]*[:.٫]?[\s ]*$/.test(p.value) && /[:.٫]/.test(p.value) ? "separator" : "literal", value: p.value };
  });
}

/** Texto completo del reloj (lo que lee un lector de pantalla): «10:42», «10:42:07 AM». */
export const clockText = (ms: number, options: ClockFormat = {}) =>
  clockParts(ms, options)
    .map((p) => p.value)
    .join("");

/** Fecha del reloj («Saturday, 21 November») en la zona. */
export function clockDate(ms: number, options: ClockFormat & { date?: Intl.DateTimeFormatOptions } = {}): string {
  const tz = safeTimeZone(options.timeZone);
  return fmt(safeLocale(options.locale), options.date ?? { weekday: "long", day: "numeric", month: "long" }, tz).format(ms);
}

/** Instante en ISO con el desfase de la zona (`2026-11-21T10:42:07+01:00`), para `<time datetime>`. */
export function zonedISO(ms: number, timeZone?: string | null, seconds = true): string {
  const tz = safeTimeZone(timeZone);
  const w = toWall(ms, tz);
  const off = offsetAt(ms, tz);
  const p = (n: number) => String(n).padStart(2, "0");
  const sign = off < 0 ? "-" : "+";
  const abs = Math.abs(off);
  const zone = off === 0 ? "Z" : `${sign}${p(Math.floor(abs / 60))}:${p(abs % 60)}`;
  return `${w.date}T${p(w.hour)}:${p(w.minute)}${seconds ? `:${p(w.second)}` : ""}${zone}`;
}

export interface ZoneDifference {
  /** Minutos de la zona menos los de la referencia: +360 es «seis horas más». */
  minutes: number;
  /** Día de la zona frente al de la referencia: -1 ayer, 0 hoy, +1 mañana. */
  day: -1 | 0 | 1;
}

/** Diferencia horaria y de día de `timeZone` frente a `reference` en el instante `ms`. */
export function zoneDifference(ms: number, timeZone: string, reference?: string | null): ZoneDifference {
  const tz = safeTimeZone(timeZone);
  const ref = safeTimeZone(reference);
  const minutes = offsetAt(ms, tz) - offsetAt(ms, ref);
  const a = toWall(ms, tz).date;
  const b = toWall(ms, ref).date;
  return { minutes, day: a === b ? 0 : a > b ? 1 : -1 };
}

/** Diferencia corta y tabular: «+6 h», «−3 h 30 min», «±0». */
export function differenceText(minutes: number, locale?: string): string {
  if (minutes === 0) return "±0";
  const sign = minutes > 0 ? "+" : "−";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const unit = (value: number, name: "hour" | "minute") => {
    try {
      return new Intl.NumberFormat(safeLocale(locale), { style: "unit", unit: name, unitDisplay: "short" }).format(value);
    } catch {
      return `${value} ${name === "hour" ? "h" : "min"}`;
    }
  };
  return `${sign}${[h ? unit(h, "hour") : "", m ? unit(m, "minute") : ""].filter(Boolean).join(" ")}`;
}

/** Diferencia hablada («6 hours», «3 hours, 30 minutes»), sin signo: el sentido lo pone la etiqueta. */
export function differenceSpoken(minutes: number, locale?: string): string {
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const unit = (value: number, name: "hour" | "minute") => {
    try {
      return new Intl.NumberFormat(safeLocale(locale), { style: "unit", unit: name, unitDisplay: "long" }).format(value);
    } catch {
      return `${value} ${name}${value === 1 ? "" : "s"}`;
    }
  };
  const items = [h ? unit(h, "hour") : "", m ? unit(m, "minute") : ""].filter(Boolean);
  try {
    return new Intl.ListFormat(safeLocale(locale), { style: "long", type: "unit" }).format(items);
  } catch {
    return items.join(", ");
  }
}

/** Día o noche aproximado por la hora local, sin datos solares: de 7 a 19 h es de día. */
export const isDaytime = (hour: number) => hour >= 7 && hour < 19;
