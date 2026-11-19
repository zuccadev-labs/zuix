// Timer: cuenta atrás y cronómetro. Reloj puro (milisegundos acumulados más el instante en que empezó a correr), texto
// de la pantalla, texto hablado y cuándo anunciar. Sin documento ni temporizadores: los pone quien lo usa (React o
// zui/dom). La región viva solo recibe hitos (inicio, pausa, cada `announceEvery` segundos, los últimos diez, fin):
// actualizarla cada segundo inundaría al lector de pantalla.

export type TimerMode = "countdown" | "stopwatch";
export type TimerState = "idle" | "running" | "paused" | "done";
export type TimerPrecision = "second" | "tenth";

/** Reloj: lo acumulado en pausas anteriores y, si corre, desde cuándo. */
export interface TimerClock {
  accumulated: number;
  startedAt: number | null;
}

export const idleClock = (): TimerClock => ({ accumulated: 0, startedAt: null });

/** Milisegundos transcurridos en `now`. */
export const elapsedOf = (clock: TimerClock, now: number) =>
  Math.max(0, clock.accumulated + (clock.startedAt === null ? 0 : now - clock.startedAt));

export function startClock(clock: TimerClock, now: number): TimerClock {
  return clock.startedAt === null ? { accumulated: clock.accumulated, startedAt: now } : clock;
}

export function pauseClock(clock: TimerClock, now: number): TimerClock {
  return clock.startedAt === null ? clock : { accumulated: elapsedOf(clock, now), startedAt: null };
}

/** Lo que muestra la pantalla: lo que queda (cuenta atrás, nunca negativo) o lo transcurrido (cronómetro). */
export function shownMs(mode: TimerMode, durationMs: number, elapsed: number): number {
  return mode === "countdown" ? Math.max(0, durationMs - elapsed) : elapsed;
}

/**
 * Unidad que se muestra redondeada: la cuenta atrás redondea hacia arriba (con 0,4 s quedan «00:01», y llega a
 * «00:00» justo al terminar); el cronómetro, hacia abajo.
 */
function units(ms: number, mode: TimerMode, precision: TimerPrecision): number {
  const size = precision === "tenth" ? 100 : 1000;
  return mode === "countdown" ? Math.ceil(ms / size - 1e-9) : Math.floor(ms / size + 1e-9);
}

export interface DurationParts {
  hours: number;
  minutes: number;
  seconds: number;
  tenths: number;
}

export function durationParts(ms: number, mode: TimerMode = "stopwatch", precision: TimerPrecision = "second"): DurationParts {
  const n = units(Math.max(0, ms), mode, precision);
  const tenths = precision === "tenth" ? n % 10 : 0;
  const total = precision === "tenth" ? Math.floor(n / 10) : n;
  return { hours: Math.floor(total / 3600), minutes: Math.floor((total % 3600) / 60), seconds: total % 60, tenths };
}

const two = (n: number) => String(n).padStart(2, "0");

/** Texto de la pantalla: `mm:ss`, `h:mm:ss` desde una hora (o siempre con `hours`), con décimas `mm:ss.d`. Cifras
 *  del locale con `Intl.NumberFormat`. */
export function timerText(
  ms: number,
  options: { mode?: TimerMode; precision?: TimerPrecision; hours?: boolean; locale?: string; separator?: string } = {},
): string {
  const { mode = "stopwatch", precision = "second", separator = ":" } = options;
  const p = durationParts(ms, mode, precision);
  let text =
    p.hours || options.hours
      ? `${p.hours}${separator}${two(p.minutes)}${separator}${two(p.seconds)}`
      : `${two(p.minutes)}${separator}${two(p.seconds)}`;
  if (precision === "tenth") text += `.${p.tenths}`;
  if (!options.locale) return text;
  let digits: string[];
  try {
    const nf = new Intl.NumberFormat(options.locale, { useGrouping: false });
    digits = Array.from({ length: 10 }, (_, i) => nf.format(i));
  } catch {
    return text;
  }
  return text.replace(/\d/g, (d) => digits[Number(d)] ?? d);
}

/** Texto hablado: «4 minutes, 30 seconds» con `Intl.DurationFormat` si existe y, si no, unidades de NumberFormat. */
export function spokenDuration(ms: number, locale?: string, mode: TimerMode = "stopwatch"): string {
  const p = durationParts(ms, mode, "second");
  const duration = { hours: p.hours, minutes: p.minutes, seconds: p.seconds };
  const DF = (Intl as unknown as { DurationFormat?: new (l?: string, o?: object) => { format(d: object): string } }).DurationFormat;
  if (DF) {
    try {
      const text = new DF(locale, { style: "long" }).format(duration);
      if (text) return text;
    } catch {
      // Locale no admitido: respaldo.
    }
  }
  const parts: string[] = [];
  const unit = (value: number, name: "hour" | "minute" | "second") => {
    try {
      return new Intl.NumberFormat(locale, { style: "unit", unit: name, unitDisplay: "long" }).format(value);
    } catch {
      return `${value} ${name}${value === 1 ? "" : "s"}`;
    }
  };
  if (p.hours) parts.push(unit(p.hours, "hour"));
  if (p.minutes) parts.push(unit(p.minutes, "minute"));
  if (p.seconds || !parts.length) parts.push(unit(p.seconds, "second"));
  try {
    return new Intl.ListFormat(locale, { style: "long", type: "unit" }).format(parts);
  } catch {
    return parts.join(", ");
  }
}

/** Milisegundos hasta que cambia lo que se muestra (lo que debe esperar el siguiente repintado). */
export function nextTick(mode: TimerMode, durationMs: number, elapsed: number, precision: TimerPrecision = "second"): number {
  const size = precision === "tenth" ? 100 : 1000;
  if (mode === "countdown") {
    const left = Math.max(0, durationMs - elapsed);
    if (left === 0) return 0;
    const rest = left % size;
    return rest === 0 ? size : rest;
  }
  return size - (elapsed % size);
}

/**
 * ¿Hay que anunciar al pasar de `before` a `after` (milisegundos mostrados)? Cuenta atrás: al cruzar un múltiplo de
 * `every` segundos y en cada uno de los últimos `final` segundos; cronómetro: al cruzar un múltiplo de `every`.
 * `every` 0 desactiva los hitos periódicos. Devuelve los segundos del hito o `null`.
 */
export function milestone(mode: TimerMode, before: number, after: number, every = 60, final = 0): number | null {
  const a = units(before, mode, "second");
  const b = units(after, mode, "second");
  if (a === b) return null;
  if (mode === "countdown") {
    if (b >= a || b <= 0) return null; // el fin se anuncia aparte
    if (b <= final) return b;
    // Hay un múltiplo de `every` en [b, a): se cruzó (también tras un salto de una pestaña oculta).
    const m = every > 0 ? Math.floor((a - 1) / every) * every : 0;
    return m > 0 && m >= b ? b : null;
  }
  if (every > 0 && b > a && Math.floor(b / every) > Math.floor(a / every)) return b;
  return null;
}

/** Duración: segundos (número) o ISO 8601 `PT#H#M#S` (atributo `data-duration`). En milisegundos; 0 si no vale. */
export function parseDuration(value: number | string | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value * 1000 : 0;
  if (typeof value !== "string") return 0;
  const trimmed = value.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed) * 1000;
  const m = /^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/i.exec(trimmed);
  if (!m || trimmed.toUpperCase() === "PT") return 0;
  return Math.round(((Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0)) * 60 + Number(m[3] ?? 0)) * 1000);
}

/** Duración en ISO 8601 (`PT4M30S`) para el atributo `datetime` de `<time>`. */
export function isoDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}${s || (!h && !m) ? `${s}S` : ""}`;
}
