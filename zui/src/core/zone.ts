// Zonas horarias sin Temporal obligatorio: instante ↔ reloj de pared de una zona IANA. Un evento con hora es un
// instante (la reunión ocurre a la vez para todos); la rejilla de la agenda es de reloj de pared en la zona de
// presentación. Excepción explícita a la regla de `fecha-y-hora.md` («formatToParts solo para presentación»): sin
// Temporal no hay otra API para leer la hora de una zona ajena. Si `globalThis.Temporal` existe se usa, y el
// resultado es el mismo (pruebas cruzadas en tests/unit). Sin documento ni efectos al importar.

import { pad } from "./date";

/** Qué hacer con una hora que no existe (salto adelante) o que se repite (salto atrás), como en Temporal. */
export type Disambiguation = "compatible" | "earlier" | "later" | "reject";

/** Reloj de pared: fecha civil y hora, con los minutos del día. */
export interface Wall {
  date: string;
  hour: number;
  minute: number;
  second: number;
}

const MINUTE = 60_000;
const DAY = 86_400_000;

interface TemporalLike {
  Instant: { fromEpochMilliseconds(ms: number): { toZonedDateTimeISO(tz: string): ZonedLike } };
  ZonedDateTime: { from(item: object, options?: object): ZonedLike };
}
interface ZonedLike {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  epochMilliseconds: number;
}
const temporal = (): TemporalLike | null => {
  const t = (globalThis as { Temporal?: TemporalLike }).Temporal;
  return t?.Instant && t.ZonedDateTime ? t : null;
};
/** Solo para pruebas: desactiva Temporal para comparar las dos rutas. */
let useTemporal = true;
export function _setTemporal(on: boolean): void {
  useTemporal = on;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      era: "short",
    });
    formatters.set(tz, f);
  }
  return f;
}

/** Zona del dispositivo (IANA). */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Verdadero si `tz` es una zona IANA (o `UTC`) que el entorno conoce. */
export function validTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    formatter(tz);
    return true;
  } catch {
    return false;
  }
}

/** Zona válida o la del dispositivo. */
export const safeTimeZone = (tz: string | null | undefined) => (validTimeZone(tz) ? tz : deviceTimeZone());

/** Instante (ms) → reloj de pared en `tz`. */
export function toWall(ms: number, tz: string): Wall {
  const T = useTemporal ? temporal() : null;
  if (T) {
    const z = T.Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO(tz);
    return { date: `${pad(z.year, 4)}-${pad(z.month)}-${pad(z.day)}`, hour: z.hour, minute: z.minute, second: z.second };
  }
  const parts: Record<string, string> = {};
  for (const p of formatter(tz).formatToParts(ms)) parts[p.type] = p.value;
  let year = Number(parts.year);
  if (parts.era === "BC" || parts.era === "B") year = 1 - year;
  return {
    date: `${pad(year, 4)}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** Reloj de pared tomado como si fuera UTC (ms): la base para medir desfases. */
const wallAsUTC = (w: Wall) => {
  const d = new Date(0);
  d.setUTCFullYear(Number(w.date.slice(0, 4)), Number(w.date.slice(5, 7)) - 1, Number(w.date.slice(8, 10)));
  d.setUTCHours(w.hour, w.minute, w.second, 0);
  return d.getTime();
};

/** Desfase de `tz` en el instante `ms`, en minutos (reloj − UTC): +60 en Madrid en invierno. */
export function offsetAt(ms: number, tz: string): number {
  const whole = Math.floor(ms / 1000) * 1000;
  return Math.round((wallAsUTC(toWall(whole, tz)) - whole) / MINUTE);
}

const sameWall = (a: Wall, b: Wall) => a.date === b.date && a.hour === b.hour && a.minute === b.minute && a.second === b.second;

/** Estado de un reloj de pared en `tz`: existe una vez, no existe (salto) o existe dos veces (repetido). */
export function wallStatus(wall: Wall, tz: string): "ok" | "gap" | "overlap" {
  const local = wallAsUTC(wall);
  const hits = new Set<number>();
  for (const o of [offsetAt(local - DAY, tz), offsetAt(local + DAY, tz)]) {
    const t = local - o * MINUTE;
    if (sameWall(toWall(t, tz), wall)) hits.add(t);
  }
  return hits.size === 0 ? "gap" : hits.size === 2 ? "overlap" : "ok";
}

/**
 * Reloj de pared en `tz` → instante (ms), con dos pasadas de desfase: el de un día antes y el de un día después.
 * `compatible` (por defecto, como Temporal): la hora saltada avanza lo que dura el salto; la repetida toma la
 * primera. `null` solo con `reject` y una hora que no existe o se repite.
 */
export function fromWall(wall: Wall, tz: string, disambiguation: Disambiguation = "compatible"): number | null {
  const T = useTemporal ? temporal() : null;
  if (T) {
    try {
      return T.ZonedDateTime.from(
        {
          timeZone: tz,
          year: Number(wall.date.slice(0, 4)),
          month: Number(wall.date.slice(5, 7)),
          day: Number(wall.date.slice(8, 10)),
          hour: wall.hour,
          minute: wall.minute,
          second: wall.second,
        },
        { disambiguation, overflow: "reject" },
      ).epochMilliseconds;
    } catch {
      return null;
    }
  }
  const local = wallAsUTC(wall);
  const before = offsetAt(local - DAY, tz);
  const after = offsetAt(local + DAY, tz);
  const candidates = [...new Set([local - before * MINUTE, local - after * MINUTE])].sort((a, b) => a - b);
  const valid = candidates.filter((t) => sameWall(toWall(t, tz), wall));
  if (valid.length === 1) return valid[0]!;
  if (valid.length > 1) {
    if (disambiguation === "reject") return null;
    return disambiguation === "later" ? valid[valid.length - 1]! : valid[0]!;
  }
  // Hora que no existe: el salto va de `before` a `after` (normalmente after > before).
  if (disambiguation === "reject") return null;
  const forward = local - before * MINUTE; // con el desfase de antes: cae después del salto
  const backward = local - after * MINUTE;
  return disambiguation === "earlier" ? Math.min(forward, backward) : Math.max(forward, backward);
}

/* ---------- Texto ISO ---------- */

const DATE_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

/** Lee `YYYY-MM-DDTHH:mm[:ss][Z|±hh:mm]`: el reloj escrito y, si lo lleva, el desfase en minutos. */
export function parseDateTime(text: string | null | undefined): { wall: Wall; offset: number | null } | null {
  const m = typeof text === "string" ? DATE_TIME.exec(text) : null;
  if (!m) return null;
  const wall = { date: m[1]!, hour: Number(m[2]), minute: Number(m[3]), second: Number(m[4] ?? 0) };
  if (wall.hour > 23 || wall.minute > 59 || wall.second > 59) return null;
  let offset: number | null = null;
  if (m[5]) {
    if (m[5] === "Z") offset = 0;
    else {
      const sign = m[5][0] === "-" ? -1 : 1;
      const digits = m[5].slice(1).replace(":", "");
      offset = sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2, 4)));
    }
  }
  return { wall, offset };
}

/** Reloj → `YYYY-MM-DDTHH:mm` (con `:ss` si los segundos no son cero o se piden). */
export const wallText = (w: Wall, seconds = false) =>
  `${w.date}T${pad(w.hour)}:${pad(w.minute)}${seconds || w.second ? `:${pad(w.second)}` : ""}`;

/** Instante (ms) → ISO UTC sin milisegundos (`2026-11-19T09:00:00Z`). */
export const instantText = (ms: number) => new Date(Math.round(ms / 1000) * 1000).toISOString().replace(".000Z", "Z");

/** Nombre corto de la zona en un instante («GMT+1», «CET»…), para la barra de la agenda. */
export function zoneLabel(tz: string, ms: number, locale?: string, style: "shortOffset" | "short" | "long" = "shortOffset"): string {
  try {
    const parts = new Intl.DateTimeFormat(locale, { timeZone: tz, timeZoneName: style }).formatToParts(ms);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
  } catch {
    return tz;
  }
}

/** Ciudad de una zona IANA para la interfaz: `Europe/Madrid` → «Madrid», `America/New_York` → «New York». */
export const zoneCity = (tz: string) => (tz.split("/").pop() ?? tz).replace(/_/g, " ");
