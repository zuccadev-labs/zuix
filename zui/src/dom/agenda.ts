// EventCalendar sin framework: un `.z-agenda` dentro de `[data-z-dom]` se pinta con el mismo árbol que el binding de
// React (core/agenda-view) y la misma interacción (core/agenda-control). Configuración en atributos `data-*`
// (data-view, data-date, data-time-zone, data-locale, data-week-start, data-editable, data-selectable…); eventos y
// calendarios por propiedad (`setAgendaEvents(el, events)`, `setAgendaCalendars(el, calendars)`) o en hijos
// `<script type="application/json" data-events>` y `data-calendars`. Los cambios salen como `z:eventchange`,
// `z:eventclick`, `z:selectslot`, `z:datechange`, `z:viewchange`, `z:quickcreate`, `z:calendartoggle` y
// `z:timezonechange`. El texto de la aplicación entra siempre como texto (nodos de texto, nunca marcado).

import { iconSvg, registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { arrowPath } from "@zuccadev-labs/zuix-zicon/icons/arrow-path";
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
import { AGENDA_VIEWS, clockMinutes, type AgendaView, type CalendarEvent, type CalendarSource } from "../core/agenda";
import { attachAgenda, beginFocusMove, everyMinute, syncAgenda, type AgendaEventName, type AgendaHost } from "../core/agenda-control";
import {
  agendaTree,
  DEFAULT_LABELS,
  initialState,
  type AgendaConfig,
  type AgendaLabels,
  type AgendaModel,
  type AgendaState,
  type VNode,
} from "../core/agenda-view";
import { localeWeekInfo, todayISO, valid } from "../core/date";
import { safeTimeZone } from "../core/zone";
import { setCalendarOptions } from "./forms-calendar";
import { emit, inDom } from "./forms-popup";
import { fragment, type Listen } from "./shared";

registerIcons([arrowPath, calendar, calendarDays, chevronLeft, chevronRight, chevronUpDown, clock, globeAlt, mapPin, plus, xMark]);

interface Entry {
  state: AgendaState;
  model: AgendaModel | null;
  events: CalendarEvent[] | null;
  calendars: CalendarSource[] | null;
  labels: Partial<AgendaLabels>;
  detach: () => void;
  stopClock: () => void;
}
const entries = new WeakMap<HTMLElement, Entry>();
const keys = new WeakMap<Node, string>();

const json = <T>(el: HTMLElement, selector: string): T | null => {
  const script = el.querySelector<HTMLScriptElement>(`:scope > script[type="application/json"]${selector}`);
  if (!script?.textContent) return null;
  try {
    return JSON.parse(script.textContent) as T;
  } catch {
    return null;
  }
};
const yes = (v: string | undefined) => v !== undefined && v !== "false";
const num = (v: string | undefined, fallback: number) => (v !== undefined && Number.isFinite(Number(v)) ? Number(v) : fallback);

function configOf(el: HTMLElement, entry: Entry): AgendaConfig {
  const d = el.dataset;
  const views = (d.views ?? "").split(/[\s,]+/).filter((v): v is AgendaView => (AGENDA_VIEWS as readonly string[]).includes(v));
  const locale = d.locale;
  const zones = d.timeZones?.split(/[\s,]+/).filter(Boolean);
  const now = d.now ? Date.parse(d.now) : undefined;
  return {
    events: entry.events ?? json<CalendarEvent[]>(el, "[data-events]") ?? [],
    calendars: entry.calendars ?? json<CalendarSource[]>(el, "[data-calendars]") ?? [],
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
    labels: { ...DEFAULT_LABELS, ...entry.labels, views: { ...DEFAULT_LABELS.views, ...entry.labels.views } },
    today: valid(d.today) ? d.today : undefined,
    now: Number.isFinite(now) ? now : undefined,
  };
}

/* ---------- Árbol → nodos ---------- */

function create(v: VNode, doc: Document): Node {
  if (typeof v === "string") return doc.createTextNode(v);
  if (!v) return doc.createTextNode("");
  if ("slot" in v) {
    if (v.slot === "icon") {
      const frag = fragment(iconSvg(String(v.p.name), { size: Number(v.p.size) }));
      const svg = frag.firstElementChild ?? doc.createElement("span");
      keys.set(svg, `icon:${v.p.name}:${v.p.size}`);
      return svg;
    }
    const cal = doc.createElement("div");
    cal.className = "z-calendar z-agenda__minical";
    keys.set(cal, "minical");
    return cal;
  }
  const el = doc.createElement(v.t);
  if (v.k !== undefined) keys.set(el, `${v.t}:${v.k}`);
  else keys.set(el, v.t);
  patchElement(el, v, true);
  return el;
}

const keyOf = (v: VNode): string =>
  typeof v === "string" || !v
    ? "#text"
    : "slot" in v
      ? v.slot === "icon"
        ? `icon:${v.p.name}:${v.p.size}`
        : "minical"
      : v.k !== undefined
        ? `${v.t}:${v.k}`
        : v.t;

function patchElement(el: Element, v: Exclude<VNode, string | null | undefined | false | { slot: string }>, fresh = false): void {
  if ("slot" in v) return;
  const want = new Map<string, string>();
  for (const [k, value] of Object.entries(v.a ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (k === "value" && !fresh) continue; // lo que teclea la persona en un campo no se pisa
    want.set(k, value === true ? "" : String(value));
  }
  for (const attr of [...el.attributes])
    if (!want.has(attr.name) && attr.name !== "style" && attr.name !== "open") el.removeAttribute(attr.name);
  for (const [k, value] of want) if (el.getAttribute(k) !== value) el.setAttribute(k, value);
  if (el instanceof HTMLInputElement && el.type === "checkbox") el.checked = want.has("checked");
  if (el instanceof HTMLOptionElement) el.selected = want.has("selected");
  if (el instanceof HTMLElement) {
    const style = el.style;
    for (const name of [...style].filter((p) => p.startsWith("--") && !(v.s && p in v.s))) style.removeProperty(name);
    for (const [k, value] of Object.entries(v.s ?? {}))
      if (style.getPropertyValue(k) !== String(value)) style.setProperty(k, String(value));
    if (!v.s && !style.length) el.removeAttribute("style");
  }
  patchChildren(el, v.c ?? []);
}

function patchChildren(parent: Element, kids: VNode[]): void {
  const doc = parent.ownerDocument;
  const existing = [...parent.childNodes];
  kids.forEach((v, i) => {
    const cur = existing[i];
    const key = keyOf(v);
    if (cur && (cur.nodeType === Node.TEXT_NODE ? key === "#text" : keys.get(cur) === key)) {
      if (cur.nodeType === Node.TEXT_NODE) {
        if (cur.textContent !== v) cur.textContent = v as string;
      } else if (typeof v === "object" && v && !("slot" in v)) patchElement(cur as Element, v);
      return;
    }
    const node = create(v, doc);
    if (cur) parent.replaceChild(node, cur);
    else parent.append(node);
  });
  for (let i = existing.length - 1; i >= kids.length; i--) existing[i]!.remove();
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
  patchChildren(el, tree.c ?? []);
  el.append(...scripts);
  // Minicalendario: el Calendar del modo DOM, con el día de la vista y la semana visible.
  const slot = findSlot(tree.c ?? []);
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

function findSlot(nodes: VNode[]): Record<string, unknown> | null {
  for (const n of nodes) {
    if (!n || typeof n === "string") continue;
    if ("slot" in n) {
      if (n.slot === "minical") return n.p;
      continue;
    }
    const inner = findSlot(n.c ?? []);
    if (inner) return inner;
  }
  return null;
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
      { views: [...AGENDA_VIEWS], timeZone: safeTimeZone(d.timeZone) },
      ((AGENDA_VIEWS as readonly string[]).includes(d.view ?? "") ? d.view : "week") as AgendaView,
      valid(d.date) ? d.date : today,
    ),
    model: null,
    events: null,
    calendars: null,
    labels: json<Partial<AgendaLabels>>(el, "[data-labels]") ?? {},
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
  entries.delete(el);
}

export type { CalendarEvent, CalendarSource };
