// EventCalendar sin framework: un `.z-agenda` dentro de `[data-z-dom]` se pinta con el mismo árbol que el binding de
// React (core/agenda-view) y la misma interacción (core/agenda-control). Configuración en atributos `data-*`
// (data-view, data-date, data-time-zone, data-locale, data-week-start, data-editable, data-selectable…); eventos y
// calendarios por propiedad (`setAgendaEvents(el, events)`, `setAgendaCalendars(el, calendars)`) o en hijos
// `<script type="application/json" data-events>` y `data-calendars`. Los cambios salen como `z:eventchange`,
// `z:eventclick`, `z:selectslot`, `z:datechange`, `z:viewchange`, `z:quickcreate`, `z:calendartoggle` y
// `z:timezonechange`. El texto de la aplicación entra siempre como texto (nodos de texto, nunca marcado).

import { registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { arrowPath } from "@zuccadev-labs/zuix-zicon/icons/arrow-path";
import { buildingOffice } from "@zuccadev-labs/zuix-zicon/icons/building-office";
import { exclamationTriangle } from "@zuccadev-labs/zuix-zicon/icons/exclamation-triangle";
import { calendar } from "@zuccadev-labs/zuix-zicon/icons/calendar";
import { calendarDays } from "@zuccadev-labs/zuix-zicon/icons/calendar-days";
import { chevronLeft } from "@zuccadev-labs/zuix-zicon/icons/chevron-left";
import { chevronRight } from "@zuccadev-labs/zuix-zicon/icons/chevron-right";
import { chevronUpDown } from "@zuccadev-labs/zuix-zicon/icons/chevron-up-down";
import { clock } from "@zuccadev-labs/zuix-zicon/icons/clock";
import { globeAlt } from "@zuccadev-labs/zuix-zicon/icons/globe-alt";
import { mapPin } from "@zuccadev-labs/zuix-zicon/icons/map-pin";
import { plus } from "@zuccadev-labs/zuix-zicon/icons/plus";
import { xMark } from "@zuccadev-labs/zuix-zicon/icons/x-mark";
import { AGENDA_VIEWS, ALL_AGENDA_VIEWS, clockMinutes, type AgendaView, type CalendarEvent, type CalendarSource } from "../core/agenda";
import { attachAgenda, beginFocusMove, everyMinute, syncAgenda, type AgendaEventName, type AgendaHost } from "../core/agenda-control";
import {
  agendaTree,
  mergeLabels,
  initialState,
  type AgendaConfig,
  type AgendaLabelsInput,
  type AgendaModel,
  type AgendaState,
} from "../core/agenda-view";
import { findSlots } from "../core/vnode";
import { localeWeekInfo, todayISO, valid } from "../core/date";
import { safeTimeZone } from "../core/zone";
import { afterPaint } from "../core/idle";
import { setCalendarOptions } from "./forms-calendar";
import { emit, inDom } from "./forms-popup";
import type { Listen } from "./shared";
import { patchChildren } from "./vtree";

registerIcons([
  arrowPath,
  buildingOffice,
  exclamationTriangle,
  calendar,
  calendarDays,
  chevronLeft,
  chevronRight,
  chevronUpDown,
  clock,
  globeAlt,
  mapPin,
  plus,
  xMark,
]);

interface Entry {
  state: AgendaState;
  model: AgendaModel | null;
  events: CalendarEvent[] | null;
  calendars: CalendarSource[] | null;
  labels: AgendaLabelsInput;
  /** Contenido propio de cada evento y carga por rango (setAgendaOptions). */
  renderEvent?: (detail: Record<string, unknown>) => Node | string | null | undefined;
  loadEvents?: (range: { from: string; to: string; timeZone: string }, signal: AbortSignal) => Promise<CalendarEvent[]>;
  /** Vista de año: densidad 0…3 de un día (setAgendaOptions). */
  density?: (date: string, count: number) => number;
  loaded: CalendarEvent[];
  /** Eventos propios más los cargados, con la misma lista mientras no cambien (la agenda indexa por lista). */
  merged?: { own: CalendarEvent[]; loaded: CalendarEvent[]; list: CalendarEvent[] };
  range: string;
  abort?: AbortController;
  detach: () => void;
  stopClock: () => void;
}
const entries = new WeakMap<HTMLElement, Entry>();

// Datos de los `<script type="application/json">` hijos: se analizan una vez por texto, así cada pintado recibe la
// misma lista (la agenda indexa y memoriza por lista) y no se vuelve a leer el JSON en cada tecla.
const parsed = new WeakMap<HTMLScriptElement, { text: string; value: unknown }>();
const json = <T>(el: HTMLElement, selector: string): T | null => {
  const script = el.querySelector<HTMLScriptElement>(`:scope > script[type="application/json"]${selector}`);
  const text = script?.textContent;
  if (!script || !text) return null;
  const hit = parsed.get(script);
  if (hit?.text === text) return hit.value as T | null;
  let value: unknown = null;
  try {
    value = JSON.parse(text);
  } catch {
    value = null;
  }
  parsed.set(script, { text, value });
  return value as T | null;
};
const yes = (v: string | undefined) => v !== undefined && v !== "false";
const num = (v: string | undefined, fallback: number) => (v !== undefined && Number.isFinite(Number(v)) ? Number(v) : fallback);

const NO_EVENTS: CalendarEvent[] = [];
const NO_CALENDARS: CalendarSource[] = [];
function eventsOf(el: HTMLElement, entry: Entry): CalendarEvent[] {
  const own = entry.events ?? json<CalendarEvent[]>(el, "[data-events]") ?? NO_EVENTS;
  if (!entry.loaded.length) return own;
  if (entry.merged?.own !== own || entry.merged.loaded !== entry.loaded)
    entry.merged = { own, loaded: entry.loaded, list: [...own, ...entry.loaded] };
  return entry.merged.list;
}

function configOf(el: HTMLElement, entry: Entry): AgendaConfig {
  const d = el.dataset;
  const views = (d.views ?? "").split(/[\s,]+/).filter((v): v is AgendaView => (ALL_AGENDA_VIEWS as readonly string[]).includes(v));
  const locale = d.locale;
  const zones = d.timeZones?.split(/[\s,]+/).filter(Boolean);
  const now = d.now ? Date.parse(d.now) : undefined;
  return {
    events: eventsOf(el, entry),
    density: entry.density,
    customEvents: Boolean(entry.renderEvent),
    calendars: entry.calendars ?? json<CalendarSource[]>(el, "[data-calendars]") ?? NO_CALENDARS,
    views: views.length ? views : [...AGENDA_VIEWS],
    timeZone: safeTimeZone(d.timeZone),
    timeZones: zones?.length ? zones : undefined,
    secondaryTimeZone: d.secondaryTimeZone || undefined,
    locale,
    weekStart: num(d.weekStart, localeWeekInfo(locale).firstDay) % 7,
    hiddenDays: d.hiddenDays
      ?.split(/[\s,]+/)
      .map(Number)
      .filter(Number.isInteger),
    dayStart: clockMinutes(d.dayStart, 0),
    dayEnd: clockMinutes(d.dayEnd, 1440),
    slotDuration: Math.max(5, num(d.slotDuration, 30)),
    snapDuration: Math.max(1, num(d.snapDuration, 15)),
    businessHours: json(el, "[data-business-hours]") ?? undefined,
    editable: yes(d.editable),
    selectable: yes(d.selectable),
    dayMaxEvents: Math.max(1, num(d.dayMaxEvents, 3)),
    fixedWeeks: yes(d.fixedWeeks),
    listDays: Math.max(1, num(d.listDays, 14)),
    sidebar: d.sidebar !== "false",
    showWeekNumber: d.weekNumbers !== "false",
    createButton: yes(d.createButton),
    labels: mergeLabels(entry.labels),
    resources: json(el, "[data-resources]") ?? undefined,
    today: valid(d.today) ? d.today : undefined,
    now: Number.isFinite(now) ? now : undefined,
  };
}

/* ---------- Pintado ---------- */

function render(el: HTMLElement, moveFocus = false): void {
  const entry = entries.get(el);
  if (!entry) return;
  const config = configOf(el, entry);
  const { tree, model } = agendaTree(config, entry.state, Date.now(), { id: el.id || undefined });
  entry.model = model;
  const scripts = [...el.querySelectorAll(":scope > script")];
  // La raíz es el propio elemento: sus atributos de estado y sus hijos (los <script> de datos se quedan).
  for (const [k, value] of Object.entries(tree.a ?? {})) {
    if (k === "id" || k === "class") continue;
    if (value === undefined || value === null || value === false) el.removeAttribute(k);
    else el.setAttribute(k, value === true ? "" : String(value));
  }
  el.classList.add("z-agenda");
  for (const s of scripts) s.remove();
  // Una pieza con el foco que el parcheo mueve de sitio (la lista con ventana virtual al desplazarse) sale y vuelve
  // a entrar en el documento: el foco se le devuelve, como hace React al reordenar.
  const active = el.ownerDocument.activeElement;
  patchChildren(el, tree.c ?? [], { event: entry.renderEvent });
  if (active instanceof HTMLElement && active !== el.ownerDocument.activeElement && active.isConnected && el.contains(active))
    active.focus({ preventScroll: true });
  el.append(...scripts);
  // Rango visible: z:rangechange y, con loadEvents, la carga de sus eventos (cancela la anterior).
  const range = `${entry.state.view}|${model.days[0]}|${model.days[model.days.length - 1]}|${entry.state.timeZone}`;
  if (range !== entry.range) {
    entry.range = range;
    const [view, from, to, timeZone] = range.split("|") as [string, string, string, string];
    entry.abort?.abort();
    const abort = new AbortController();
    entry.abort = abort;
    // Fuera del camino de la interacción: primero se pinta la vista; el aviso y la carga, justo después.
    afterPaint(
      () => {
        emit(el, "rangechange", { from, to, view });
        if (!entry.loadEvents) return;
        el.setAttribute("aria-busy", "true");
        entry
          .loadEvents({ from, to, timeZone }, abort.signal)
          .then((list) => {
            if (abort.signal.aborted) return;
            entry.loaded = list;
            render(el);
          })
          .catch(() => {})
          .finally(() => {
            if (!abort.signal.aborted) el.removeAttribute("aria-busy");
          });
      },
      { signal: abort.signal },
    );
  }
  // Minicalendario: el Calendar del modo DOM, con el día de la vista y la semana visible.
  const slot = findSlots(tree.c ?? [], "minical")[0]?.p;
  const cal = el.querySelector<HTMLElement>(".z-agenda__minical");
  if (slot && cal) {
    const attrs = slot.attrs as Record<string, string | undefined>;
    const month = String(slot.value).slice(0, 7);
    if (cal.dataset.value !== slot.value && cal.dataset.month && cal.dataset.month !== month) delete cal.dataset.month;
    for (const [k, value] of Object.entries(attrs)) {
      if (value === undefined) cal.removeAttribute(k);
      else cal.setAttribute(k, value);
    }
    setCalendarOptions(cal, {
      modifiers: { "in-view": slot.inView as (d: string) => boolean, "has-events": slot.hasEvents as (d: string) => boolean },
    });
  }
  syncAgenda(el, hostOf(el), moveFocus, clockMinutes(el.dataset.scrollTime, 480));
}

const EVENT_NAMES: Record<AgendaEventName, string> = {
  "event-click": "eventclick",
  "event-change": "eventchange",
  "select-slot": "selectslot",
  "date-change": "datechange",
  "view-change": "viewchange",
  "quick-create": "quickcreate",
  "calendar-toggle": "calendartoggle",
  "time-zone-change": "timezonechange",
};

const hosts = new WeakMap<HTMLElement, AgendaHost>();
function hostOf(el: HTMLElement): AgendaHost {
  let host = hosts.get(el);
  if (!host) {
    host = {
      config: () => configOf(el, entries.get(el)!),
      state: () => entries.get(el)!.state,
      model: () => entries.get(el)?.model ?? null,
      update(patch, focus) {
        const entry = entries.get(el);
        if (!entry) return;
        entry.state = { ...entry.state, ...patch };
        if (patch.view) el.dataset.view = patch.view;
        if (patch.date) el.dataset.date = patch.date;
        if (focus) beginFocusMove(el);
        render(el, Boolean(focus));
      },
      emit(name, detail) {
        emit(el, EVENT_NAMES[name], detail);
      },
    };
    hosts.set(el, host);
  }
  return host;
}

function mount(el: HTMLElement): void {
  if (entries.has(el)) {
    render(el);
    return;
  }
  const d = el.dataset;
  const today = valid(d.today) ? d.today : todayISO();
  const entry: Entry = {
    state: initialState(
      { views: [...ALL_AGENDA_VIEWS], timeZone: safeTimeZone(d.timeZone) },
      ((ALL_AGENDA_VIEWS as readonly string[]).includes(d.view ?? "") ? d.view : "week") as AgendaView,
      valid(d.date) ? d.date : today,
    ),
    model: null,
    events: null,
    calendars: null,
    labels: json<AgendaLabelsInput>(el, "[data-labels]") ?? {},
    loaded: [],
    range: "",
    detach: () => {},
    stopClock: () => {},
  };
  entries.set(el, entry);
  // Lo que hubiera de marcado de servidor se sustituye por el árbol.
  for (const child of [...el.childNodes]) if (!(child instanceof HTMLScriptElement)) child.remove();
  entry.detach = attachAgenda(el, hostOf(el));
  entry.stopClock = everyMinute(() => render(el));
  // El minicalendario avisa con z:change: la agenda va a ese día.
  el.addEventListener("z:change", (event) => {
    const target = event.target as HTMLElement;
    if (!target.matches?.(".z-agenda__minical")) return;
    event.stopPropagation();
    const value = (event as CustomEvent<{ value: unknown }>).detail?.value;
    if (typeof value === "string" && value !== entry.state.date) {
      hostOf(el).update({ date: value, focus: null, more: null, detail: null });
      emit(el, "datechange", { date: value });
    }
  });
  render(el);
}

/** Eventos de un EventCalendar del modo DOM (sustituyen a los del `<script data-events>`). */
export function setAgendaEvents(el: HTMLElement, events: CalendarEvent[]): void {
  const entry = entries.get(el);
  if (!entry) return;
  entry.events = events;
  render(el);
}

/** Calendarios (nombre, color, visibilidad) de un EventCalendar del modo DOM. */
export function setAgendaCalendars(el: HTMLElement, calendars: CalendarSource[]): void {
  const entry = entries.get(el);
  if (!entry) return;
  entry.calendars = calendars;
  render(el);
}

/**
 * Opciones con funciones de un EventCalendar del modo DOM: `renderEvent` (contenido visible de cada evento: texto o
 * nodos), `loadEvents` (carga de los eventos del rango visible) y `density` (vista de año: nivel 0…3 de un día a
 * partir de su número de eventos). Emite `z:rangechange` al cambiar de rango.
 */
export function setAgendaOptions(
  el: HTMLElement,
  options: {
    renderEvent?: (detail: Record<string, unknown>) => Node | string | null | undefined;
    loadEvents?: (range: { from: string; to: string; timeZone: string }, signal: AbortSignal) => Promise<CalendarEvent[]>;
    density?: (date: string, count: number) => number;
  },
): void {
  const entry = entries.get(el);
  if (!entry) return;
  if ("density" in options) entry.density = options.density;
  if ("renderEvent" in options) entry.renderEvent = options.renderEvent;
  if ("loadEvents" in options) {
    entry.loadEvents = options.loadEvents;
    entry.range = "";
  }
  // El contenido propio cambia: los eventos se vuelven a crear.
  if ("renderEvent" in options) for (const child of [...el.childNodes]) if (!(child instanceof HTMLScriptElement)) child.remove();
  render(el);
}

/** Cambia la vista o el día de un EventCalendar del modo DOM. */
export function setAgendaView(el: HTMLElement, options: { view?: AgendaView; date?: string }): void {
  const entry = entries.get(el);
  if (!entry) return;
  hostOf(el).update({ ...(options.view ? { view: options.view } : {}), ...(valid(options.date) ? { date: options.date } : {}) });
}

export function setup(_on: Listen): void {}

export function hydrate(root: ParentNode): void {
  const list = [...root.querySelectorAll<HTMLElement>(".z-agenda")];
  if (root instanceof HTMLElement && root.matches(".z-agenda")) list.unshift(root);
  for (const el of list) if (inDom(el) && !el.parentElement?.closest(".z-agenda")) mount(el);
}

/** Desmonta un EventCalendar (listeners y reloj). */
export function destroyAgenda(el: HTMLElement): void {
  const entry = entries.get(el);
  if (!entry) return;
  entry.detach();
  entry.stopClock();
  entry.abort?.abort();
  entries.delete(el);
}

export type { CalendarEvent, CalendarSource };
