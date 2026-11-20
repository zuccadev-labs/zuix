// Modelo de la agenda: eventos en el tiempo, lo que comparten el binding de React y el modo DOM. Todo se calcula en
// «minutos de pared» de la zona de presentación (minutos desde 1970-01-01T00:00 del reloj de esa zona): la rejilla
// de horas es de reloj de pared, así que un evento se coloca por lo que marca el reloj, y un día de 23 o 25 horas no
// deja huecos ni filas de más. Los eventos de todo el día son fechas civiles y nunca se convierten de zona.
// Aquí: normalizar y expandir (con core/rrule y core/zone), solapes en columnas, carriles del mes, partir por días,
// ajustar a la rejilla, mover y redimensionar, y devolver la forma ISO que tenía el evento.

import { addDays, addMonths, DAY_MS, diffDays, pad, parse, valid } from "./date";
import { expandDates, parseRRule } from "./rrule";
import { fromWall, instantText, parseDateTime, toWall, wallStatus, wallText, type Wall } from "./zone";

/** Color de un calendario: entrada de paleta `"1"`…`"6"` o un token semántico. Nunca un literal. */
export type CalendarColor = "1" | "2" | "3" | "4" | "5" | "6" | "accent" | "info" | "success" | "warning" | "danger" | "neutral";

export interface CalendarEvent {
  id: string;
  title: string;
  /** `YYYY-MM-DD` (todo el día), `YYYY-MM-DDTHH:mm[:ss]` (con `timeZone` o flotante) o ISO con `Z`/desfase. */
  start: string;
  /** Exclusivo, como iCalendar: un todo el día del 19 termina el 20. */
  end: string;
  allDay?: boolean;
  /** Zona IANA de `start`/`end` con hora y sin desfase. */
  timeZone?: string;
  calendarId: string;
  color?: CalendarColor;
  kind?: "event" | "task" | "milestone";
  status?: "confirmed" | "tentative" | "cancelled";
  done?: boolean;
  location?: string;
  url?: string;
  rrule?: string;
  exdate?: string[];
  /** En una excepción: el inicio de la ocurrencia original que sustituye (misma forma que `start`). */
  recurrenceId?: string;
  /** Serie a la que pertenece una excepción. */
  seriesId?: string;
  /** Recursos (salas, personas) que ocupa: filas de la vista de recursos. */
  resourceIds?: string[];
  editable?: boolean;
  startEditable?: boolean;
  durationEditable?: boolean;
  data?: unknown;
}

export interface CalendarSource {
  id: string;
  name: string;
  color: CalendarColor;
  visible?: boolean;
  editable?: boolean;
}

/** Ocurrencia lista para pintar: un evento suelto o una de su serie. */
export interface Occurrence {
  /** `id` del evento, o `"<id>::<inicio>"` en una serie. */
  key: string;
  event: CalendarEvent;
  /** Id de la serie (en las ocurrencias de una serie y en sus excepciones). */
  seriesId?: string;
  allDay: boolean;
  /** Minutos de pared en la zona de presentación; `end` exclusivo. */
  start: number;
  end: number;
  /** Inicio y fin escritos en la forma del evento (para emitir cambios de una ocurrencia). */
  startText: string;
  endText: string;
  /** El reloj de inicio o fin cae en una hora repetida (cambio de hora): se dice en el nombre accesible. */
  ambiguous?: boolean;
}

const MIN_PER_DAY = 1440;

/* ---------- Minutos de pared ---------- */

// Memoria de las dos conversiones más usadas al pintar (miles de llamadas por vista); se vacía al llegar al tope.
const dayStarts = new Map<string, number>();
const dates = new Map<number, string>();
/** Fecha civil → minutos de pared de su medianoche. */
export const dayStart = (date: string) => {
  let v = dayStarts.get(date);
  if (v === undefined) {
    if (dayStarts.size > 20_000) dayStarts.clear();
    v = Math.round(parse(date).getTime() / 60_000);
    dayStarts.set(date, v);
  }
  return v;
};
/** Minutos de pared → fecha civil. */
export const dateOf = (min: number) => {
  const day = Math.floor(min / MIN_PER_DAY);
  let v = dates.get(day);
  if (v === undefined) {
    if (dates.size > 20_000) dates.clear();
    const d = new Date(day * DAY_MS);
    v = `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    dates.set(day, v);
  }
  return v;
};
/** Minutos desde la medianoche (0–1439). */
export const minuteOfDay = (min: number) => ((min % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY;
/** Minutos de pared → reloj. */
export const wallOf = (min: number): Wall => {
  const m = minuteOfDay(min);
  return { date: dateOf(min), hour: Math.floor(m / 60), minute: m % 60, second: 0 };
};
const wallMinutes = (w: Wall) => dayStart(w.date) + w.hour * 60 + w.minute + Math.floor(w.second / 60);
/** `HH:mm` → minutos del día (`24:00` → 1440). */
export const clockMinutes = (time: string | null | undefined, fallback = 0) => {
  const m = typeof time === "string" ? /^(\d{1,2}):(\d{2})$/.exec(time) : null;
  if (!m) return fallback;
  const v = Number(m[1]) * 60 + Number(m[2]);
  return v >= 0 && v <= MIN_PER_DAY ? v : fallback;
};
/** Minutos del día → `HH:mm`. */
export const clockText = (minutes: number) => `${pad(Math.floor(minuteOfDay(minutes) / 60))}:${pad(minuteOfDay(minutes) % 60)}`;

/* ---------- Tiempo de un evento ---------- */

type Point = { kind: "date"; date: string } | { kind: "zoned"; ms: number } | { kind: "floating"; wall: Wall };

function readPoint(text: string, timeZone: string | undefined): Point | null {
  if (valid(text)) return { kind: "date", date: text };
  const parsed = parseDateTime(text);
  if (!parsed) return null;
  if (parsed.offset !== null) {
    const asUTC = wallMinutes(parsed.wall) * 60_000 + parsed.wall.second * 1000;
    return { kind: "zoned", ms: asUTC - parsed.offset * 60_000 };
  }
  if (timeZone) {
    const ms = fromWall(parsed.wall, timeZone);
    return ms === null ? null : { kind: "zoned", ms };
  }
  return { kind: "floating", wall: parsed.wall };
}

/** Punto → minutos de pared en `tz` (las fechas, a su medianoche civil, sin convertir). */
function pointMinutes(point: Point, tz: string): { min: number; ambiguous: boolean } {
  if (point.kind === "date") return { min: dayStart(point.date), ambiguous: false };
  if (point.kind === "floating") return { min: wallMinutes(point.wall), ambiguous: false };
  const w = toWall(point.ms, tz);
  return { min: wallMinutes(w), ambiguous: wallStatus(w, tz) === "overlap" };
}

/** Verdadero si el evento es de todo el día (por `allDay` o porque `start` es una fecha). */
export const isAllDay = (event: Pick<CalendarEvent, "start" | "allDay">) => event.allDay ?? valid(event.start);

/** Inicio y fin del evento en minutos de pared de `tz`. `null` si no se puede leer. */
type Span = { start: number; end: number; allDay: boolean; ambiguous: boolean };
/** Memoria por objeto de evento (y su inicio, fin y zona): la agenda vuelve a pintar los mismos eventos. */
const spans = new WeakMap<CalendarEvent, Map<string, Span | null>>();
export function eventSpan(event: CalendarEvent, tz: string): Span | null {
  const key = `${tz}|${event.start}|${event.end}|${event.timeZone ?? ""}|${event.allDay ?? ""}`;
  let byKey = spans.get(event);
  const hit = byKey?.get(key);
  if (hit !== undefined) return hit && { ...hit };
  const span = computeSpan(event, tz);
  if (!byKey) spans.set(event, (byKey = new Map()));
  if (byKey.size > 64) byKey.clear();
  byKey.set(key, span);
  return span && { ...span };
}

function computeSpan(event: CalendarEvent, tz: string): Span | null {
  const allDay = isAllDay(event);
  const a = readPoint(allDay ? event.start.slice(0, 10) : event.start, event.timeZone);
  const b = readPoint(allDay ? event.end.slice(0, 10) : event.end, event.timeZone);
  if (!a) return null;
  const s = pointMinutes(a, tz);
  let end = b ? pointMinutes(b, tz) : null;
  // Todo el día sin fin o con el fin igual al inicio: un día.
  if (allDay && (!end || end.min <= s.min)) end = { min: s.min + MIN_PER_DAY, ambiguous: false };
  if (!end || end.min < s.min) end = { min: s.min, ambiguous: false };
  return { start: s.min, end: end.min, allDay, ambiguous: s.ambiguous || end.ambiguous };
}

/* ---------- Expansión al rango visible ---------- */

export interface ExpandInput {
  events: CalendarEvent[];
  /** Primer y último día visibles (incluidos). */
  from: string;
  to: string;
  /** Zona de presentación. */
  timeZone: string;
  /** Calendarios ocultos: sus eventos no salen. */
  hidden?: Set<string> | string[];
}

/** Desplaza la forma escrita de un punto por los días de diferencia (para el inicio de cada ocurrencia). */
function shiftText(text: string, days: number): string {
  if (!days) return text;
  const date = text.slice(0, 10);
  if (!valid(date)) return text;
  return `${addDays(date, days)}${text.slice(10)}`;
}

/**
 * Ocurrencias que se solapan con `[from, to]` en la zona de presentación, ordenadas por inicio y, a igualdad, por
 * fin descendente. Expande las series (solo en el rango, con margen por la duración), quita `exdate` y las
 * ocurrencias sustituidas por una excepción (`recurrenceId`), y omite los cancelados y los calendarios ocultos.
 */
export function expandEvents({ events, from, to, timeZone, hidden }: ExpandInput): Occurrence[] {
  const off = hidden instanceof Set ? hidden : new Set(hidden ?? []);
  const lo = dayStart(from);
  const hi = dayStart(addDays(to, 1));
  const out: Occurrence[] = [];
  // Excepciones por serie: inicio original sustituido.
  const replaced = new Map<string, Set<string>>();
  for (const e of events) {
    if (e.recurrenceId && e.seriesId) {
      const set = replaced.get(e.seriesId) ?? new Set<string>();
      set.add(e.recurrenceId);
      replaced.set(e.seriesId, set);
    }
  }
  for (const event of events) {
    if (off.has(event.calendarId) || event.status === "cancelled") continue;
    const span = eventSpan(event, timeZone);
    if (!span) continue;
    const rule = event.rrule ? parseRRule(event.rrule) : null;
    if (!rule || event.recurrenceId) {
      if (span.end > lo && span.start < hi) out.push(occurrence(event, event.id, span, event.start, event.end, event.seriesId));
      // Un evento de duración cero en el borde también se ve.
      else if (span.end === span.start && span.start >= lo && span.start < hi)
        out.push(occurrence(event, event.id, span, event.start, event.end, event.seriesId));
      continue;
    }
    // Serie: se expande en fechas del reloj del evento, con margen de la duración para lo que empieza antes.
    const duration = span.end - span.start;
    const startDate = event.start.slice(0, 10);
    const margin = Math.ceil(duration / MIN_PER_DAY) + 1;
    const time = isAllDay(event) ? undefined : (parseDateTime(event.start)?.wall ?? undefined);
    const dates = expandDates(rule, startDate, addDays(from, -margin), addDays(to, 1), {
      time: time ? `${pad(time.hour)}:${pad(time.minute)}:${pad(time.second)}` : undefined,
      untilToWall: (until) => {
        const ms = Date.parse(until);
        const zone = event.timeZone ?? timeZone;
        return Number.isFinite(ms) ? wallText(toWall(ms, zone), true) : until;
      },
    });
    const ex = new Set((event.exdate ?? []).map((d) => d.slice(0, 10)));
    const swapped = replaced.get(event.id);
    for (const date of dates) {
      const days = diffDays(startDate, date);
      const startText = shiftText(event.start, days);
      const endText = shiftText(event.end, days);
      if (ex.has(date) || swapped?.has(startText) || swapped?.has(date)) continue;
      const one = eventSpan({ ...event, start: startText, end: endText }, timeZone);
      if (!one) continue;
      if (one.end > lo && one.start < hi) out.push(occurrence(event, `${event.id}::${startText}`, one, startText, endText, event.id));
    }
  }
  return sortOccurrences(out);
}

function occurrence(
  event: CalendarEvent,
  key: string,
  span: { start: number; end: number; allDay: boolean; ambiguous: boolean },
  startText: string,
  endText: string,
  seriesId?: string,
): Occurrence {
  const o: Occurrence = { key, event, allDay: span.allDay, start: span.start, end: span.end, startText, endText };
  if (seriesId) o.seriesId = seriesId;
  if (span.ambiguous) o.ambiguous = true;
  return o;
}

/** Orden de pintado: inicio y, a igualdad, el más largo primero; después el título (estable). */
export function sortOccurrences<T extends { start: number; end: number; event?: { title: string } }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.start - b.start || b.end - a.end || (a.event?.title ?? "").localeCompare(b.event?.title ?? ""));
}

/** Verdadero si dos intervalos `[start, end)` se solapan (uno de duración cero cuenta como un minuto). */
export const overlaps = (a: { start: number; end: number }, b: { start: number; end: number }) =>
  a.start < Math.max(b.end, b.start + 1) && b.start < Math.max(a.end, a.start + 1);

/* ---------- Días ---------- */

/** Un trozo de una ocurrencia dentro de un día (los que cruzan la medianoche se parten). */
export interface DaySegment<T = Occurrence> {
  item: T;
  date: string;
  /** Minutos dentro del día (0–1440). */
  start: number;
  end: number;
  /** Sigue de un día anterior / continúa en el siguiente. */
  contStart: boolean;
  contEnd: boolean;
}

/** Parte cada ocurrencia en un trozo por día de `days`. Un evento de cero minutos se queda en su día. */
export function splitByDay<T extends { start: number; end: number }>(items: T[], days: string[]): DaySegment<T>[] {
  const out: DaySegment<T>[] = [];
  for (const date of days) {
    const d0 = dayStart(date);
    const d1 = d0 + MIN_PER_DAY;
    for (const item of items) {
      const zero = item.end === item.start;
      if (zero ? item.start >= d0 && item.start < d1 : item.start < d1 && item.end > d0) {
        out.push({
          item,
          date,
          start: Math.max(item.start, d0) - d0,
          end: Math.min(Math.max(item.end, item.start), d1) - d0,
          contStart: item.start < d0,
          contEnd: item.end > d1,
        });
      }
    }
  }
  return out;
}

/* ---------- Solapes en columnas (día y semana) ---------- */

export interface TimedPlacement {
  /** Columna (0…n−1), columnas del grupo y ancho en columnas (se ensancha si la de al lado está libre). */
  col: number;
  n: number;
  w: number;
  /** Empieza a la vez que otro del grupo: va lado a lado también en una columna estrecha. */
  side: boolean;
}

/**
 * Columnas de solape de los trozos de un día: ordenar por inicio (y fin descendente), agrupar en conjuntos
 * transitivamente solapados, asignar a cada uno la primera columna libre, `n` = columnas del grupo, y ensanchar a la
 * derecha mientras la columna siguiente esté libre en su intervalo. `minDuration` da altura a los muy cortos.
 */
export function layoutTimed<T extends { start: number; end: number }>(items: T[], minDuration = 0): Map<T, TimedPlacement> {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const span = (x: T) => ({ start: x.start, end: Math.max(x.end, x.start + Math.max(1, minDuration)) });
  const result = new Map<T, TimedPlacement>();
  let group: T[] = [];
  let groupEnd = -Infinity;
  const flush = () => {
    if (!group.length) return;
    const columns: { start: number; end: number }[][] = [];
    const colOf = new Map<T, number>();
    for (const item of group) {
      const s = span(item);
      let c = columns.findIndex((col) => col.every((other) => !overlaps(s, other)));
      if (c < 0) c = columns.push([]) - 1;
      columns[c]!.push(s);
      colOf.set(item, c);
    }
    const n = columns.length;
    for (const item of group) {
      const c = colOf.get(item)!;
      const s = span(item);
      let w = 1;
      while (c + w < n && columns[c + w]!.every((other) => !overlaps(s, other))) w++;
      const side = group.some((o) => o !== item && o.start === item.start);
      result.set(item, { col: c, n, w, side });
    }
    group = [];
    groupEnd = -Infinity;
  };
  for (const item of sorted) {
    const s = span(item);
    if (group.length && s.start >= groupEnd) flush();
    group.push(item);
    groupEnd = Math.max(groupEnd, s.end);
  }
  flush();
  return result;
}

/* ---------- Carriles del mes y de la fila de todo el día ---------- */

export interface LaneBar<T = Occurrence> {
  item: T;
  /** Columna del primer día (0…n−1) y días que ocupa en la fila. */
  from: number;
  span: number;
  lane: number;
  contStart: boolean;
  contEnd: boolean;
}

export interface RowLayout<T = Occurrence> {
  bars: LaneBar<T>[];
  /** Por columna: ocurrencias que no caben en `maxLanes` (para «+N más»). */
  hidden: T[][];
  lanes: number;
}

/**
 * Carriles de una fila de días (una semana del mes o la fila de todo el día): los de varios días primero (más
 * largos antes), luego los de un día por hora; cada uno en el primer carril libre en todos sus días. Lo que no
 * cabe en `maxLanes` va a `hidden` de cada día que ocupa (si hay que ocultar algo, el último carril visible se
 * reserva para «+N»).
 */
export function layoutRow<T extends { start: number; end: number; allDay?: boolean }>(
  items: T[],
  days: string[],
  maxLanes = Infinity,
): RowLayout<T> {
  const n = days.length;
  const d0 = dayStart(days[0]!);
  const placed: { item: T; from: number; to: number; contStart: boolean; contEnd: boolean }[] = [];
  for (const item of items) {
    const end = Math.max(item.end, item.start + 1);
    const from = Math.floor((item.start - d0) / MIN_PER_DAY);
    const to = Math.ceil((end - d0) / MIN_PER_DAY) - 1;
    if (to < 0 || from > n - 1) continue;
    placed.push({ item, from: Math.max(0, from), to: Math.min(n - 1, to), contStart: from < 0, contEnd: to > n - 1 });
  }
  placed.sort((a, b) => {
    const multiA = a.to > a.from || Boolean(a.item.allDay);
    const multiB = b.to > b.from || Boolean(b.item.allDay);
    if (multiA !== multiB) return multiA ? -1 : 1;
    return a.from - b.from || b.to - b.from - (a.to - a.from) || a.item.start - b.item.start;
  });
  const occupied: boolean[][] = [];
  const all: LaneBar<T>[] = [];
  for (const p of placed) {
    let lane = 0;
    for (; ; lane++) {
      occupied[lane] ??= Array(n).fill(false);
      let free = true;
      for (let c = p.from; c <= p.to; c++) if (occupied[lane]![c]) free = false;
      if (free) break;
    }
    for (let c = p.from; c <= p.to; c++) occupied[lane]![c] = true;
    all.push({ item: p.item, from: p.from, span: p.to - p.from + 1, lane, contStart: p.contStart, contEnd: p.contEnd });
  }
  const used = occupied.length;
  const hidden: T[][] = Array.from({ length: n }, () => []);
  if (used <= maxLanes) return { bars: all, hidden, lanes: used };
  // Algo no cabe: el último carril se reserva para «+N» en los días que lo necesiten.
  const visible = Math.max(0, maxLanes - 1);
  const bars: LaneBar<T>[] = [];
  for (const bar of all) {
    if (bar.lane < visible) bars.push(bar);
    else for (let c = bar.from; c < bar.from + bar.span; c++) hidden[c]!.push(bar.item);
  }
  // Un día con un solo oculto que cabría en el carril reservado lo muestra en vez de «+1».
  for (const bar of all) {
    if (bar.lane !== visible || bar.span !== 1) continue;
    const c = bar.from;
    if (hidden[c]!.length === 1 && hidden[c]![0] === bar.item) {
      hidden[c] = [];
      bars.push(bar);
    }
  }
  return { bars, hidden, lanes: Math.min(used, maxLanes) };
}

/* ---------- Rejilla: ajustar, mover, redimensionar ---------- */

/** Redondea `minutes` al múltiplo de `step` más cercano. */
export const snap = (minutes: number, step: number) => (step > 0 ? Math.round(minutes / step) * step : minutes);

/** Minuto del día bajo `y` (px desde el inicio visible de la columna). */
export function slotAt(y: number, hourHeight: number, firstMinute: number, step: number, lastMinute = MIN_PER_DAY): number {
  const raw = firstMinute + (y / hourHeight) * 60;
  const floored = step > 0 ? Math.floor(raw / step) * step : raw;
  return Math.max(firstMinute, Math.min(lastMinute - Math.max(step, 1), floored));
}

/** Puede moverse o cambiar de duración según `editable`, `startEditable`/`durationEditable` y su calendario. */
export function canEdit(event: CalendarEvent, source: CalendarSource | undefined, globally: boolean, what: "start" | "duration"): boolean {
  const base = event.editable ?? source?.editable ?? globally;
  if (!base) return false;
  return what === "start" ? (event.startEditable ?? true) : (event.durationEditable ?? true);
}

/** Mueve `[start, end)` `delta` minutos (conserva la duración). */
export const moveSpan = (span: { start: number; end: number }, delta: number) => ({ start: span.start + delta, end: span.end + delta });

/**
 * Cambia un extremo `delta` minutos sin bajar de `minDuration` (el otro extremo queda fijo). Los de todo el día
 * cambian en días enteros.
 */
export function resizeSpan(span: { start: number; end: number }, edge: "start" | "end", delta: number, minDuration: number) {
  if (edge === "end") return { start: span.start, end: Math.max(span.start + minDuration, span.end + delta) };
  return { start: Math.min(span.end - minDuration, span.start + delta), end: span.end };
}

export interface Rewritten {
  start: string;
  end: string;
  /** El reloj pedido no existe en la zona del evento o en la de presentación (cambio de hora): se guardó otro. */
  shifted?: { asked: string; saved: string };
}

/**
 * Escribe un intervalo nuevo (minutos de pared en la zona de presentación) en la forma del evento: fechas para todo
 * el día, reloj de su `timeZone`, instante `Z` si venía con desfase, o reloj flotante. Una hora que no existe se
 * resuelve como Temporal `compatible` y lo dice `shifted`.
 */
export function rewriteSpan(event: CalendarEvent, span: { start: number; end: number }, tz: string): Rewritten {
  if (isAllDay(event)) {
    const days = Math.max(1, Math.round((span.end - span.start) / MIN_PER_DAY));
    const start = dateOf(span.start);
    return { start, end: addDays(start, days) };
  }
  let shifted: Rewritten["shifted"];
  const write = (min: number, original: string) => {
    const wall = wallOf(min);
    const parsed = parseDateTime(original);
    const seconds = Boolean(parsed && original.length > 16 && /:\d{2}:\d{2}/.test(original.slice(10)));
    if (parsed && parsed.offset === null && !event.timeZone) return wallText(wall, seconds); // flotante
    const ms = fromWall(wall, tz) ?? 0;
    const back = toWall(ms, tz);
    if (!shifted && (back.hour !== wall.hour || back.minute !== wall.minute))
      shifted = { asked: clockText(wall.hour * 60 + wall.minute), saved: clockText(back.hour * 60 + back.minute) };
    if (event.timeZone) return wallText(toWall(ms, event.timeZone), seconds);
    return instantText(ms);
  };
  const out: Rewritten = { start: write(span.start, event.start), end: write(span.end, event.end) };
  if (shifted) out.shifted = shifted;
  return out;
}

/* ---------- Rango visible ---------- */

export type AgendaView = "day" | "week" | "workweek" | "month" | "agenda" | "year" | "perpetual" | "timeline";
/** Vistas por defecto del selector. */
export const AGENDA_VIEWS: readonly AgendaView[] = ["day", "week", "workweek", "month", "agenda"];
/** Todas las vistas que entiende la agenda (`views` elige cuáles ofrece). */
export const ALL_AGENDA_VIEWS: readonly AgendaView[] = [...AGENDA_VIEWS, "year", "perpetual", "timeline"];

/** Días que muestra una vista anclada en `date`. Mes: semanas completas que cubren el mes (6 con `fixedWeeks`). */
export function visibleDays(
  view: AgendaView,
  date: string,
  weekStart: number,
  options: { hiddenDays?: number[]; fixedWeeks?: boolean; listDays?: number } = {},
): string[] {
  const start = (d: string) => addDays(d, -((parse(d).getUTCDay() - weekStart + 7) % 7));
  const hide = new Set(options.hiddenDays ?? []);
  const keep = (list: string[]) => list.filter((d) => !hide.has(parse(d).getUTCDay()));
  if (view === "day" || view === "perpetual" || view === "timeline") return [date];
  if (view === "year") {
    const y = date.slice(0, 4);
    return Array.from({ length: diffDays(`${y}-01-01`, `${y}-12-31`) + 1 }, (_, i) => addDays(`${y}-01-01`, i));
  }
  if (view === "week") return keep(Array.from({ length: 7 }, (_, i) => addDays(start(date), i)));
  if (view === "workweek")
    return Array.from({ length: 7 }, (_, i) => addDays(start(date), i)).filter((d) => {
      const wd = parse(d).getUTCDay();
      return wd !== 0 && wd !== 6 && !hide.has(wd);
    });
  if (view === "agenda") return Array.from({ length: options.listDays ?? 14 }, (_, i) => addDays(date, i));
  const first = `${date.slice(0, 7)}-01`;
  const from = start(first);
  const last = addDays(`${dateOf(dayStart(first) + 32 * MIN_PER_DAY).slice(0, 7)}-01`, -1);
  const weeks = options.fixedWeeks ? 6 : Math.ceil((diffDays(from, last) + 1) / 7);
  return Array.from({ length: weeks * 7 }, (_, i) => addDays(from, i));
}

/** Ancla del periodo anterior o siguiente. */
export function shiftDate(view: AgendaView, date: string, direction: -1 | 1, listDays = 14): string {
  if (view === "day" || view === "timeline") return addDays(date, direction);
  if (view === "year" || view === "perpetual") return addMonths(date, 12 * direction);
  if (view === "week" || view === "workweek") return addDays(date, 7 * direction);
  if (view === "agenda") return addDays(date, listDays * direction);
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7)) - 1 + direction;
  const total = y * 12 + m;
  return `${pad(Math.floor(total / 12), 4)}-${pad((total % 12) + 1)}-01`;
}

/** Ahora en la zona de presentación, en minutos de pared. */
export const nowIn = (ms: number, tz: string) => wallMinutes(toWall(ms, tz));
