// Interacción de la agenda (EventCalendar), la misma para el binding de React y el modo DOM: los dos pintan el árbol
// de core/agenda-view y conectan aquí los eventos del elemento raíz. Teclado (tabindex itinerante, navegación
// espacial, agarrar–mover–soltar), puntero (mover, redimensionar, crear arrastrando, con captura y desplazamiento
// automático), popovers y diálogo «Mover a…» (alternativa sin arrastre, WCAG 2.5.7), y una región viva con
// retraso. Lee la geometría en cada tecla o movimiento (getBoundingClientRect) y calcula con core/agenda.
// Sin efectos al importar: todo empieza en `attachAgenda`.

import {
  dateOf,
  dayStart,
  minuteOfDay,
  moveSpan,
  resizeSpan,
  rewriteSpan,
  shiftDate,
  snap,
  type AgendaView,
  type CalendarEvent,
  type Occurrence,
} from "./agenda";
import type { AgendaConfig, AgendaModel, AgendaState, DragPreview, ListMetrics } from "./agenda-view";
import { LIST_BLOCK, LIST_METRICS, timeRangeText } from "./agenda-view";
import { addDays, parse } from "./date";
import { isRtl } from "./dir";
import { afterPaint } from "./idle";
import { pushLayer } from "./layers";
import { place } from "./place";
import { arrowDirection, nextInDirection } from "./spatial";

export type AgendaEventName =
  | "event-click"
  | "event-change"
  | "select-slot"
  | "date-change"
  | "view-change"
  | "quick-create"
  | "calendar-toggle"
  | "time-zone-change";

export interface EventChange {
  event: CalendarEvent;
  /** Clave de la ocurrencia (`id` o `"<id>::<inicio>"`). */
  occurrence: string;
  seriesId?: string;
  start: string;
  end: string;
  kind: "move" | "resize";
  /** La hora pedida no existe (cambio de hora) y se guardó otra. */
  shifted?: { asked: string; saved: string };
}

export interface SlotSelection {
  /** Reloj de la zona de presentación, `YYYY-MM-DDTHH:mm` (o fechas con `allDay`). */
  start: string;
  end: string;
  allDay: boolean;
  timeZone: string;
}

export interface AgendaHost {
  config(): AgendaConfig;
  state(): AgendaState;
  /** Último modelo pintado (ocurrencias, días, foco). */
  model(): AgendaModel | null;
  /** Cambia el estado y vuelve a pintar; con `focus`, tras pintar lleva el foco a `state.focus`. */
  update(patch: Partial<AgendaState>, focus?: boolean): void;
  emit(name: AgendaEventName, detail: unknown): void;
}

const MOVE_THRESHOLD = 4;
const LONG_PRESS = 300;
const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? `{${k}}`));
const wallISO = (min: number) =>
  `${dateOf(min)}T${String(Math.floor(minuteOfDay(min) / 60)).padStart(2, "0")}:${String(minuteOfDay(min) % 60).padStart(2, "0")}`;

/* ---------- Región viva ---------- */

const liveTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
/** Anuncio educado con ~500 ms de retraso y vaciado previo (guía drag-and-drop): no se lo come el anuncio del foco. */
export function announce(root: HTMLElement, text: string): void {
  const live = root.querySelector<HTMLElement>(".z-agenda__live");
  if (!live) return;
  clearTimeout(liveTimers.get(live));
  live.textContent = "";
  liveTimers.set(
    live,
    setTimeout(() => {
      live.textContent = text;
    }, 500),
  );
}

/* ---------- Ayudas ---------- */

const occ = (host: AgendaHost, key: string | null | undefined): Occurrence | undefined =>
  key ? host.model()?.occurrences.find((o) => o.key === key) : undefined;

function editable(host: AgendaHost, o: Occurrence): boolean {
  const config = host.config();
  const source = config.calendars.find((c) => c.id === o.event.calendarId);
  return config.editable && o.event.editable !== false && source?.editable !== false;
}

function commit(root: HTMLElement, host: AgendaHost, o: Occurrence, span: { start: number; end: number }, kind: "move" | "resize"): void {
  const config = host.config();
  const state = host.state();
  if (span.start === o.start && span.end === o.end) return;
  const rewritten = rewriteSpan(o.event, span, state.timeZone);
  const detail: EventChange = { event: o.event, occurrence: o.key, start: rewritten.start, end: rewritten.end, kind };
  if (o.seriesId) detail.seriesId = o.seriesId;
  if (rewritten.shifted) detail.shifted = rewritten.shifted;
  host.emit("event-change", detail);
  const when = o.allDay ? dateOf(span.start) : `${dateOf(span.start)}, ${timeRangeText(span.start, span.end, config.locale)}`;
  let text = fill(kind === "move" ? config.labels.moved : config.labels.resized, { title: o.event.title, when });
  if (rewritten.shifted)
    text += `. ${fill(config.labels.shifted, { asked: rewritten.shifted.asked, saved: rewritten.shifted.saved, date: dateOf(span.start) })}`;
  announce(root, text);
}

/* ---------- Geometría ---------- */

interface Columns {
  cols: HTMLElement[];
  rects: DOMRect[];
}
const columns = (root: HTMLElement): Columns => {
  const cols = [...root.querySelectorAll<HTMLElement>(".z-timegrid__col")];
  return { cols, rects: cols.map((c) => c.getBoundingClientRect()) };
};
/** Columna bajo `x` (acotada a la primera y la última) y minuto bajo `y`, sin ajustar. */
function pointInGrid(root: HTMLElement, host: AgendaHost, x: number, y: number): { date: string; minute: number } | null {
  const { cols, rects } = columns(root);
  if (!cols.length) return null;
  let i = rects.findIndex((r) => x >= r.left && x < r.right);
  if (i < 0) {
    // Fuera por un lado: la columna más cercana (en RTL el orden visual se invierte, por eso se mide).
    let best = 0;
    let dist = Infinity;
    rects.forEach((r, j) => {
      const d = Math.min(Math.abs(x - r.left), Math.abs(x - r.right));
      if (d < dist) {
        dist = d;
        best = j;
      }
    });
    i = best;
  }
  const config = host.config();
  const rect = rects[i]!;
  const hourPx = rect.height / ((config.dayEnd - config.dayStart) / 60);
  const minute = config.dayStart + ((y - rect.top) / hourPx) * 60;
  return { date: cols[i]!.dataset.date!, minute };
}
/** Línea temporal: minuto del día bajo `x` (todas las pistas comparten la escala; en RTL, desde la derecha). */
function minuteInTrack(root: HTMLElement, host: AgendaHost, x: number): number | null {
  const track = root.querySelector<HTMLElement>(".z-timeline__track");
  if (!track) return null;
  const r = track.getBoundingClientRect();
  if (!r.width) return null;
  const config = host.config();
  const frac = isRtl(root) ? (r.right - x) / r.width : (x - r.left) / r.width;
  return config.dayStart + frac * (config.dayEnd - config.dayStart);
}
const cellAt = (root: HTMLElement, x: number, y: number) =>
  [...root.querySelectorAll<HTMLElement>(".z-monthgrid__cell")].find((c) => {
    const r = c.getBoundingClientRect();
    return x >= r.left && x < r.right && y >= r.top && y < r.bottom;
  });

/* ---------- Teclado ---------- */

function focusId(host: AgendaHost, id: string): void {
  host.update({ focus: id }, true);
}

function slotMove(host: AgendaHost, id: string, key: string): boolean {
  const config = host.config();
  const model = host.model();
  if (!model) return false;
  const [, date, minute] = id.split(":");
  let d = date!;
  let m = Number(minute);
  if (key === "ArrowUp") m -= config.slotDuration;
  else if (key === "ArrowDown") m += config.slotDuration;
  else if (key === "ArrowLeft" || key === "ArrowRight") {
    const i = model.days.indexOf(d) + (key === "ArrowRight" ? 1 : -1);
    if (i < 0 || i >= model.days.length) return false;
    d = model.days[i]!;
  } else return false;
  if (m < config.dayStart || m > config.dayEnd - config.slotDuration) return false;
  focusId(host, `s:${d}:${m}`);
  return true;
}

function grabKey(root: HTMLElement, host: AgendaHost, event: KeyboardEvent, key: string): boolean {
  const state = host.state();
  const g = state.grabbed!;
  const o = occ(host, g.key);
  const config = host.config();
  if (!o) {
    host.update({ grabbed: null });
    return false;
  }
  if (event.key === "Escape") {
    host.update({ grabbed: null }, true);
    announce(root, config.labels.cancelled);
    return true;
  }
  if (event.key === "Enter" || event.key === " ") {
    host.update({ grabbed: null }, true);
    commit(root, host, o, g, g.mode === "move" ? "move" : "resize");
    return true;
  }
  if (state.view === "timeline") {
    // Línea temporal: ←→ mueven `snapDuration` (Mayús cambia el fin); ↑↓ no hacen nada.
    const sign = key === "ArrowLeft" ? -1 : key === "ArrowRight" ? 1 : 0;
    if (!sign || o.allDay) return false;
    const next: DragPreview = event.shiftKey
      ? { ...resizeSpan(g, "end", sign * config.snapDuration, config.snapDuration), key: g.key, mode: "resize-end" }
      : { ...moveSpan(g, sign * config.snapDuration), key: g.key, mode: "move" };
    host.update({ grabbed: next }, true);
    announce(root, timeRangeText(next.start, next.end, config.locale));
    return true;
  }
  const month = state.view === "month";
  const step = o.allDay || month ? 1440 : config.snapDuration;
  let next: DragPreview | null = null;
  const vertical = key === "ArrowUp" || key === "ArrowDown";
  const sign = key === "ArrowUp" || key === "ArrowLeft" ? -1 : 1;
  if (vertical && event.shiftKey && !month && !o.allDay) {
    const edge = event.altKey ? "start" : "end";
    next = { ...resizeSpan(g, edge, sign * step, config.snapDuration), key: g.key, mode: edge === "start" ? "resize-start" : "resize-end" };
  } else if (vertical) next = { ...moveSpan(g, sign * (month ? 7 * 1440 : step)), key: g.key, mode: "move" };
  else if (key === "ArrowLeft" || key === "ArrowRight") next = { ...moveSpan(g, sign * 1440), key: g.key, mode: "move" };
  if (!next) return false;
  // Cambiar de día vuelve a montar el evento en otra columna: el foco lo sigue.
  host.update({ grabbed: next }, true);
  announce(root, timeRangeText(next.start, next.end, config.locale));
  return true;
}

function onKeyDown(root: HTMLElement, host: AgendaHost, event: KeyboardEvent): void {
  if (event.defaultPrevented) return;
  const target = event.target as HTMLElement;
  if (target.closest(".z-agenda__move, .z-agenda__side, select, input")) return;
  const state = host.state();
  const config = host.config();
  const model = host.model();
  if (!model) return;
  const rtl = isRtl(root);
  const key = rtl && event.key === "ArrowLeft" ? "ArrowRight" : rtl && event.key === "ArrowRight" ? "ArrowLeft" : event.key;

  const inPop = target.closest<HTMLElement>(".z-agenda__pop");
  const piece = target.closest<HTMLElement>("[data-focus-id]");
  if (!piece && !inPop) return;

  // RePág / AvPág: periodo anterior o siguiente.
  if ((event.key === "PageUp" || event.key === "PageDown") && !inPop) {
    event.preventDefault();
    const date = shiftDate(state.view, state.date, event.key === "PageUp" ? -1 : 1, config.listDays);
    changeDate(host, date, true);
    return;
  }

  const id = piece?.dataset.focusId ?? "";
  const eventKey = piece?.dataset.key;
  const o = eventKey ? occ(host, eventKey) : undefined;

  if (state.grabbed && eventKey === state.grabbed.key) {
    if (grabKey(root, host, event, key)) event.preventDefault();
    return;
  }

  // Menú contextual o Mayús+F10: «Mover a…».
  if (o && (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey))) {
    if (editable(host, o) && !o.allDay) {
      event.preventDefault();
      host.update({ moving: o.key, detail: null, more: null });
    }
    return;
  }

  if (o && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    if (state.selected === o.key && editable(host, o) && !inPop) {
      host.update({ grabbed: { key: o.key, mode: "move", start: o.start, end: o.end }, detail: null });
      announce(root, fill(config.labels.grabbed, { title: o.event.title }));
    } else selectEvent(host, o, piece!);
    return;
  }

  if (event.key === "Escape" && state.view === "month" && o && !inPop) {
    event.preventDefault();
    focusId(host, `d:${dateOf(o.start)}`);
    return;
  }

  // Mes: celdas de día.
  if (id.startsWith("d:")) {
    const date = id.slice(2);
    let next: string | null = null;
    if (key === "ArrowRight") next = addDays(date, 1);
    else if (key === "ArrowLeft") next = addDays(date, -1);
    else if (key === "ArrowDown") next = addDays(date, 7);
    else if (key === "ArrowUp") next = addDays(date, -7);
    else if (key === "Home") next = addDays(date, -((parse(date).getUTCDay() - config.weekStart + 7) % 7));
    else if (key === "End") next = addDays(date, 6 - ((parse(date).getUTCDay() - config.weekStart + 7) % 7));
    else if ((event.key === "Enter" || event.key === " ") && state.view === "year") {
      event.preventDefault();
      openDay(host, date);
      return;
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const first = piece!.querySelector<HTMLElement>(".z-event");
      if (first?.dataset.focusId) focusId(host, first.dataset.focusId);
      else if (piece!.querySelector(".z-agenda__more")) host.update({ more: date, date });
      else host.update({ date });
      return;
    }
    if (!next) return;
    event.preventDefault();
    if (!model.days.includes(next)) host.update({ date: next, focus: `d:${next}` }, true);
    else host.update({ focus: `d:${next}`, date: next }, true);
    if (next.slice(0, 7) !== state.date.slice(0, 7)) host.emit("date-change", { date: next });
    return;
  }

  // Cursor de franja libre.
  if (id.startsWith("s:")) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const [, date, minute] = id.split(":");
      const start = dayStart(date!) + Number(minute);
      if (config.selectable)
        host.emit("select-slot", {
          start: wallISO(start),
          end: wallISO(start + config.slotDuration),
          allDay: false,
          timeZone: state.timeZone,
        } satisfies SlotSelection);
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      const [, date] = id.split(":");
      const list = [...root.querySelectorAll<HTMLElement>(`.z-timegrid__col[data-date="${date}"] .z-event`)];
      const pick = event.key === "Home" ? list[0] : list[list.length - 1];
      if (pick?.dataset.focusId) {
        event.preventDefault();
        focusId(host, pick.dataset.focusId);
      }
      return;
    }
    if (slotMove(host, id, key)) event.preventDefault();
    return;
  }

  // Eventos (y los «+N» de la rejilla de horas): navegación espacial (y la lista, de arriba abajo).
  const chip = piece?.matches(".z-timegrid__overflow") ? piece : null;
  if (o || chip) {
    if (event.key === "Home" || event.key === "End") {
      // La lista puede pintar solo una ventana: primero y último salen del modelo, no del documento.
      if (state.view === "agenda" && !inPop) {
        const list = model.occurrences;
        const pick = event.key === "Home" ? list[0] : list[list.length - 1];
        if (pick && pick.key !== eventKey) {
          event.preventDefault();
          focusId(host, `e:${pick.key}`);
        }
        return;
      }
      const scope = piece!.closest(".z-timegrid__col, .z-monthgrid__cell, .z-agenda__pop") ?? root;
      const list = [...scope.querySelectorAll<HTMLElement>(".z-event[data-focus-id]")];
      const pick = event.key === "Home" ? list[0] : list[list.length - 1];
      if (pick && pick !== piece) {
        event.preventDefault();
        if (inPop) pick.focus();
        else focusId(host, pick.dataset.focusId!);
      }
      return;
    }
    const dir = arrowDirection(event.key);
    if (!dir || event.altKey || event.ctrlKey || event.metaKey) return;
    const scope = inPop ?? (state.view === "month" ? piece!.closest(".z-monthgrid__cell") : root.querySelector(".z-agenda__view"));
    // Todas las lecturas de geometría juntas (sin escribir entre medias): una sola maquetación.
    const pieces = [...(scope ?? root).querySelectorAll<HTMLElement>(".z-event, .z-timegrid__overflow")].filter(
      (el) => el.checkVisibility?.() ?? true,
    );
    const rects = pieces.map((el) => el.getBoundingClientRect());
    const current = piece!.getBoundingClientRect();
    const i = nextInDirection(current, rects, dir);
    if (i >= 0 && pieces[i] !== piece) {
      event.preventDefault();
      if (inPop) pieces[i]!.focus();
      else focusId(host, pieces[i]!.dataset.focusId!);
      pieces[i]!.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      return;
    }
    // Sin evento en esa dirección en la rejilla de horas: el cursor de franja junto al evento.
    if (o && !inPop && piece!.closest(".z-timegrid__col") && (dir === "up" || dir === "down") && !o.allDay) {
      const step = config.slotDuration;
      const m = dir === "up" ? snap(minuteOfDay(o.start), step) - step : Math.ceil(minuteOfDay(o.end) / step) * step;
      if (m >= config.dayStart && m <= config.dayEnd - step) {
        event.preventDefault();
        focusId(host, `s:${dateOf(o.start)}:${m}`);
      }
    }
  }
}

/* ---------- Acciones ---------- */

function setView(host: AgendaHost, view: AgendaView): void {
  if (host.state().view === view) return;
  host.update({ view, focus: null, more: null, detail: null, grabbed: null, listScroll: null });
  host.emit("view-change", { view });
}

/** Año: un día abre la vista de día (si está entre las vistas) en esa fecha. */
function openDay(host: AgendaHost, date: string, view: AgendaView = "day"): void {
  const views = host.config().views;
  const target = views.includes(view) ? view : views.includes("week") ? "week" : null;
  if (!target) {
    host.update({ date, focus: `d:${date}` }, true);
    host.emit("date-change", { date });
    return;
  }
  host.update({ view: target, date, focus: null, more: null, detail: null, grabbed: null, listScroll: null }, true);
  host.emit("view-change", { view: target });
  host.emit("date-change", { date });
}

function changeDate(host: AgendaHost, date: string, focus = false): void {
  host.update({ date, focus: null, more: null, detail: null, grabbed: null, listScroll: null }, focus);
  host.emit("date-change", { date });
}

function selectEvent(host: AgendaHost, o: Occurrence, el: HTMLElement): void {
  host.update({ selected: o.key, detail: o.key, focus: el.closest(".z-agenda__pop") ? host.state().focus : `e:${o.key}` });
  host.emit("event-click", { event: o.event, occurrence: o.key, seriesId: o.seriesId });
}

function onClick(_root: HTMLElement, host: AgendaHost, event: MouseEvent, drag: DragState): void {
  const target = event.target as HTMLElement;
  if (drag.suppressClick) {
    drag.suppressClick = false;
    event.preventDefault();
    return;
  }
  const state = host.state();
  const config = host.config();
  const nav = target.closest<HTMLElement>("[data-nav]");
  if (nav) {
    changeDate(host, shiftDate(state.view, state.date, nav.dataset.nav === "previous" ? -1 : 1, config.listDays));
    return;
  }
  if (target.closest(".z-agenda__today")) {
    const today = host.model()?.today;
    if (today) changeDate(host, today);
    return;
  }
  const view = target.closest<HTMLElement>(".z-agenda__views [data-view]");
  if (view) {
    setView(host, view.dataset.view as AgendaView);
    return;
  }
  if (target.closest(".z-agenda__create")) {
    host.emit("quick-create", { date: state.date });
    return;
  }
  const more = target.closest<HTMLElement>(".z-agenda__more");
  if (more?.dataset.more) {
    host.update({ more: state.more === more.dataset.more ? null : more.dataset.more, detail: null });
    return;
  }
  if (target.closest(".z-agenda__pop-close")) {
    host.update({ more: null, detail: null }, true);
    return;
  }
  const open = target.closest<HTMLElement>(".z-agenda__move-open");
  if (open?.dataset.key) {
    host.update({ moving: open.dataset.key, detail: null, more: null });
    return;
  }
  if (target.closest(".z-agenda__move-cancel")) {
    target.closest("dialog")?.close();
    return;
  }
  const ev = target.closest<HTMLElement>(".z-event");
  if (ev?.dataset.key) {
    const o = occ(host, ev.dataset.key);
    if (o) selectEvent(host, o, ev);
    return;
  }
  const yearDay = target.closest<HTMLElement>(".z-yeargrid__day");
  if (yearDay?.dataset.date) {
    openDay(host, yearDay.dataset.date);
    return;
  }
  const yearMonth = target.closest<HTMLElement>(".z-yeargrid__month-btn");
  if (yearMonth?.dataset.month) {
    openDay(host, `${yearMonth.dataset.month}-01`, "month");
    return;
  }
  const cell = target.closest<HTMLElement>(".z-monthgrid__cell");
  if (cell?.dataset.date) {
    host.update({ date: cell.dataset.date, focus: `d:${cell.dataset.date}` }, true);
    return;
  }
  const slot = target.closest<HTMLElement>(".z-timegrid__slot");
  if (slot && config.selectable) {
    const start = dayStart(slot.dataset.date!) + Number(slot.dataset.minute);
    host.emit("select-slot", {
      start: wallISO(start),
      end: wallISO(start + config.slotDuration),
      allDay: false,
      timeZone: state.timeZone,
    } satisfies SlotSelection);
  }
}

function onChange(host: AgendaHost, event: Event): void {
  const target = event.target as HTMLElement;
  if (target instanceof HTMLInputElement && target.matches(".z-agenda__check")) {
    const id = target.dataset.calendar!;
    const hidden = new Set(host.state().hidden);
    if (target.checked) hidden.delete(id);
    else hidden.add(id);
    host.update({ hidden: [...hidden], selected: null, detail: null });
    host.emit("calendar-toggle", { calendarId: id, visible: target.checked });
  } else if (target instanceof HTMLInputElement && target.matches(".z-perpetual__input")) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(target.value) && target.value !== host.state().date) {
      host.update({ date: target.value });
      host.emit("date-change", { date: target.value });
    }
  } else if (target instanceof HTMLSelectElement && target.matches(".z-agenda__view-select")) {
    setView(host, target.value as AgendaView);
  } else if (target instanceof HTMLSelectElement && target.matches(".z-agenda__zone-select")) {
    host.update({ timeZone: target.value });
    host.emit("time-zone-change", { timeZone: target.value });
  }
}

function onSubmit(root: HTMLElement, host: AgendaHost, event: SubmitEvent): void {
  const form = event.target as HTMLFormElement;
  if (!form.matches(".z-agenda__move-form")) return;
  event.preventDefault();
  const dialog = form.closest("dialog");
  const o = occ(host, dialog?.dataset.for);
  const data = new FormData(form);
  const date = String(data.get("date") ?? "");
  const start = String(data.get("start") ?? "");
  const end = String(data.get("end") ?? "");
  dialog?.close();
  if (!o || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  const toMin = (t: string) => {
    const m = /^(\d{2}):(\d{2})/.exec(t);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const a = toMin(start);
  const b = toMin(end);
  if (a === null || b === null) return;
  const s = dayStart(date) + a;
  let e = dayStart(date) + b;
  if (e <= s) e += 1440; // fin antes del inicio: al día siguiente
  commit(root, host, o, { start: s, end: e }, o.end - o.start === e - s ? "move" : "resize");
}

/* ---------- Puntero ---------- */

interface DragState {
  pointerId: number | null;
  key: string | null;
  mode: DragPreview["mode"] | "create";
  x: number;
  y: number;
  started: boolean;
  /** Minutos entre el punto agarrado y el inicio del evento (mover). */
  offset: number;
  origin: { start: number; end: number; date: string };
  timer?: ReturnType<typeof setTimeout>;
  armed: boolean;
  suppressClick: boolean;
  frame: number;
  lastX: number;
  lastY: number;
}

function pointerStart(root: HTMLElement, host: AgendaHost, event: PointerEvent, drag: DragState): void {
  if (event.button !== 0 || drag.pointerId !== null) return;
  const target = event.target as HTMLElement;
  const config = host.config();
  const state = host.state();
  const ev = target.closest<HTMLElement>(".z-event");
  if (target.closest(".z-agenda__pop, .z-agenda__move")) return;
  const grid = target.closest(".z-timegrid__col, .z-monthgrid__cell, .z-timeline__track");
  if (!grid) return;
  const lanes = state.view === "timeline";
  let mode: DragState["mode"];
  let o: Occurrence | undefined;
  if (ev?.dataset.key) {
    o = occ(host, ev.dataset.key);
    if (!o || !editable(host, o) || (o.allDay && state.view !== "month")) return;
    mode = target.closest(".z-event__resize") ? "resize-end" : "move";
  } else if (config.selectable && target.closest(".z-timegrid__col") && !target.closest(".z-timegrid__slot")) mode = "create";
  else return;
  // Línea temporal: el minuto bajo el puntero en la pista (horizontal), en el día de la vista.
  const laneMinute = lanes ? minuteInTrack(root, host, event.clientX) : null;
  const at =
    state.view === "month"
      ? null
      : lanes
        ? laneMinute === null
          ? null
          : { date: state.date, minute: laneMinute }
        : pointInGrid(root, host, event.clientX, event.clientY);
  Object.assign(drag, {
    pointerId: event.pointerId,
    key: o?.key ?? null,
    mode,
    x: event.clientX,
    y: event.clientY,
    lastX: event.clientX,
    lastY: event.clientY,
    started: false,
    armed: event.pointerType !== "touch",
    offset: 0,
    origin: o ? { start: o.start, end: o.end, date: dateOf(o.start) } : { start: 0, end: 0, date: at?.date ?? "" },
  });
  if (o && at) drag.offset = dayStart(at.date) + at.minute - o.start;
  // Táctil: el arrastre empieza con una pulsación larga para no robar el desplazamiento.
  if (!drag.armed)
    drag.timer = setTimeout(() => {
      drag.armed = true;
    }, LONG_PRESS);
  (ev ?? (grid as HTMLElement)).setPointerCapture?.(event.pointerId);
}

function pointerMove(root: HTMLElement, host: AgendaHost, event: PointerEvent, drag: DragState): void {
  if (event.pointerId !== drag.pointerId) return;
  drag.lastX = event.clientX;
  drag.lastY = event.clientY;
  if (!drag.started) {
    const far = Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > MOVE_THRESHOLD;
    if (!far) return;
    if (!drag.armed) {
      // Táctil que se mueve antes de la pulsación larga: es desplazamiento.
      reset(drag);
      return;
    }
    drag.started = true;
    root.dataset.dragging = "";
    autoScroll(root, host, drag);
  }
  event.preventDefault();
  track(root, host, drag);
}

/** Recalcula el destino con la última posición del puntero (también tras un desplazamiento automático). */
function track(root: HTMLElement, host: AgendaHost, drag: DragState): void {
  const config = host.config();
  const state = host.state();
  if (state.view === "month") {
    const cell = cellAt(root, drag.lastX, drag.lastY);
    if (!cell?.dataset.date || !drag.key) return;
    const delta = (dayStart(cell.dataset.date) - dayStart(drag.origin.date)) | 0;
    const next = moveSpan(drag.origin, delta);
    const cur = state.drag;
    if (!cur || cur.start !== next.start) host.update({ drag: { key: drag.key, mode: "move", ...next } });
    return;
  }
  if (state.view === "timeline") {
    // Línea temporal: mover o alargar en el tiempo, dentro de la fila (la fila no cambia: el recurso es de la app).
    const minute = minuteInTrack(root, host, drag.lastX);
    if (minute === null || !drag.key) return;
    const base = dayStart(state.date);
    const step = config.snapDuration;
    const next =
      drag.mode === "move"
        ? // `offset`: minutos entre el punto agarrado y el inicio; el inicio nuevo se ajusta a `snapDuration`.
          moveSpan(drag.origin, base + snap(minute - drag.offset, step) - drag.origin.start)
        : resizeSpan(drag.origin, "end", base + snap(minute, step) - drag.origin.end, step);
    const cur = state.drag;
    if (!cur || cur.start !== next.start || cur.end !== next.end)
      host.update({ drag: { key: drag.key, mode: drag.mode === "move" ? "move" : "resize-end", ...next } });
    return;
  }
  const at = pointInGrid(root, host, drag.lastX, drag.lastY);
  if (!at) return;
  const absolute = dayStart(at.date) + at.minute;
  const step = config.snapDuration;
  if (drag.mode === "create") {
    const startPoint = pointInGrid(root, host, drag.x, drag.y);
    if (!startPoint) return;
    const s0 = Math.floor(startPoint.minute / step) * step;
    const s1 = Math.ceil(at.minute / step) * step;
    const [lo, hi] = s1 >= s0 ? [s0, Math.max(s1, s0 + step)] : [Math.floor(at.minute / step) * step, s0 + step];
    const creating = { date: startPoint.date, start: Math.max(config.dayStart, lo), end: Math.min(config.dayEnd, hi) };
    const cur = state.creating;
    if (!cur || cur.start !== creating.start || cur.end !== creating.end) host.update({ creating });
    return;
  }
  if (!drag.key) return;
  let next: { start: number; end: number };
  if (drag.mode === "move") {
    const start = dayStart(at.date) + snap(minuteOfDay(absolute - drag.offset), step);
    next = moveSpan(drag.origin, start - drag.origin.start);
  } else {
    const end = dayStart(drag.origin.date) + snap(at.minute, step);
    next = resizeSpan(drag.origin, "end", end - drag.origin.end, step);
  }
  const cur = state.drag;
  if (!cur || cur.start !== next.start || cur.end !== next.end)
    host.update({ drag: { key: drag.key, mode: drag.mode === "move" ? "move" : "resize-end", ...next } });
}

/** Desplazamiento automático cerca de los bordes del contenedor, con un bucle de requestAnimationFrame. */
function autoScroll(root: HTMLElement, host: AgendaHost, drag: DragState): void {
  // Rejilla de horas: en vertical; línea temporal: en horizontal (las horas van a lo ancho).
  const lanes = root.querySelector<HTMLElement>(".z-agenda__view .z-timeline__scroll");
  const scroller = lanes ?? root.querySelector<HTMLElement>(".z-timegrid__scroll");
  if (!scroller) return;
  let last = performance.now();
  const tick = (now: number) => {
    if (!drag.started) return;
    const r = scroller.getBoundingClientRect();
    const dt = Math.min(64, now - last);
    last = now;
    let speed = 0;
    const [lo, hi, at] = lanes ? [r.left, r.right, drag.lastX] : [r.top, r.bottom, drag.lastY];
    const zone = Math.min(56, (hi - lo) / 3);
    if (at < lo + zone) speed = -Math.min(1.5, (lo + zone - at) / zone);
    else if (at > hi - zone) speed = Math.min(1.5, (at - (hi - zone)) / zone);
    if (speed) {
      if (lanes) {
        const before = scroller.scrollLeft;
        // Cerca del borde físico izquierdo, hacia la izquierda (en RTL, scrollLeft negativo hace lo mismo).
        scroller.scrollLeft += speed * dt * 0.6;
        if (scroller.scrollLeft !== before) track(root, host, drag);
      } else {
        const before = scroller.scrollTop;
        scroller.scrollTop += speed * dt * 0.6;
        if (scroller.scrollTop !== before) track(root, host, drag);
      }
    }
    drag.frame = requestAnimationFrame(tick);
  };
  drag.frame = requestAnimationFrame(tick);
}

function reset(drag: DragState): void {
  clearTimeout(drag.timer);
  cancelAnimationFrame(drag.frame);
  drag.pointerId = null;
  drag.key = null;
  drag.started = false;
}

function pointerEnd(root: HTMLElement, host: AgendaHost, event: PointerEvent, drag: DragState, cancel = false): void {
  if (event.pointerId !== drag.pointerId) return;
  const started = drag.started;
  const state = host.state();
  const config = host.config();
  delete root.dataset.dragging;
  if (started) drag.suppressClick = true;
  if (started && drag.mode === "create" && state.creating) {
    const c = state.creating;
    host.update({ creating: null });
    if (!cancel)
      host.emit("select-slot", {
        start: wallISO(dayStart(c.date) + c.start),
        end: wallISO(dayStart(c.date) + c.end),
        allDay: false,
        timeZone: state.timeZone,
      } satisfies SlotSelection);
  } else if (started && drag.key) {
    const preview = state.drag;
    const o = occ(host, drag.key);
    host.update({ drag: null, selected: drag.key, focus: `e:${drag.key}` }, true);
    if (cancel) announce(root, config.labels.cancelled);
    else if (o && preview) commit(root, host, o, preview, preview.mode === "move" ? "move" : "resize");
  } else if (!started && drag.mode === "create" && !cancel) {
    // Pulsación sin arrastre en una franja vacía: el cursor de franja va ahí.
    const at = pointInGrid(root, host, drag.x, drag.y);
    if (at) focusId(host, `s:${at.date}:${Math.max(config.dayStart, Math.floor(at.minute / config.slotDuration) * config.slotDuration)}`);
  }
  reset(drag);
}

/* ---------- Conexión ---------- */

/** Conecta la interacción al elemento raíz `.z-agenda`. Devuelve la función que la desconecta. */
export function attachAgenda(root: HTMLElement, host: AgendaHost): () => void {
  const abort = new AbortController();
  const signal = abort.signal;
  const drag: DragState = {
    pointerId: null,
    key: null,
    mode: "move",
    x: 0,
    y: 0,
    started: false,
    offset: 0,
    origin: { start: 0, end: 0, date: "" },
    armed: false,
    suppressClick: false,
    frame: 0,
    lastX: 0,
    lastY: 0,
  };
  root.addEventListener("click", (e) => onClick(root, host, e, drag), { signal });
  root.addEventListener("change", (e) => onChange(host, e), { signal });
  root.addEventListener("submit", (e) => onSubmit(root, host, e as SubmitEvent), { signal });
  root.addEventListener("keydown", (e) => onKeyDown(root, host, e), { signal });
  root.addEventListener("pointerdown", (e) => pointerStart(root, host, e, drag), { signal });
  // En el documento: un evento que cambia de columna se vuelve a montar y pierde la captura; los movimientos
  // capturados siguen llegando al documento.
  const doc = root.ownerDocument;
  doc.addEventListener("pointermove", (e) => pointerMove(root, host, e, drag), { signal, passive: false });
  doc.addEventListener("pointerup", (e) => pointerEnd(root, host, e, drag), { signal });
  doc.addEventListener("pointercancel", (e) => pointerEnd(root, host, e, drag, true), { signal });
  doc.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape" && drag.started) {
        e.preventDefault();
        e.stopPropagation();
        const state = host.state();
        drag.suppressClick = true;
        delete root.dataset.dragging;
        host.update({ drag: null, creating: null }, Boolean(state.drag));
        announce(root, host.config().labels.cancelled);
        reset(drag);
      }
    },
    { signal, capture: true },
  );
  // Lista larga: al desplazar, la ventana se recalcula en el siguiente fotograma y solo si cambia de bloque (las
  // lecturas de scrollTop y clientHeight van juntas, sin escrituras entre medias).
  let frame = 0;
  root.addEventListener(
    "scroll",
    (event) => {
      const list = event.target as HTMLElement;
      if (!list.matches?.(".z-agendalist[data-virtual]")) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const state = host.state();
        const row = (state.listMetrics ?? LIST_METRICS).row;
        const block = row * LIST_BLOCK;
        const top = Math.floor(list.scrollTop / block) * block;
        const height = list.clientHeight;
        const cur = state.listScroll;
        if (!cur || cur.top !== top || Math.abs(cur.height - height) > row) host.update({ listScroll: { top, height } });
      });
    },
    { signal, capture: true },
  );
  root.addEventListener(
    "focusin",
    (e) => {
      const piece = (e.target as HTMLElement).closest<HTMLElement>("[data-focus-id]");
      if (!piece || piece.closest(".z-agenda__pop")) return;
      const id = piece.dataset.focusId!;
      if (host.state().focus !== id && !moving.has(root)) host.update({ focus: id });
    },
    { signal },
  );
  // Agarrado: soltar si el foco sale del evento (salvo el desenfoque que provoca el propio movimiento).
  root.addEventListener(
    "focusout",
    (e) => {
      const state = host.state();
      if (!state.grabbed || moving.has(root)) return;
      const left = (e.target as HTMLElement).closest<HTMLElement>("[data-key]")?.dataset.key;
      const to = (e.relatedTarget as HTMLElement | null)?.closest<HTMLElement>("[data-key]")?.dataset.key;
      if (left !== state.grabbed.key || to === state.grabbed.key || !e.relatedTarget) return;
      const o = occ(host, state.grabbed.key);
      const g = state.grabbed;
      host.update({ grabbed: null });
      if (o) commit(root, host, o, g, g.mode === "move" ? "move" : "resize");
    },
    { signal },
  );
  return () => {
    abort.abort();
    cancelAnimationFrame(frame);
    reset(drag);
    for (const release of layers.get(root)?.values() ?? []) release();
    layers.delete(root);
  };
}

/* ---------- Tras pintar ---------- */

const layers = new WeakMap<HTMLElement, Map<Element, () => void>>();
const scrolled = new WeakMap<HTMLElement, string>();
/** Raíces que están moviendo el foco tras un cambio (sus desenfoques no sueltan lo agarrado). */
const moving = new WeakSet<HTMLElement>();
/** Raíces con una medida de la lista pendiente. */
const measuring = new WeakSet<HTMLElement>();

/** Marca que el próximo pintado mueve el foco (lo usan React y el modo DOM antes de pintar). */
export function beginFocusMove(root: HTMLElement): void {
  moving.add(root);
}

/**
 * Efectos tras pintar: abre y coloca los popovers y el diálogo, lleva el foco a `state.focus` si se pidió,
 * desplaza la rejilla a `scrollTime` al cambiar de vista o de fecha.
 */
/** Aire sobre la primera hora visible al desplazar la rejilla: el rótulo se centra en su línea (≈7 px por encima). */
const LABEL_ROOM = 12;

export function syncAgenda(root: HTMLElement, host: AgendaHost, moveFocus: boolean, scrollMinute = 8 * 60): void {
  const state = host.state();
  const model = host.model();
  const config = host.config();
  // Rejilla de horas: la primera vez para esta vista y fecha, a la hora de inicio.
  const scroller = root.querySelector<HTMLElement>(".z-timegrid__scroll");
  const stamp = `${state.view}|${state.date}`;
  if (scroller && scrolled.get(root) !== stamp) {
    scrolled.set(root, stamp);
    const body = root.querySelector<HTMLElement>(".z-timegrid__col");
    const head = root.querySelector<HTMLElement>(".z-timegrid__head");
    if (body) {
      const box = body.getBoundingClientRect();
      const hourPx = box.height / ((config.dayEnd - config.dayStart) / 60);
      // Posición de la columna dentro del contenido desplazable, menos la cabecera pegajosa que la tapa y menos el
      // medio rótulo que la hora pinta por encima de su línea: así la primera hora visible se lee entera.
      const origin = scroller.getBoundingClientRect().top - scroller.scrollTop;
      const headPx = head?.offsetHeight ?? 0;
      let target = box.top - origin + ((scrollMinute - config.dayStart) / 60) * hourPx - headPx - LABEL_ROOM;
      // El rótulo de «ahora» justo antes de esa hora quedaría a medias bajo la cabecera: se sube lo justo para verlo.
      const now = root.querySelector<HTMLElement>(".z-timegrid__gutter > .z-timegrid__now-label");
      if (now) {
        const at = now.getBoundingClientRect().top - origin;
        if (at < target + headPx && at > target + headPx - hourPx) target = at - headPx - LABEL_ROOM / 2;
      }
      scroller.scrollTop = Math.max(0, target);
    }
  }
  // Lista: al cambiar de vista o de periodo, desde el principio; con ventana virtual, la medida de una fila (una
  // sola vez: una lectura tras pintar, nunca una por fila).
  const list = root.querySelector<HTMLElement>(".z-agendalist");
  if (list && !scroller && scrolled.get(root) !== stamp) {
    scrolled.set(root, stamp);
    list.scrollTop = 0;
  }
  if (list?.hasAttribute("data-virtual") && !state.listMetrics && !measuring.has(root)) {
    // Tras pintar: la maquetación ya está hecha y la lectura no fuerza otra dentro de la interacción.
    measuring.add(root);
    afterPaint(() => {
      measuring.delete(root);
      const now = root.querySelector<HTMLElement>(".z-agendalist[data-virtual]");
      const metrics = now && !host.state().listMetrics ? measureList(now) : null;
      if (metrics) host.update({ listMetrics: metrics });
    });
  }
  // Popovers: abiertos, colocados y en la pila de capas.
  const open = layers.get(root) ?? new Map<Element, () => void>();
  layers.set(root, open);
  for (const [el, release] of [...open]) {
    if (!el.isConnected || !root.contains(el)) {
      release();
      open.delete(el);
    }
  }
  for (const pop of root.querySelectorAll<HTMLElement>(".z-agenda__pop[popover]")) {
    const anchor =
      pop.dataset.pop === "more"
        ? root.querySelector<HTMLElement>(`.z-agenda__more[data-more="${pop.dataset.for}"]`)
        : root.querySelector<HTMLElement>(`.z-agenda__view .z-event[data-key="${CSS.escape(pop.dataset.for ?? "")}"]`);
    const fresh = !open.has(pop);
    if (fresh) {
      try {
        pop.showPopover();
      } catch {
        // Sin Popover API: se queda en el flujo, visible.
      }
      open.set(
        pop,
        pushLayer({
          contains: (t) => pop.contains(t) || Boolean(anchor?.contains(t)),
          onEscape: () => host.update({ more: null, detail: null }, true),
          onPointerOutside: () => host.update({ more: null, detail: null }),
        }),
      );
    }
    if (anchor) place(pop, anchor.getBoundingClientRect(), pop.dataset.pop === "more" ? "bottom-start" : "right-start", 6);
    if (fresh) pop.querySelector<HTMLElement>(".z-event, .z-agenda__move-open, .z-agenda__pop-close")?.focus({ preventScroll: true });
  }
  // Diálogo «Mover a…».
  const dialog = root.querySelector<HTMLDialogElement>("dialog.z-agenda__move");
  if (dialog && !dialog.open) {
    dialog.addEventListener("close", () => host.update({ moving: null }, true), { once: true });
    try {
      dialog.showModal();
    } catch {
      dialog.setAttribute("open", "");
    }
  }
  if (moveFocus && model) {
    const target = root.querySelector<HTMLElement>(`[data-focus-id="${CSS.escape(model.focusId)}"]:not(.z-agenda__pop *)`);
    if (target && target !== root.ownerDocument.activeElement) {
      target.focus({ preventScroll: true });
      target.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    }
  }
  moving.delete(root);
}

/** Alto de una fila, de la cabecera de un día y del relleno de un grupo de la lista (lecturas juntas). */
function measureList(list: HTMLElement): ListMetrics | null {
  for (const day of list.querySelectorAll<HTMLElement>(".z-agendalist__day")) {
    const items = day.querySelectorAll<HTMLElement>(".z-agendalist__item");
    const ul = day.querySelector<HTMLElement>(".z-agendalist__items");
    const head = day.querySelector<HTMLElement>(".z-agendalist__date");
    if (items.length < 2 || !ul || !head) continue;
    const a = items[0]!.getBoundingClientRect();
    const b = items[1]!.getBoundingClientRect();
    const box = ul.getBoundingClientRect();
    const first = ul.firstElementChild!.getBoundingClientRect();
    const last = ul.lastElementChild!.getBoundingClientRect();
    const row = b.top - a.top;
    if (!(row > 0)) return null;
    // Relleno del grupo: el de la lista de filas más el borde del día.
    const pad = box.height - (last.bottom - first.top) + (day.offsetHeight - day.clientHeight);
    return { row, head: head.offsetHeight, pad: Math.max(0, pad) };
  }
  return null;
}

/** Llama a `tick` al empezar cada minuto, en pausa con la pestaña oculta. Devuelve la función que lo para. */
export function everyMinute(tick: () => void, doc: Document = document): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const arm = () => {
    clearTimeout(timer);
    if (doc.visibilityState === "hidden") return;
    timer = setTimeout(
      () => {
        tick();
        arm();
      },
      60_000 - (Date.now() % 60_000) + 50,
    );
  };
  const onVisibility = () => {
    if (doc.visibilityState === "visible") tick();
    arm();
  };
  doc.addEventListener("visibilitychange", onVisibility);
  arm();
  return () => {
    clearTimeout(timer);
    doc.removeEventListener("visibilitychange", onVisibility);
  };
}
