// Marcado de la agenda (EventCalendar) como un árbol de nodos sin framework: el binding de React lo convierte en
// elementos y el modo DOM en nodos (texto siempre como texto, nunca como marcado). Un solo origen para el contrato
// HTML de las dos vías. Aquí también el estado de la vista y los textos con `Intl`. Sin documento ni efectos.

import { addDays, diffDays, localeWeekInfo, pad, parse, safeLocale, weekNumber } from "./date";
import {
  clockMinutes,
  dateOf,
  dayStart,
  expandEvents,
  layoutRow,
  layoutTimed,
  minuteOfDay,
  nowIn,
  sortOccurrences,
  splitByDay,
  visibleDays,
  type AgendaView,
  type DaySegment,
  type TimedPlacement,
  type CalendarColor,
  type CalendarEvent,
  type CalendarSource,
  type Occurrence,
} from "./agenda";
import { fromWall, toWall, zoneCity, zoneLabel } from "./zone";
import { PERPETUAL_LABELS, perpetualTree, yearGrid, type PerpetualLabels } from "./agenda-year";
import { resourceTimeline, type ResourceItem, type ResourceRow } from "./timeline-view";

/* ---------- Árbol ---------- */

import { h, icon, on, type VAttr, type VEl, type VNode } from "./vnode";
/** Minutos alrededor de «ahora» en los que el rótulo de la hora en punto cede el sitio al rótulo de ahora. */
const NOW_LABEL_ROOM = 30;

export { toHTML, type VAttr, type VEl, type VNode, type VSlot } from "./vnode";

/* ---------- Configuración y estado ---------- */

export interface AgendaLabels {
  calendar: string;
  today: string;
  previous: string;
  next: string;
  views: Record<AgendaView, string>;
  viewsLabel: string;
  allDay: string;
  /** «+{n} more». */
  more: string;
  now: string;
  newEvent: string;
  calendars: string;
  timeZone: string;
  free: string;
  /** «{n} events» y «1 event». */
  events: string;
  event: string;
  repeats: string;
  tentative: string;
  past: string;
  week: string;
  moveTo: string;
  move: string;
  cancel: string;
  close: string;
  date: string;
  start: string;
  end: string;
  grabHint: string;
  /** «Grabbed {title}». */
  grabbed: string;
  /** «Moved {title} to {when}». */
  moved: string;
  /** «Resized {title} to {when}». */
  resized: string;
  cancelled: string;
  /** «{asked} doesn't exist on {date}, saved as {saved}». */
  shifted: string;
  empty: string;
  emptyHint: string;
  /** «New event · {when}». */
  creating: string;
  /** Prefijo de la hora repetida en un cambio de hora. */
  repeatedHour: string;
  /** Vista de línea temporal: cabecera de la columna de recursos y marca de conflicto. */
  resources: string;
  overlaps: string;
  /** Textos del año perpetuo. */
  perpetual: PerpetualLabels;
}

export const DEFAULT_LABELS: AgendaLabels = {
  calendar: "Calendar",
  today: "Today",
  previous: "Previous",
  next: "Next",
  views: {
    day: "Day",
    week: "Week",
    workweek: "Work week",
    month: "Month",
    agenda: "Agenda",
    year: "Year",
    perpetual: "One page",
    timeline: "Timeline",
  },
  viewsLabel: "View",
  allDay: "All day",
  more: "+{n} more",
  now: "Now",
  newEvent: "New event",
  calendars: "My calendars",
  timeZone: "Time zone",
  free: "free",
  events: "{n} events",
  event: "1 event",
  repeats: "repeats",
  tentative: "tentative",
  past: "past",
  week: "W",
  moveTo: "Move to…",
  move: "Move",
  cancel: "Cancel",
  close: "Close",
  date: "Date",
  start: "Start",
  end: "End",
  grabHint: "Arrows to move · Shift+Arrows to resize · Enter to drop · Esc to cancel",
  grabbed: "Grabbed {title}. Arrows to move, Enter to drop, Escape to cancel",
  moved: "Moved {title} to {when}",
  resized: "Resized {title} to {when}",
  cancelled: "Move cancelled",
  shifted: "{asked} doesn't exist on {date}, saved as {saved}",
  empty: "Nothing scheduled",
  emptyHint: "No events in this period.",
  creating: "New event · {when}",
  repeatedHour: "repeated hour",
  resources: "Resources",
  overlaps: "overlaps",
  perpetual: PERPETUAL_LABELS,
};

/** Textos que acepta la agenda: cualquiera de `AgendaLabels`, también por partes en `views` y `perpetual`. */
export type AgendaLabelsInput = Partial<Omit<AgendaLabels, "views" | "perpetual">> & {
  views?: Partial<AgendaLabels["views"]>;
  perpetual?: Partial<PerpetualLabels>;
};

/** Textos completos: los de la aplicación sobre los de por defecto (en inglés). El mismo objeto para la misma entrada. */
const merged = new WeakMap<AgendaLabelsInput, AgendaLabels>();
export function mergeLabels(labels: AgendaLabelsInput | undefined): AgendaLabels {
  if (!labels) return DEFAULT_LABELS;
  let out = merged.get(labels);
  if (!out) {
    out = mergeLabelsNow(labels);
    merged.set(labels, out);
  }
  return out;
}
function mergeLabelsNow(labels: AgendaLabelsInput): AgendaLabels {
  return {
    ...DEFAULT_LABELS,
    ...labels,
    views: { ...DEFAULT_LABELS.views, ...labels?.views },
    perpetual: { ...DEFAULT_LABELS.perpetual, ...labels?.perpetual },
  } as AgendaLabels;
}

export interface BusinessHours {
  days: number[];
  start: string;
  end: string;
}

export interface AgendaConfig {
  events: CalendarEvent[];
  calendars: CalendarSource[];
  views: AgendaView[];
  timeZone: string;
  /** Zonas que ofrece el selector de la barra (sin ella, solo se muestra la zona). */
  timeZones?: string[];
  secondaryTimeZone?: string;
  locale?: string;
  weekStart: number;
  hiddenDays?: number[];
  /** Rango visible de la rejilla, en minutos del día. */
  dayStart: number;
  dayEnd: number;
  slotDuration: number;
  snapDuration: number;
  businessHours?: BusinessHours[];
  editable: boolean;
  selectable: boolean;
  dayMaxEvents: number;
  fixedWeeks: boolean;
  listDays: number;
  sidebar: boolean;
  showWeekNumber: boolean;
  /** Botón «Nuevo evento» (lo atiende la aplicación con onQuickCreate / z-quick-create). */
  createButton: boolean;
  labels: AgendaLabels;
  /** Vista de recursos (línea temporal del día): salas o personas. Sin ellos, una fila por calendario. */
  resources?: ResourceRow[];
  /** El contenido visible de cada evento lo pinta la aplicación (renderEvent / setAgendaOptions). */
  customEvents?: boolean;
  /** Año: densidad 0…3 de un día (por defecto, por número de eventos). */
  density?: (date: string, count: number) => number;
  /** Hoy (`YYYY-MM-DD`) y ahora (ms) fijos: servidor y pruebas. */
  today?: string;
  now?: number;
}

export interface DragPreview {
  key: string;
  mode: "move" | "resize-start" | "resize-end";
  start: number;
  end: number;
}

export interface AgendaState {
  view: AgendaView;
  date: string;
  timeZone: string;
  hidden: string[];
  /** Pieza con el tabulador: `e:<clave>`, `d:<fecha>` o `s:<fecha>:<minuto>`. */
  focus: string | null;
  selected: string | null;
  /** Popover «+N más» abierto (fecha) o detalle del evento (clave). */
  more: string | null;
  detail: string | null;
  /** Diálogo «Mover a…» (clave del evento). */
  moving: string | null;
  /** Agarrado con teclado: intervalo provisional. */
  grabbed: DragPreview | null;
  /** Arrastre con puntero en curso. */
  drag: DragPreview | null;
  /** Selección de franja al crear arrastrando. */
  creating: { date: string; start: number; end: number } | null;
  /** Lista larga (ventana virtual): desplazamiento y alto visibles, en px (el inicio, redondeado a bloques). */
  listScroll?: { top: number; height: number } | null;
  /** Lista larga: alto medido de una fila, de la cabecera de un día y del relleno de un grupo, en px. */
  listMetrics?: ListMetrics | null;
}

export interface ListMetrics {
  row: number;
  head: number;
  pad: number;
}
/** Estimación hasta medir (una fila de 48 px más el hueco de 2, cabecera de día y relleno del grupo). */
export const LIST_METRICS: ListMetrics = { row: 50, head: 76, pad: 17 };
/** Filas a partir de las que la lista pinta solo su ventana (más un margen) y rellena el resto. */
export const LIST_VIRTUAL_FROM = 150;
/** Filas de margen a cada lado de la ventana de la lista, y tamaño del bloque al que se redondea el desplazamiento. */
export const LIST_OVERSCAN = 8;
export const LIST_BLOCK = 4;

export function initialState(config: Pick<AgendaConfig, "views" | "timeZone">, view: AgendaView, date: string): AgendaState {
  return {
    view: config.views.includes(view) ? view : (config.views[0] ?? "week"),
    date,
    timeZone: config.timeZone,
    hidden: [],
    focus: null,
    selected: null,
    more: null,
    detail: null,
    moving: null,
    grabbed: null,
    drag: null,
    creating: null,
    listScroll: null,
    listMetrics: null,
  };
}

/* ---------- Formatos ---------- */

const formats = new Map<string, Intl.DateTimeFormat>();
const formatsByOptions = new WeakMap<Intl.DateTimeFormatOptions, Map<string, Intl.DateTimeFormat>>();
function fmt(locale: string | undefined, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  // Opciones constantes (TIME, DAY_LONG…): sin serializar en cada llamada.
  const byLocale = formatsByOptions.get(options);
  const fast = byLocale?.get(locale ?? "");
  if (fast) return fast;
  const f = fmtSlow(locale, options);
  if (byLocale) byLocale.set(locale ?? "", f);
  else formatsByOptions.set(options, new Map([[locale ?? "", f]]));
  return f;
}
function fmtSlow(locale: string | undefined, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale ?? ""}|${JSON.stringify(options)}`;
  let f = formats.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(safeLocale(locale), { ...options, timeZone: "UTC" });
    formats.set(key, f);
  }
  return f;
}
/** Minutos de pared → milisegundos «UTC» para formatear con `timeZone: "UTC"`. */
const ms = (min: number) => min * 60_000;
const TIME: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };

// Textos que se repiten miles de veces al pintar (una hora del día, un día): memoria por locale.
const times = new Map<string, string>();
export function timeText(min: number, locale?: string): string {
  const key = `${locale ?? ""}|${minuteOfDay(min)}`;
  let text = times.get(key);
  if (text === undefined) {
    if (times.size > 10_000) times.clear();
    text = fmt(locale, TIME).format(ms(minuteOfDay(min)));
    times.set(key, text);
  }
  return text;
}
/** Intervalo de horas con `formatRange` (marcas bidi del locale incluidas). */
const rangeTexts = new Map<string, string>();
export function timeRangeText(start: number, end: number, locale?: string): string {
  // Un intervalo que cruza la medianoche lleva fechas en el texto: entonces la clave incluye el día.
  const length = Math.max(end, start) - start;
  const key = `${locale ?? ""}|${minuteOfDay(start)}|${length}|${minuteOfDay(start) + length > 1440 ? dateOf(start) : ""}`;
  const hit = rangeTexts.get(key);
  if (hit !== undefined) return hit;
  if (rangeTexts.size > 5000) rangeTexts.clear();
  const text = formatTimeRange(start, end, locale);
  rangeTexts.set(key, text);
  return text;
}
function formatTimeRange(start: number, end: number, locale?: string): string {
  const f = fmt(locale, TIME);
  try {
    return f.formatRange(ms(start), ms(Math.max(end, start)));
  } catch {
    return `${f.format(ms(start))} – ${f.format(ms(end))}`;
  }
}
const DAY_LONG: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" };
const dayLongs = new Map<string, string>();
const dayLong = (date: string, locale?: string) => {
  const key = `${locale ?? ""}|${date}`;
  let text = dayLongs.get(key);
  if (text === undefined) {
    if (dayLongs.size > 10_000) dayLongs.clear();
    text = fmt(locale, DAY_LONG).format(parse(date));
    dayLongs.set(key, text);
  }
  return text;
};
/** Minutos de pared → `YYYY-MM-DDTHH:mm`. */
const wallText = (min: number) => `${dateOf(min)}T${pad(Math.floor(minuteOfDay(min) / 60))}:${pad(minuteOfDay(min) % 60)}`;
const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? `{${k}}`));

/** Título de la barra: «November 16 – 22, 2026», «Thursday, 19 November 2026», «November 2026». */
export function periodTitle(view: AgendaView, days: string[], date: string, locale?: string): string {
  if (view === "day" || view === "timeline") return fmt(locale, { dateStyle: "full" }).format(parse(date));
  if (view === "year" || view === "perpetual") return fmt(locale, { year: "numeric" }).format(parse(date));
  if (view === "month") return fmt(locale, { month: "long", year: "numeric" }).format(parse(`${date.slice(0, 7)}-01`));
  const a = parse(days[0]!);
  const b = parse(days[days.length - 1]!);
  const f = fmt(locale, { month: "long", day: "numeric", year: "numeric" });
  try {
    return f.formatRange(a, b);
  } catch {
    return `${f.format(a)} – ${f.format(b)}`;
  }
}

/* ---------- Índices por día ---------- */

/**
 * Ocurrencias de cada día de `days` (un día cuenta si el intervalo lo pisa; uno de cero minutos, en su día), en una
 * sola pasada: las vistas no filtran la lista entera por cada celda. El orden de cada día es el de `items`.
 */
export function byDay<T extends { start: number; end: number }>(items: T[], days: string[]): Map<string, T[]> {
  const out = new Map<string, T[]>(days.map((d) => [d, []]));
  if (!days.length) return out;
  const at = new Map<number, T[]>(days.map((d) => [dayStart(d) / 1440, out.get(d)!]));
  const first = dayStart(days[0]!) / 1440;
  const last = dayStart(days[days.length - 1]!) / 1440;
  for (const o of items) {
    const a = Math.max(first, Math.floor(o.start / 1440));
    const b = Math.min(last, Math.ceil(Math.max(o.end, o.start + 1) / 1440) - 1);
    for (let k = a; k <= b; k++) at.get(k)?.push(o);
  }
  return out;
}
const dayIndexes = new WeakMap<Occurrence[], { key: string; map: Map<string, Occurrence[]> }>();
/** `byDay` memorizado por lista de ocurrencias y días (la lista es la misma mientras no cambie el rango). */
function occurrencesByDay(list: Occurrence[], days: string[]): Map<string, Occurrence[]> {
  const key = `${days[0]}|${days[days.length - 1]}|${days.length}`;
  const hit = dayIndexes.get(list);
  if (hit?.key === key) return hit.map;
  const map = byDay(list, days);
  dayIndexes.set(list, { key, map });
  return map;
}
const eventDays = new WeakMap<Occurrence[], (d: string) => boolean>();
/** Días que empiezan algún evento (minicalendario), con la misma función mientras la lista no cambie. */
function hasEventsOf(list: Occurrence[]): (d: string) => boolean {
  let fn = eventDays.get(list);
  if (!fn) {
    const set = new Set(list.map((o) => dateOf(o.start)));
    fn = (d: string) => set.has(d);
    eventDays.set(list, fn);
  }
  return fn;
}
const sourceMaps = new WeakMap<CalendarSource[], Map<string, CalendarSource>>();
const sourcesOf = (calendars: CalendarSource[]) => {
  let map = sourceMaps.get(calendars);
  if (!map) {
    map = new Map(calendars.map((c) => [c.id, c]));
    sourceMaps.set(calendars, map);
  }
  return map;
};

/* ---------- Modelo de la vista ---------- */

const colorOf = (event: CalendarEvent, sources: Map<string, CalendarSource>): CalendarColor =>
  event.color ?? sources.get(event.calendarId)?.color ?? "1";

export interface AgendaModel {
  days: string[];
  occurrences: Occurrence[];
  title: string;
  weekLabel: string | null;
  today: string;
  now: number;
  focusId: string;
  sources: Map<string, CalendarSource>;
}

export function buildModel(config: AgendaConfig, state: AgendaState, nowMs: number): AgendaModel {
  const days = visibleDays(state.view, state.date, config.weekStart, {
    hiddenDays: config.hiddenDays,
    fixedWeeks: config.fixedWeeks,
    listDays: config.listDays,
  });
  const occurrences = expandEvents({
    events: config.events,
    from: days[0]!,
    to: days[days.length - 1]!,
    timeZone: state.timeZone,
    hidden: state.hidden,
  });
  const now = config.now !== undefined ? nowIn(config.now, state.timeZone) : nowIn(nowMs, state.timeZone);
  const today = config.today ?? dateOf(now);
  const week = state.view === "week" || state.view === "workweek" ? weekNumber(days[0]!, 1, 4).week : null;
  const sources = sourcesOf(config.calendars);
  return {
    days,
    occurrences,
    title: periodTitle(state.view, days, state.date, config.locale),
    weekLabel: week ? `${config.labels.week}${week}` : null,
    today,
    now,
    focusId: "",
    sources,
  };
}

/** Pieza que recibe el tabulador si `state.focus` ya no está en la vista. */
function fallbackFocus(state: AgendaState, model: AgendaModel, config: AgendaConfig, plan: TimeGridPlan | null = null): string {
  const inView = (d: string) => model.days.includes(d);
  const anchor = inView(model.today) ? model.today : inView(state.date) ? state.date : model.days[0]!;
  if (state.view === "month" || state.view === "year") return `d:${anchor}`;
  if (state.view === "perpetual") return "";
  if (state.view === "agenda") {
    const first = model.occurrences.find((o) => o.end > model.now) ?? model.occurrences[0];
    return first ? `e:${first.key}` : "";
  }
  const first = model.occurrences.find((o) => !o.allDay && dateOf(o.start) === anchor && !plan?.hidden.has(o.key));
  if (first) return `e:${first.key}`;
  const scroll = Math.max(config.dayStart, Math.min(config.dayEnd - config.slotDuration, 8 * 60));
  return `s:${anchor}:${scroll}`;
}

/* ---------- Pieza: evento ---------- */

interface EventBits {
  o: Occurrence;
  config: AgendaConfig;
  model: AgendaModel;
  state: AgendaState;
  /** Intervalo mostrado (el provisional si se arrastra). */
  start: number;
  end: number;
}

/** Nombre accesible completo del evento. */
export function eventLabel(
  o: Occurrence,
  config: AgendaConfig,
  sources: Map<string, CalendarSource>,
  start = o.start,
  end = o.end,
  visible: string[] = [],
): string {
  const { labels, locale } = config;
  const e = o.event;
  // Primero lo que se ve, en su orden (el nombre contiene el texto visible: WCAG 2.5.3); luego el resto.
  const parts = [e.title, ...visible];
  const add = (text: string) => {
    if (!parts.includes(text)) parts.push(text);
  };
  if (o.allDay) {
    const last = dateOf(Math.max(start, end - 1));
    add(dateOf(start) === last ? dayLong(dateOf(start), locale) : `${dayLong(dateOf(start), locale)} – ${dayLong(last, locale)}`);
    add(labels.allDay);
  } else {
    add(timeRangeText(start, end, locale));
    add(dayLong(dateOf(start), locale));
    if (o.ambiguous) add(labels.repeatedHour);
  }
  if (e.location) add(e.location);
  const source = sources.get(e.calendarId);
  if (source) parts.push(source.name);
  if (e.status === "tentative") parts.push(labels.tentative);
  if (o.seriesId) parts.push(labels.repeats);
  return parts.join(", ");
}

type EventVariant = "timed" | "bar" | "dot" | "row" | "lane";
interface EventExtra {
  s?: Record<string, string | number>;
  cls?: string;
  cont?: [boolean, boolean];
  half?: "top" | "bottom" | null;
  conflict?: boolean;
}

// Memoria del marcado de cada evento (por ocurrencia y por todo lo que lo cambia): navegar, mover el foco o
// arrastrar vuelve a usar el mismo nodo para los eventos que no cambian, y React y el modo DOM no los recorren.
const buttons = new WeakMap<Occurrence, Map<string, VEl>>();
const ids = new WeakMap<object, number>();
let nextId = 1;
const idOf = (o: object) => {
  let v = ids.get(o);
  if (v === undefined) {
    v = nextId++;
    ids.set(o, v);
  }
  return v;
};

function eventButton(bits: EventBits, variant: EventVariant, extra: EventExtra = {}): VEl {
  const { o, config, model, state } = bits;
  // Con contenido de la aplicación (renderEvent) no se memoriza: lo pinta la aplicación en cada pasada.
  if (config.customEvents) return eventButtonTree(bits, variant, extra);
  const sig = [
    variant,
    bits.start,
    bits.end,
    extra.s ? Object.entries(extra.s).join(",") : "",
    extra.cls ?? "",
    extra.cont ? `${extra.cont[0]}${extra.cont[1]}` : "",
    extra.half ?? "",
    extra.conflict ? 1 : 0,
    state.selected === o.key ? 1 : 0,
    state.grabbed?.key === o.key ? 1 : 0,
    state.drag?.key === o.key ? 1 : 0,
    model.focusId === `e:${o.key}` ? 1 : 0,
    bits.end <= model.now ? 1 : 0,
    idOf(config.labels),
    idOf(model.sources),
    config.locale ?? "",
    config.editable ? 1 : 0,
  ].join("|");
  let byOcc = buttons.get(o);
  const hit = byOcc?.get(sig);
  if (hit) return hit;
  const el = eventButtonTree(bits, variant, extra);
  el.m = true;
  if (!byOcc) {
    byOcc = new Map();
    buttons.set(o, byOcc);
  }
  if (byOcc.size > 12) byOcc.clear();
  byOcc.set(sig, el);
  return el;
}

function eventButtonTree(bits: EventBits, variant: EventVariant, extra: EventExtra): VEl {
  const { o, config, model, state } = bits;
  const e = o.event;
  const id = `e:${o.key}`;
  const grabbed = state.grabbed?.key === o.key;
  const dragging = state.drag?.key === o.key;
  const editable = config.editable && e.editable !== false && model.sources.get(e.calendarId)?.editable !== false;
  const time = o.allDay ? "" : variant === "dot" ? timeText(bits.start, config.locale) : timeRangeText(bits.start, bits.end, config.locale);
  const short = !o.allDay && bits.end - bits.start <= 45;
  // Fila de lista: la hora va en su columna (inicio y fin); el resto lleva hora y lugar debajo del título.
  const row = variant === "row";
  const meta = (variant === "dot" ? [time] : row ? [e.location] : [time, e.location]).filter((m): m is string => Boolean(m));
  const task = e.kind === "task";
  return h(
    "button",
    {
      key: `${variant}:${o.key}:${extra.cont ? `${extra.cont[0]}` : ""}:${String(extra.s?.["--z-ev-first"] ?? "")}`,
      type: "button",
      class: `z-event${extra.cls ? ` ${extra.cls}` : ""}`,
      "data-variant": variant,
      "data-key": o.key,
      "data-focus-id": id,
      "data-color": colorOf(e, model.sources),
      "data-selected": on(state.selected === o.key || dragging),
      "data-past": on(bits.end <= model.now && !dragging),
      "data-tentative": on(e.status === "tentative"),
      "data-task": on(task),
      "data-done": on(task && e.done),
      "data-recurring": on(Boolean(o.seriesId)),
      "data-short": on(short && variant === "timed"),
      "data-dragging": on(dragging),
      "data-grabbed": on(grabbed),
      "data-cont-start": on(extra.cont?.[0]),
      "data-cont-end": on(extra.cont?.[1]),
      "data-half": extra.half ?? undefined,
      "data-conflict": on(extra.conflict),
      "data-editable": on(editable),
      "aria-pressed": grabbed ? "true" : undefined,
      tabindex: model.focusId === id ? 0 : -1,
      s: extra.s,
    },
    row
      ? h(
          "span",
          { class: "z-event__when", "aria-hidden": "true" },
          o.allDay ? config.labels.allDay : h("b", null, timeText(bits.start, config.locale)),
          o.allDay ? null : timeText(bits.end, config.locale),
        )
      : null,
    // Barra que sigue de la semana anterior o continúa en la siguiente: chevrón de continuación (forma, no solo el
    // borde recto).
    variant === "bar" && extra.cont?.[0]
      ? h("span", { class: "z-event__cont", "data-edge": "start", "aria-hidden": "true" }, icon("chevron-left", 12))
      : null,
    task ? h("span", { class: "z-event__box", "aria-hidden": "true" }) : null,
    config.customEvents
      ? {
          slot: "event",
          k: `${o.key}|${bits.start}|${bits.end}|${variant}`,
          p: {
            event: e,
            occurrence: o.key,
            seriesId: o.seriesId,
            allDay: o.allDay,
            start: wallText(bits.start),
            end: wallText(bits.end),
            variant,
            time,
          },
        }
      : null,
    config.customEvents ? h("span", { class: "z-sr-only" }, `, ${eventLabel(o, config, model.sources, bits.start, bits.end)}`) : null,
    config.customEvents
      ? null
      : h(
          "span",
          { class: "z-event__title" },
          extra.conflict ? h("span", { class: "z-timeline__warn", "aria-hidden": "true" }, icon("exclamation-triangle", 12)) : null,
          e.title,
          o.seriesId ? h("span", { class: "z-event__icon", "aria-hidden": "true" }, icon("arrow-path", 12)) : null,
        ),
    meta.length && variant !== "bar" && !config.customEvents ? h("span", { class: "z-sr-only" }, ", ") : null,
    meta.length && variant !== "bar" && !config.customEvents
      ? h("span", { class: "z-event__meta" }, ...meta.flatMap((m, i): VNode[] => (i ? [" · ", m] : [h("bdi", null, m)])))
      : null,
    variant === "bar" && extra.cont?.[1]
      ? h("span", { class: "z-event__cont", "data-edge": "end", "aria-hidden": "true" }, icon("chevron-right", 12))
      : null,
    editable && (variant === "timed" || variant === "lane")
      ? h("span", { class: "z-event__resize", "data-edge": "end", "aria-hidden": "true" })
      : null,
    // El nombre sale del contenido: lo visible (título, hora, lugar) y, oculto a la vista, el resto (día,
    // calendario, provisional, repite). Así el nombre siempre contiene el texto visible (WCAG 2.5.3).
    config.customEvents
      ? null
      : h(
          "span",
          { class: "z-sr-only" },
          restOfLabel(o, config, model.sources, bits.start, bits.end, variant === "bar" ? [] : meta),
          extra.conflict ? `, ${config.labels.overlaps}` : "",
        ),
  );
}

/** Lo que el nombre accesible añade a lo visible: «, Thursday 19 November, Work, repeats». */
function restOfLabel(
  o: Occurrence,
  config: AgendaConfig,
  sources: Map<string, CalendarSource>,
  start: number,
  end: number,
  visible: string[],
): string {
  const full = eventLabel(o, config, sources, start, end, visible);
  const shown = [o.event.title, ...visible].join(", ");
  return full.startsWith(shown) ? full.slice(shown.length) : `, ${full}`;
}

/* ---------- Rejilla de horas: solapes con tope ---------- */

/**
 * Columnas de solape de un grupo, contando la de «+N» (agenda.md §9: «a partir del quinto, un indicador»): en la
 * semana, cuatro eventos lado a lado y el quinto carril para «+N»; en el día, ocho y el noveno.
 */
export const timeGridStack = (days: number) => (days === 1 ? 9 : 5);

interface PlacedSegment {
  seg: DaySegment<Occurrence>;
  p: TimedPlacement;
  /** Se pinta por encima, a todo el ancho: el que se mueve y no cabría en las columnas visibles. */
  floating?: boolean;
}
/** «+N» de un intervalo: los solapes que no caben, agrupados por hora (minutos del día). */
export interface StackChip {
  id: string;
  date: string;
  start: number;
  end: number;
  count: number;
}
export interface TimeGridPlan {
  days: Map<string, { segs: PlacedSegment[]; chips: StackChip[] }>;
  /** Claves de las ocurrencias con hora que no se pintan (están detrás de un «+N»). */
  hidden: Set<string>;
  chips: Set<string>;
}

/**
 * Qué pinta cada columna de día: los trozos del día con su columna de solape y, en los grupos con más columnas que
 * `timeGridStack`, solo las primeras (la última columna se reserva para «+N», uno por hora). Así una semana con mil
 * eventos pinta lo que cabe y el resto queda a un clic, en el popover del intervalo (como el «+N» del mes).
 */
export function planTimeGrid(config: AgendaConfig, state: AgendaState, model: AgendaModel): TimeGridPlan {
  const first = config.dayStart;
  const last = config.dayEnd;
  const preview = state.drag ?? state.grabbed;
  const timed = model.occurrences
    .filter((o) => !o.allDay)
    .map((o) => (preview?.key === o.key ? { ...o, start: preview.start, end: preview.end } : o));
  const segments = splitByDay(timed, model.days);
  const byDate = new Map<string, DaySegment<Occurrence>[]>(model.days.map((d) => [d, []]));
  for (const seg of segments) if (seg.end > first && seg.start < last) byDate.get(seg.date)?.push(seg);
  const cap = timeGridStack(model.days.length);
  const hidden = new Set<string>();
  const chipIds = new Set<string>();
  const days = new Map<string, { segs: PlacedSegment[]; chips: StackChip[] }>();
  for (const d of model.days) {
    const daySegs = byDate.get(d) ?? [];
    const placement = layoutTimed(daySegs, 20, cap);
    const segs: PlacedSegment[] = [];
    // Ocultos por hora (en los grupos que superan el tope), con el fin del último para el intervalo del popover.
    const buckets = new Map<number, { start: number; end: number; count: number }>();
    for (const seg of [...daySegs].sort((a, b) => a.start - b.start || b.end - a.end)) {
      const p = placement.get(seg)!;
      if (p.n <= cap) {
        segs.push({ seg, p });
        continue;
      }
      const o = seg.item;
      if (p.col < cap - 1) {
        segs.push({ seg, p: { ...p, n: cap, w: Math.min(p.w, cap - 1 - p.col) } });
        continue;
      }
      if (preview?.key === o.key) {
        segs.push({ seg, p: { ...p, col: 0, n: 1, w: 1 }, floating: true });
        continue;
      }
      hidden.add(o.key);
      const hour = Math.max(Math.floor(seg.start / 60) * 60, p.groupStart, first);
      const b = buckets.get(hour) ?? { start: hour, end: hour, count: 0 };
      b.count++;
      b.end = Math.max(b.end, Math.min(seg.end, last), hour + 60);
      buckets.set(hour, b);
    }
    // Dos «+N» a menos de media hora se juntan en uno (no se tapan).
    const chips: StackChip[] = [];
    for (const b of [...buckets.values()].sort((x, y) => x.start - y.start)) {
      const prev = chips[chips.length - 1];
      if (prev && b.start < prev.start + 30) {
        prev.count += b.count;
        prev.end = Math.max(prev.end, b.end);
        continue;
      }
      chips.push({ id: `m:${d}:${b.start}`, date: d, start: b.start, end: Math.min(b.end, Math.max(last, b.start + 1)), count: b.count });
    }
    for (const c of chips) chipIds.add(c.id);
    days.set(d, { segs, chips });
  }
  return { days, hidden, chips: chipIds };
}

/** Clave de `state.more` para el popover de un intervalo del día: `YYYY-MM-DD@inicio-fin` (minutos del día). */
export const intervalKey = (chip: Pick<StackChip, "date" | "start" | "end">) => `${chip.date}@${chip.start}-${chip.end}`;
const parseInterval = (key: string) => {
  const m = /^(\d{4}-\d{2}-\d{2})@(\d+)-(\d+)$/.exec(key);
  return m ? { date: m[1]!, start: Number(m[2]), end: Number(m[3]) } : null;
};

/* ---------- Vistas ---------- */

function timeGrid(config: AgendaConfig, state: AgendaState, model: AgendaModel, plan: TimeGridPlan): VEl {
  const { labels, locale } = config;
  const days = model.days;
  const first = config.dayStart;
  const last = config.dayEnd;
  // El evento que se arrastra se pinta en su sitio nuevo (el plan ya lo lleva ahí).
  const preview = state.drag ?? state.grabbed;
  const allDay = model.occurrences.filter((o) => o.allDay);
  const row = layoutRow(allDay, days, Math.max(1, config.dayMaxEvents));
  const zone = zoneLabel(state.timeZone, Date.now(), locale);
  const hours: number[] = [];
  for (let m = Math.ceil(first / 60) * 60; m < last; m += 60) hours.push(m);
  const nowMin = minuteOfDay(model.now);
  const showNow = days.includes(dateOf(model.now)) && nowMin >= first && nowMin <= last;
  const second = config.secondaryTimeZone;
  const secondLabel = second ? zoneLabel(second, Date.now(), locale) : null;
  const secondHour = (min: number) => {
    if (!second) return "";
    const instant = fromWall({ date: days[0]!, hour: Math.floor(min / 60), minute: min % 60, second: 0 }, state.timeZone);
    if (instant === null) return "";
    const w = toWall(instant, second);
    return timeText(w.hour * 60 + w.minute, locale);
  };
  const focusSlot = model.focusId.startsWith("s:") ? model.focusId.split(":") : null;
  const weekend = new Set(localeWeekInfo(locale).weekend);

  return h(
    "div",
    {
      class: "z-timegrid",
      role: "grid",
      "aria-label": model.title,
      "aria-readonly": config.editable ? undefined : "true",
      "data-days": days.length,
      "data-second-zone": on(Boolean(second)),
    },
    // `--z-tg-*`: rango visible y número de días; el resto, en la hoja.
    h(
      "div",
      { class: "z-timegrid__scroll" },
      h(
        "div",
        { class: "z-timegrid__head", role: "rowgroup" },
        h(
          "div",
          { class: "z-timegrid__row", role: "row" },
          second ? h("div", { class: "z-timegrid__corner", role: "columnheader" }, secondLabel) : null,
          h("div", { class: "z-timegrid__corner", role: "columnheader" }, h("span", { class: "z-sr-only" }, labels.timeZone, " "), zone),
          ...days.map((d) =>
            h(
              "div",
              {
                key: d,
                class: "z-timegrid__dayhead",
                role: "columnheader",
                "data-date": d,
                "data-today": on(d === model.today),
                "data-weekend": on(weekend.has(parse(d).getUTCDay())),
                "aria-current": d === model.today ? "date" : undefined,
              },
              h("span", { class: "z-sr-only" }, dayLong(d, locale)),
              h("span", { class: "z-timegrid__weekday", "aria-hidden": "true" }, fmt(locale, { weekday: "short" }).format(parse(d))),
              h("span", { class: "z-timegrid__day", "aria-hidden": "true" }, fmt(locale, { day: "numeric" }).format(parse(d))),
            ),
          ),
        ),
        h(
          "div",
          { class: "z-timegrid__row z-timegrid__allday", role: "row", s: { "--z-tg-lanes": Math.max(1, row.lanes) } },
          second ? h("div", { class: "z-timegrid__label", role: "rowheader" }, h("span", { class: "z-sr-only" }, secondLabel)) : null,
          h("div", { class: "z-timegrid__label", role: "rowheader" }, labels.allDay),
          h(
            "div",
            { class: "z-timegrid__alltrack", role: "gridcell", "aria-colspan": days.length },
            ...row.bars.map((bar) =>
              eventButton({ o: bar.item, config, model, state, start: bar.item.start, end: bar.item.end }, "bar", {
                s: { "--z-ev-first": bar.from + 1, "--z-ev-span": bar.span, "--z-ev-lane": bar.lane + 1 },
                cont: [bar.contStart, bar.contEnd],
              }),
            ),
            ...row.hidden.map((list, i) =>
              list.length
                ? h(
                    "button",
                    {
                      key: `more:${days[i]}`,
                      type: "button",
                      class: "z-agenda__more z-timegrid__more",
                      "data-more": days[i],
                      "aria-haspopup": "dialog",
                      "aria-expanded": state.more === days[i] ? "true" : "false",
                      tabindex: -1,
                    },
                    fill(labels.more, { n: list.length }),
                  )
                : null,
            ),
          ),
        ),
      ),
      h(
        "div",
        { class: "z-timegrid__body", role: "rowgroup" },
        h(
          "div",
          { class: "z-timegrid__row", role: "row" },
          second
            ? h(
                "div",
                { class: "z-timegrid__gutter z-timegrid__gutter--second", role: "rowheader", "aria-label": secondLabel },
                ...hours.map((m) => h("span", { key: `s${m}`, s: { "--z-tg-at": m } }, secondHour(m))),
              )
            : null,
          h(
            "div",
            { class: "z-timegrid__gutter", role: "rowheader", "aria-label": zone },
            // La hora que cae bajo el rótulo de «ahora» (a menos de media hora) se calla: el rótulo la taparía a medias.
            ...hours.map((m) =>
              h(
                "span",
                { key: `h${m}`, s: { "--z-tg-at": m }, "aria-hidden": "true" },
                m === first || (showNow && Math.abs(m - nowMin) < NOW_LABEL_ROOM) ? "" : timeText(m, locale),
              ),
            ),
            showNow ? h("span", { class: "z-timegrid__now-label", s: { "--z-tg-at": nowMin } }, timeText(model.now, locale)) : null,
          ),
          ...days.map((d) => {
            const dayPlan = plan.days.get(d) ?? { segs: [], chips: [] };
            const wd = parse(d).getUTCDay();
            const off = (config.businessHours ?? []).filter((b) => b.days.includes(wd));
            const offRanges: [number, number][] = [];
            if (config.businessHours) {
              if (!off.length) offRanges.push([first, last]);
              else {
                const open = off
                  .map((b) => [clockMinutes(b.start), clockMinutes(b.end, 1440)] as [number, number])
                  .sort((a, b) => a[0] - b[0]);
                let cursor = first;
                for (const [a, b] of open) {
                  if (a > cursor) offRanges.push([cursor, Math.min(a, last)]);
                  cursor = Math.max(cursor, b);
                }
                if (cursor < last) offRanges.push([cursor, last]);
              }
            }
            const slotHere = focusSlot && focusSlot[1] === d ? Number(focusSlot[2]) : null;
            const creating = state.creating?.date === d ? state.creating : null;
            return h(
              "div",
              {
                key: d,
                class: "z-timegrid__col",
                role: "gridcell",
                "data-date": d,
                "data-today": on(d === model.today),
                "data-weekend": on(weekend.has(wd)),
                "data-drop": on(Boolean(state.drag && dateOf(state.drag.start) === d)),
              },
              ...offRanges.map(([a, b]) => h("div", { key: `off${a}`, class: "z-timegrid__off", s: { "--z-ev-s": a, "--z-ev-d": b - a } })),
              ...dayPlan.segs.map(({ seg, p, floating }) => {
                const o = seg.item;
                return eventButton({ o, config, model, state, start: o.start, end: o.end }, "timed", {
                  s: {
                    "--z-ev-s": Math.max(seg.start, first),
                    "--z-ev-d": Math.max(Math.min(seg.end, last) - Math.max(seg.start, first), 0),
                    "--z-ev-col": p.col,
                    "--z-ev-n": p.n,
                    "--z-ev-w": p.w,
                  },
                  cls: floating ? "z-event--floating" : p.side ? "z-event--side" : undefined,
                  cont: [seg.contStart, seg.contEnd],
                });
              }),
              // «+N» de los solapes que no caben, en la última columna de su grupo.
              ...dayPlan.chips.map((chip) => {
                const range = timeRangeText(dayStart(d) + chip.start, dayStart(d) + chip.end, locale);
                const key = intervalKey(chip);
                return h(
                  "button",
                  {
                    key: chip.id,
                    type: "button",
                    class: "z-agenda__more z-timegrid__overflow",
                    "data-more": key,
                    "data-focus-id": chip.id,
                    "aria-haspopup": "dialog",
                    "aria-expanded": state.more === key ? "true" : "false",
                    "aria-label": `${fill(labels.more, { n: chip.count })}, ${dayLong(d, locale)}, ${range}`,
                    tabindex: model.focusId === chip.id ? 0 : -1,
                    s: { "--z-ev-s": chip.start, "--z-ev-col": timeGridStack(days.length) - 1, "--z-ev-n": timeGridStack(days.length) },
                  },
                  `+${chip.count}`,
                );
              }),
              preview && state.drag && dateOf(state.drag.start) === d
                ? h(
                    "span",
                    { class: "z-timegrid__tip", "aria-hidden": "true", s: { "--z-ev-s": minuteOfDay(state.drag.start) } },
                    timeRangeText(state.drag.start, state.drag.end, locale),
                  )
                : null,
              creating
                ? h(
                    "div",
                    {
                      class: "z-timegrid__create",
                      "aria-hidden": "true",
                      s: { "--z-ev-s": creating.start, "--z-ev-d": creating.end - creating.start },
                    },
                    h("strong", null, labels.newEvent),
                    h("span", null, timeRangeText(dayStart(d) + creating.start, dayStart(d) + creating.end, locale)),
                  )
                : null,
              slotHere !== null
                ? h(
                    "button",
                    {
                      type: "button",
                      class: "z-timegrid__slot",
                      "data-focus-id": model.focusId,
                      "data-date": d,
                      "data-minute": slotHere,
                      s: { "--z-ev-s": slotHere, "--z-ev-d": config.slotDuration },
                      "aria-label": `${dayLong(d, locale)}, ${timeRangeText(dayStart(d) + slotHere, dayStart(d) + slotHere + config.slotDuration, locale)}, ${labels.free}`,
                      tabindex: 0,
                    },
                    h("span", { class: "z-timegrid__slot-text", "aria-hidden": "true" }, timeText(dayStart(d) + slotHere, locale)),
                  )
                : null,
              showNow ? h("div", { class: "z-timegrid__now", "data-today": on(d === model.today), s: { "--z-tg-at": nowMin } }) : null,
            );
          }),
        ),
      ),
    ),
  );
}

function monthGrid(config: AgendaConfig, state: AgendaState, model: AgendaModel): VEl {
  const { labels, locale } = config;
  const weekend = new Set(localeWeekInfo(locale).weekend);
  const weeks: string[][] = [];
  for (let i = 0; i < model.days.length; i += 7) weeks.push(model.days.slice(i, i + 7));
  const month = state.date.slice(0, 7);
  const preview = state.drag ?? state.grabbed;
  const items = model.occurrences.map((o) => (preview?.key === o.key ? { ...o, start: preview.start, end: preview.end } : o));
  const selectedDay = state.date;
  // Sin arrastre, el índice por día memorizado; arrastrando, el de la lista con el provisional.
  const perDay = preview ? byDay(items, model.days) : occurrencesByDay(model.occurrences, model.days);
  const dayItems = sortOccurrences(
    perDay.get(selectedDay) ??
      items.filter((o) => o.start < dayStart(selectedDay) + 1440 && Math.max(o.end, o.start + 1) > dayStart(selectedDay)),
  );
  return h(
    "div",
    { class: "z-monthgrid", role: "grid", "aria-label": model.title, s: { "--z-mg-lanes": Math.max(1, config.dayMaxEvents) } },
    h(
      "div",
      { class: "z-monthgrid__weekdays", role: "row" },
      ...weeks[0]!.map((d) =>
        h(
          "div",
          {
            key: d,
            class: "z-monthgrid__weekday",
            role: "columnheader",
            "data-weekend": on(weekend.has(parse(d).getUTCDay())),
            "aria-label": fmt(locale, { weekday: "long" }).format(parse(d)),
          },
          fmt(locale, { weekday: "short" }).format(parse(d)),
        ),
      ),
    ),
    ...weeks.map((week) => {
      // Solo las ocurrencias de la semana (del índice por día), no la lista del mes entero.
      const inWeek = new Set<Occurrence>();
      for (const d of week) for (const o of perDay.get(d) ?? []) inWeek.add(o);
      const row = layoutRow([...inWeek], week, Math.max(1, config.dayMaxEvents));
      return h(
        "div",
        { key: week[0], class: "z-monthgrid__week", role: "row" },
        ...week.map((d, i) => {
          const count = perDay.get(d) ?? [];
          const id = `d:${d}`;
          const bars = row.bars.filter((b) => b.from === i);
          // El 1 lleva el mes a la vista («Nov 1»): el nombre empieza por ese texto (WCAG 2.5.3).
          const shown = d.endsWith("-01")
            ? `${fmt(locale, { month: "short" }).format(parse(d))} ${fmt(locale, { day: "numeric" }).format(parse(d))}, `
            : "";
          const label = `${shown}${dayLong(d, locale)}, ${count.length === 1 ? labels.event : fill(labels.events, { n: count.length })}`;
          return h(
            "div",
            {
              key: d,
              class: "z-monthgrid__cell",
              role: "gridcell",
              "data-date": d,
              "data-focus-id": id,
              "data-today": on(d === model.today),
              "data-outside": on(d.slice(0, 7) !== month),
              "data-weekend": on(weekend.has(parse(d).getUTCDay())),
              "data-drop": on(Boolean(state.drag && dateOf(state.drag.start) === d)),
              "aria-selected": d === selectedDay ? "true" : "false",
              "aria-current": d === model.today ? "date" : undefined,
              "aria-label": label,
              tabindex: model.focusId === id ? 0 : -1,
            },
            h(
              "span",
              { class: "z-monthgrid__date", "aria-hidden": "true" },
              d.endsWith("-01") ? `${fmt(locale, { month: "short" }).format(parse(d))} ` : "",
              fmt(locale, { day: "numeric" }).format(parse(d)),
            ),
            ...bars.map((bar) =>
              eventButton(
                { o: bar.item, config, model, state, start: bar.item.start, end: bar.item.end },
                bar.item.allDay || bar.span > 1 || bar.contStart || bar.contEnd ? "bar" : "dot",
                { s: { "--z-ev-lane": bar.lane, "--z-ev-span": bar.span }, cont: [bar.contStart, bar.contEnd] },
              ),
            ),
            row.hidden[i]!.length
              ? h(
                  "button",
                  {
                    type: "button",
                    class: "z-agenda__more z-monthgrid__more",
                    "data-more": d,
                    "aria-haspopup": "dialog",
                    "aria-expanded": state.more === d ? "true" : "false",
                    s: { "--z-ev-lane": Math.max(0, config.dayMaxEvents - 1) },
                    tabindex: -1,
                  },
                  fill(labels.more, { n: row.hidden[i]!.length }),
                )
              : null,
            count.length
              ? h(
                  "span",
                  { class: "z-monthgrid__dots", "aria-hidden": "true" },
                  ...count.slice(0, 4).map((o) => h("i", { key: o.key, "data-color": colorOf(o.event, model.sources) })),
                )
              : null,
          );
        }),
      );
    }),
    // Contenedor estrecho: puntos en las celdas y la lista del día elegido debajo.
    h(
      "div",
      { class: "z-monthgrid__daylist" },
      h("h3", { class: "z-monthgrid__daylist-title" }, dayLong(selectedDay, locale)),
      ...(dayItems.length
        ? dayItems.map((o) => eventButton({ o, config, model, state, start: o.start, end: o.end }, "row", { cls: "z-event--list" }))
        : [h("p", { class: "z-monthgrid__daylist-empty" }, config.labels.emptyHint)]),
    ),
  );
}

function agendaList(config: AgendaConfig, state: AgendaState, model: AgendaModel, uid: string): VEl {
  const { labels } = config;
  const perDay = occurrencesByDay(model.occurrences, model.days);
  const groups = model.days.map((d) => ({ d, items: perDay.get(d) ?? [] })).filter((g) => g.items.length);
  if (!groups.length)
    return h(
      "div",
      { class: "z-agendalist z-agendalist--empty" },
      h(
        "div",
        { class: "z-agenda__empty" },
        h("span", { class: "z-agenda__empty-icon", "aria-hidden": "true" }, icon("calendar-days", 22)),
        h("strong", null, labels.empty),
        h("p", null, labels.emptyHint),
      ),
    );
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const virtual = total > LIST_VIRTUAL_FROM;
  const focusKey = model.focusId.startsWith("e:") ? model.focusId.slice(2) : null;
  const children: VNode[] = [];
  if (!virtual) {
    groups.forEach((g, i) => {
      children.push(listGroup(config, state, model, uid, g.d, g.items, null, i, groups.length));
    });
  } else {
    // Ventana virtual (agenda.md §6): de cada día solo las filas que se ven (con un margen), la que lleva el foco y
    // un relleno del alto de las demás; los días enteros fuera de la ventana se juntan en un solo relleno. Las
    // alturas salen de una medida (una lectura tras el primer pintado), no de medir cada fila.
    const m = state.listMetrics ?? LIST_METRICS;
    const top = state.listScroll?.top ?? 0;
    const height = state.listScroll?.height ?? 900;
    const lo = top - LIST_OVERSCAN * m.row;
    const hi = top + height + (LIST_OVERSCAN + LIST_BLOCK) * m.row;
    let y = 0;
    let gap = 0;
    const flushGap = (key: string) => {
      if (gap > 0) children.push(h("div", { key, class: "z-agendalist__spacer", "aria-hidden": "true", s: { "--z-vl-size": `${gap}px` } }));
      gap = 0;
    };
    groups.forEach((g, gi) => {
      const size = Math.max(m.head, m.pad + g.items.length * m.row);
      const focusAt = focusKey ? g.items.findIndex((o) => o.key === focusKey) : -1;
      if ((y + size < lo || y > hi) && focusAt < 0) {
        gap += size;
        y += size;
        return;
      }
      flushGap(`gap-${g.d}`);
      const first = Math.max(0, Math.floor((lo - y - m.pad / 2) / m.row));
      const last = Math.min(g.items.length, Math.ceil((hi - y) / m.row));
      const show = new Set<number>();
      for (let i = first; i < last; i++) show.add(i);
      if (focusAt >= 0) show.add(focusAt);
      children.push(listGroup(config, state, model, uid, g.d, g.items, { show, row: m.row }, gi, groups.length));
      y += size;
    });
    flushGap("gap-end");
  }
  return h("div", { class: "z-agendalist", role: "list", "aria-label": model.title, "data-virtual": on(virtual) }, ...children);
}

/** Un día de la lista. Con `win`, solo las filas de `show` y rellenos en lugar de las demás. */
function listGroup(
  config: AgendaConfig,
  state: AgendaState,
  model: AgendaModel,
  uid: string,
  d: string,
  items: Occurrence[],
  win: { show: Set<number>; row: number } | null,
  index: number,
  count: number,
): VEl {
  const { labels, locale } = config;
  const today = d === model.today;
  const headingId = `${uid}-day-${d}`;
  const nowAt = today ? items.findIndex((o) => o.start > model.now && !o.allDay) : -1;
  const rows: VNode[] = [];
  let skipped = 0;
  const spacer = (key: string) => {
    if (skipped)
      rows.push(
        h("li", { key, class: "z-agendalist__spacer", "aria-hidden": "true", s: { "--z-vl-size": `${skipped * win!.row - 2}px` } }),
      );
    skipped = 0;
  };
  items.forEach((o, i) => {
    if (win && !win.show.has(i)) {
      skipped++;
      return;
    }
    spacer(`sp-${i}`);
    const source = model.sources.get(o.event.calendarId);
    if (i === nowAt)
      rows.push(
        h("li", { key: "now", class: "z-agendalist__now", "aria-hidden": "true" }, `${labels.now} · ${timeText(model.now, locale)}`),
      );
    rows.push(
      h(
        "li",
        {
          key: o.key,
          class: "z-agendalist__item",
          "aria-setsize": win ? items.length : undefined,
          "aria-posinset": win ? i + 1 : undefined,
        },
        eventButton({ o, config, model, state, start: o.start, end: o.end }, "row", { cls: "z-event--list" }),
        source
          ? h(
              "span",
              { class: "z-agendalist__calendar", "aria-hidden": "true", "data-color": colorOf(o.event, model.sources) },
              source.name,
            )
          : null,
      ),
    );
  });
  spacer("sp-end");
  return h(
    "div",
    {
      key: d,
      class: "z-agendalist__day",
      role: "listitem",
      "data-today": on(today),
      "aria-labelledby": headingId,
      "aria-setsize": win ? count : undefined,
      "aria-posinset": win ? index + 1 : undefined,
    },
    h(
      "h3",
      { class: "z-agendalist__date", id: headingId },
      h("span", { class: "z-agendalist__num" }, fmt(locale, { day: "numeric" }).format(parse(d))),
      h(
        "span",
        { class: "z-agendalist__weekday" },
        today
          ? `${labels.today} · ${fmt(locale, { month: "short" }).format(parse(d))}`
          : fmt(locale, { weekday: "short", month: "short" }).format(parse(d)),
      ),
      h("span", { class: "z-sr-only" }, ` ${dayLong(d, locale)}`),
    ),
    h("ul", { class: "z-agendalist__items", role: "list" }, ...rows),
  );
}

/** Línea temporal del día: una fila por recurso (o por calendario) con sus eventos por hora. */
function laneView(config: AgendaConfig, state: AgendaState, model: AgendaModel): VEl {
  const byResource = Boolean(config.resources?.length);
  const rows: ResourceRow[] = byResource
    ? config.resources!
    : config.calendars.filter((c) => !state.hidden.includes(c.id)).map((c) => ({ id: c.id, title: c.name }));
  const base = dayStart(state.date);
  const preview = state.drag ?? state.grabbed;
  const items: ResourceItem[] = [];
  const occ = new Map<string, Occurrence>();
  for (const o of model.occurrences) {
    if (o.allDay) continue;
    const span = preview?.key === o.key ? preview : o;
    for (const rid of byResource ? (o.event.resourceIds ?? []) : [o.event.calendarId]) {
      const key = `${o.key}@${rid}`;
      occ.set(key, o);
      items.push({ key, resourceId: rid, start: span.start - base, end: span.end - base });
    }
  }
  const nowMin = dateOf(model.now) === state.date ? minuteOfDay(model.now) : null;
  return resourceTimeline({
    uid: "agenda",
    resources: rows,
    items,
    dayStart: config.dayStart,
    dayEnd: config.dayEnd,
    now: nowMin,
    locale: config.locale,
    labels: {
      resource: byResource ? config.labels.resources : config.labels.calendars,
      overlaps: config.labels.overlaps,
      newBooking: config.labels.newEvent,
    },
    renderItem: (it, layout) => {
      const o = occ.get(it.key)!;
      return eventButton({ o, config, model, state, start: base + it.start, end: base + it.end }, "lane", {
        s: layout.s,
        cls: `z-timeline__booking${layout.conflict ? " z-event--conflict" : ""}`,
        half: layout.half,
        conflict: layout.conflict,
      });
    },
    ...(byResource
      ? {}
      : {
          renderLabel: (r: ResourceRow) => [
            h("span", {
              class: "z-timeline__dot",
              "data-color": config.calendars.find((c) => c.id === r.id)?.color ?? "1",
              "aria-hidden": "true",
            }),
            h("span", { class: "z-timeline__name" }, r.title),
          ],
        }),
  });
}

function yearView(config: AgendaConfig, state: AgendaState, model: AgendaModel): VEl {
  const counts = new Map<string, number>();
  const first = model.days[0]!;
  const last = model.days[model.days.length - 1]!;
  // Por número de día (minutos / 1440), sin aritmética de cadenas por ocurrencia.
  const a0 = dayStart(first) / 1440;
  const a1 = dayStart(last) / 1440;
  const byNumber = new Map<number, number>();
  for (const o of model.occurrences) {
    const from = Math.max(a0, Math.floor(o.start / 1440));
    const to = Math.min(a1, Math.floor(Math.max(o.start, o.end - 1) / 1440));
    for (let k = from; k <= to; k++) byNumber.set(k, (byNumber.get(k) ?? 0) + 1);
  }
  for (const [k, n] of byNumber) counts.set(dateOf(k * 1440), n);
  return yearGrid({
    year: Number(state.date.slice(0, 4)),
    weekStart: config.weekStart,
    locale: config.locale,
    today: model.today,
    focus: model.focusId.startsWith("d:") ? model.focusId.slice(2) : state.date,
    selected: state.date,
    counts,
    density: config.density,
    labels: { events: config.labels.events, event: config.labels.event, title: model.title },
  });
}

/* ---------- Armazón ---------- */

function popovers(config: AgendaConfig, state: AgendaState, model: AgendaModel, uid: string): VNode[] {
  const { labels, locale } = config;
  const out: VNode[] = [];
  if (state.more) {
    // `state.more`: un día («+N» del mes y de todo el día) o un intervalo del día («+N» de la rejilla de horas).
    const interval = parseInterval(state.more);
    const d = interval?.date ?? state.more;
    const dayList =
      occurrencesByDay(model.occurrences, model.days).get(d) ??
      model.occurrences.filter((o) => o.start < dayStart(d) + 1440 && Math.max(o.end, o.start + 1) > dayStart(d));
    const items = sortOccurrences(
      interval
        ? dayList.filter(
            (o) => !o.allDay && o.start < dayStart(d) + interval.end && Math.max(o.end, o.start + 1) > dayStart(d) + interval.start,
          )
        : dayList,
    );
    const title = interval
      ? `${dayLong(d, locale)}, ${timeRangeText(dayStart(d) + interval.start, dayStart(d) + interval.end, locale)}`
      : dayLong(d, locale);
    out.push(
      h(
        "div",
        {
          key: `more-${state.more}`,
          class: "z-liquid z-popover z-agenda__pop",
          popover: "manual",
          role: "dialog",
          "aria-label": title,
          "data-pop": "more",
          "data-for": state.more,
        },
        h(
          "div",
          { class: "z-agenda__pop-head" },
          h("strong", null, title),
          h("button", { type: "button", class: "z-agenda__icon-btn z-agenda__pop-close", "aria-label": labels.close }, icon("x-mark", 16)),
        ),
        ...items.map((o) => eventButton({ o, config, model, state, start: o.start, end: o.end }, "row", { cls: "z-event--list" })),
      ),
    );
  }
  const detail = state.detail ? model.occurrences.find((o) => o.key === state.detail) : null;
  if (detail) {
    const e = detail.event;
    const source = model.sources.get(e.calendarId);
    const editable = config.editable && e.editable !== false && source?.editable !== false && !detail.allDay;
    out.push(
      h(
        "div",
        {
          key: `detail-${detail.key}`,
          class: "z-liquid z-popover z-agenda__pop z-agenda__detail",
          popover: "manual",
          role: "dialog",
          "aria-label": e.title,
          "data-pop": "detail",
          "data-for": detail.key,
          "data-color": colorOf(e, model.sources),
        },
        h(
          "div",
          { class: "z-agenda__pop-head" },
          h("strong", { class: "z-agenda__detail-title" }, h("span", { class: "z-agenda__swatch", "aria-hidden": "true" }), e.title),
          h("button", { type: "button", class: "z-agenda__icon-btn z-agenda__pop-close", "aria-label": labels.close }, icon("x-mark", 16)),
        ),
        h(
          "dl",
          { class: "z-agenda__detail-list" },
          h("dt", null, icon("clock", 16), h("span", { class: "z-sr-only" }, labels.date)),
          h(
            "dd",
            null,
            detail.allDay
              ? `${dayLong(dateOf(detail.start), locale)} · ${labels.allDay}`
              : `${dayLong(dateOf(detail.start), locale)} · ${timeRangeText(detail.start, detail.end, locale)}`,
          ),
          e.location ? h("dt", null, icon("map-pin", 16)) : null,
          e.location ? h("dd", null, e.location) : null,
          source ? h("dt", null, icon("calendar", 16)) : null,
          source ? h("dd", null, source.name) : null,
          detail.seriesId ? h("dt", null, icon("arrow-path", 16)) : null,
          detail.seriesId ? h("dd", null, labels.repeats) : null,
        ),
        editable
          ? h(
              "div",
              { class: "z-agenda__detail-actions" },
              h(
                "button",
                { type: "button", class: "z-btn z-btn--secondary z-agenda__move-open", "data-size": "sm", "data-key": detail.key },
                labels.moveTo,
              ),
            )
          : null,
      ),
    );
  }
  const moving = state.moving ? model.occurrences.find((o) => o.key === state.moving) : null;
  if (moving) {
    const t = (min: number) => `${pad(Math.floor(minuteOfDay(min) / 60))}:${pad(minuteOfDay(min) % 60)}`;
    out.push(
      h(
        "dialog",
        {
          key: `move-${moving.key}`,
          class: "z-liquid z-modal z-agenda__move",
          "aria-labelledby": `${uid}-move-title`,
          "data-for": moving.key,
        },
        h(
          "form",
          { method: "dialog", class: "z-agenda__move-form" },
          h("h2", { class: "z-modal__title", id: `${uid}-move-title` }, `${labels.moveTo.replace(/…$/, "")} · ${moving.event.title}`),
          h(
            "label",
            { class: "z-agenda__move-field" },
            h("span", null, labels.date),
            h("input", { class: "z-agenda__move-input", type: "date", name: "date", value: dateOf(moving.start), required: true }),
          ),
          h(
            "label",
            { class: "z-agenda__move-field" },
            h("span", null, labels.start),
            h("input", {
              class: "z-agenda__move-input",
              type: "time",
              name: "start",
              value: t(moving.start),
              step: config.snapDuration * 60,
              required: true,
            }),
          ),
          h(
            "label",
            { class: "z-agenda__move-field" },
            h("span", null, labels.end),
            h("input", {
              class: "z-agenda__move-input",
              type: "time",
              name: "end",
              value: t(moving.end),
              step: config.snapDuration * 60,
              required: true,
            }),
          ),
          h(
            "div",
            { class: "z-agenda__move-actions" },
            h("button", { type: "button", class: "z-btn z-btn--ghost z-agenda__move-cancel", "data-size": "sm" }, labels.cancel),
            h(
              "button",
              { type: "submit", class: "z-btn z-btn--primary z-agenda__move-apply", "data-size": "sm", value: "move" },
              labels.move,
            ),
          ),
        ),
      ),
    );
  }
  return out;
}

// Funciones del minicalendario con la misma identidad mientras no cambie el rango: su binding no vuelve a pintarlo.
const never = () => false;
const inViews = new Map<string, (d: string) => boolean>();
function inViewOf(first: string, last: string): (d: string) => boolean {
  const key = `${first}|${last}`;
  let fn = inViews.get(key);
  if (!fn) {
    if (inViews.size > 32) inViews.clear();
    fn = (d: string) => d >= first && d <= last;
    inViews.set(key, fn);
  }
  return fn;
}

/** Árbol completo del EventCalendar. `model.focusId` se resuelve aquí. */
export function agendaTree(
  config: AgendaConfig,
  state: AgendaState,
  nowMs: number,
  rootAttrs: Record<string, VAttr> = {},
): { tree: VEl; model: AgendaModel } {
  const model = buildModel(config, state, nowMs);
  const uid = String(rootAttrs.id ?? "z-agenda");
  const { labels, locale } = config;
  const grid = state.view === "day" || state.view === "week" || state.view === "workweek";
  const plan = grid ? planTimeGrid(config, state, model) : null;
  const ids = new Set<string>();
  // Lo que está detrás de un «+N» no tiene pieza en la rejilla: no puede llevar el tabulador.
  for (const o of model.occurrences) if (!plan?.hidden.has(o.key)) ids.add(`e:${o.key}`);
  for (const d of model.days) ids.add(`d:${d}`);
  for (const c of plan?.chips ?? []) ids.add(c);
  const valid =
    state.focus &&
    (state.focus.startsWith("s:")
      ? model.days.includes(state.focus.split(":")[1]!) && state.view !== "month" && state.view !== "agenda"
      : state.view === "month" || state.view === "year"
        ? ids.has(state.focus)
        : (state.focus.startsWith("e:") || state.focus.startsWith("m:")) && ids.has(state.focus));
  model.focusId = valid ? state.focus! : fallbackFocus(state, model, config, plan);

  const view =
    state.view === "month"
      ? monthGrid(config, state, model)
      : state.view === "agenda"
        ? agendaList(config, state, model, uid)
        : state.view === "year"
          ? yearView(config, state, model)
          : state.view === "timeline"
            ? laneView(config, state, model)
            : state.view === "perpetual"
              ? h(
                  "div",
                  { class: "z-perpetual z-agenda__perpetual" },
                  perpetualTree({
                    uid,
                    year: Number(state.date.slice(0, 4)),
                    weekStart: config.weekStart,
                    locale,
                    highlight: state.date,
                    today: model.today,
                    labels: { ...PERPETUAL_LABELS, ...labels.perpetual },
                  }),
                )
              : timeGrid(config, state, model, plan!);
  const counts = new Map<string, number>();
  // Con todos los calendarios visibles, las ocurrencias ya están calculadas.
  for (const o of state.hidden.length
    ? expandEvents({ events: config.events, from: model.days[0]!, to: model.days[model.days.length - 1]!, timeZone: state.timeZone })
    : model.occurrences)
    counts.set(o.event.calendarId, (counts.get(o.event.calendarId) ?? 0) + 1);
  const hidden = new Set(state.hidden);
  const inView = inViewOf(model.days[0]!, model.days[model.days.length - 1]!);

  const side = config.sidebar
    ? h(
        "aside",
        { class: "z-agenda__side z-liquid", "aria-label": labels.calendars },
        config.createButton
          ? h(
              "button",
              { type: "button", class: "z-btn z-btn--primary z-agenda__create", "data-size": "md" },
              icon("plus", 16),
              labels.newEvent,
            )
          : null,
        {
          slot: "minical",
          k: "minical",
          p: {
            value: state.date,
            today: model.today,
            locale,
            weekStart: config.weekStart,
            showWeekNumber: config.showWeekNumber,
            // La banda de la semana visible solo en las rejillas de horas: en el mes lo teñiría todo.
            inView: ["month", "agenda", "year", "perpetual"].includes(state.view) ? never : inView,
            hasEvents: hasEventsOf(model.occurrences),
            attrs: {
              "data-mode": "single",
              "data-value": state.date,
              "data-today": model.today,
              "data-locale": locale,
              "data-week-start": config.weekStart,
              "data-week-numbers": on(config.showWeekNumber),
              "data-cell-size": "sm",
              "data-weekday-format": "narrow",
            },
          },
        },
        config.calendars.length
          ? h(
              "div",
              { class: "z-agenda__calendars", role: "group", "aria-labelledby": `${uid}-calendars` },
              h("p", { class: "z-agenda__calendars-label", id: `${uid}-calendars` }, labels.calendars),
              ...config.calendars.map((c) =>
                h(
                  "label",
                  { key: c.id, class: "z-agenda__calendar", "data-color": c.color, "data-off": on(hidden.has(c.id)) },
                  h("input", { type: "checkbox", class: "z-agenda__check", "data-calendar": c.id, checked: !hidden.has(c.id) }),
                  h("span", { class: "z-agenda__calendar-name" }, c.name),
                  h("span", { class: "z-agenda__count", "aria-hidden": "true" }, String(counts.get(c.id) ?? 0)),
                ),
              ),
            )
          : null,
      )
    : null;

  const zone = zoneLabel(state.timeZone, Date.now(), locale);
  const toolbar = h(
    "div",
    { class: "z-agenda__toolbar" },
    h("button", { type: "button", class: "z-btn z-btn--secondary z-agenda__today", "data-size": "sm" }, labels.today),
    h(
      "span",
      { class: "z-agenda__nav" },
      h(
        "button",
        { type: "button", class: "z-agenda__icon-btn", "data-nav": "previous", "aria-label": labels.previous },
        icon("chevron-left", 16),
      ),
      h(
        "button",
        { type: "button", class: "z-agenda__icon-btn", "data-nav": "next", "aria-label": labels.next },
        icon("chevron-right", 16),
      ),
    ),
    h(
      "h2",
      { class: "z-agenda__title", "aria-live": "polite" },
      model.title,
      model.weekLabel ? h("span", { class: "z-agenda__week" }, ` · ${model.weekLabel}`) : null,
    ),
    h("span", { class: "z-agenda__spacer" }),
    config.timeZones?.length
      ? h(
          "span",
          { class: "z-agenda__zone" },
          icon("globe-alt", 14),
          h(
            "select",
            { class: "z-agenda__zone-select", "aria-label": labels.timeZone },
            ...[...new Set([state.timeZone, ...config.timeZones])].map((tz) =>
              h(
                "option",
                { key: tz, value: tz, selected: tz === state.timeZone },
                `${zoneCity(tz)} · ${zoneLabel(tz, Date.now(), locale)}`,
              ),
            ),
          ),
          icon("chevron-up-down", 14),
        )
      : h(
          "span",
          { class: "z-agenda__zone" },
          icon("globe-alt", 14),
          h("span", { class: "z-sr-only" }, `${labels.timeZone}: `),
          `${zoneCity(state.timeZone)} `,
          h("span", { class: "z-agenda__zone-offset" }, zone),
        ),
    config.views.length > 1
      ? h(
          "div",
          { class: "z-segmented z-agenda__views", role: "group", "aria-label": labels.viewsLabel },
          ...config.views.map((v) =>
            h(
              "button",
              {
                key: v,
                type: "button",
                class: "z-segmented__item",
                "data-view": v,
                "aria-current": v === state.view ? "true" : undefined,
                "data-state": v === state.view ? "on" : "off",
              },
              h("span", { class: "z-segmented__label" }, labels.views[v]),
            ),
          ),
        )
      : null,
    // Selector compacto de vista: lo mismo en un solo control para cuando el segmentado no cabe en una fila (la hoja
    // muestra uno u otro según el ancho de la agenda). Un <select> nativo: teclado y nombre accesible de serie.
    config.views.length > 1
      ? h(
          "span",
          { class: "z-agenda__view-picker" },
          h(
            "select",
            { class: "z-agenda__view-select", "aria-label": labels.viewsLabel },
            ...config.views.map((v) => h("option", { key: v, value: v, selected: v === state.view }, labels.views[v])),
          ),
          icon("chevron-up-down", 14),
        )
      : null,
  );

  const grabbing = Boolean(state.grabbed);
  const tree = h(
    "div",
    {
      ...rootAttrs,
      class: `z-agenda${rootAttrs.class ? ` ${rootAttrs.class}` : ""}`,
      "data-view": state.view,
      "data-date": state.date,
      "data-time-zone": state.timeZone,
      "data-sidebar": on(Boolean(side)),
      "data-dragging": on(Boolean(state.drag)),
    },
    h(
      "div",
      { class: "z-agenda__frame" },
      side,
      h(
        "section",
        { class: "z-agenda__main z-liquid", "aria-label": labels.calendar },
        toolbar,
        h(
          "div",
          {
            class: "z-agenda__view",
            "data-view": state.view,
            s: { "--z-tg-start": config.dayStart, "--z-tg-end": config.dayEnd, "--z-tg-days": model.days.length },
          },
          view,
        ),
        grabbing ? h("p", { class: "z-agenda__hint", "aria-hidden": "true" }, labels.grabHint) : null,
      ),
    ),
    ...popovers(config, state, model, uid),
    h("div", { key: "live", class: "z-sr-only z-agenda__live", role: "status", "aria-live": "polite" }),
  );
  return { tree, model };
}

/** Días entre dos fechas (para el teclado del mes). */
export const daysBetween = diffDays;
export { addDays };
