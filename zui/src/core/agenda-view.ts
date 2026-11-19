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
  type CalendarColor,
  type CalendarEvent,
  type CalendarSource,
  type Occurrence,
} from "./agenda";
import { fromWall, toWall, zoneCity, zoneLabel } from "./zone";

/* ---------- Árbol ---------- */

export type VAttr = string | number | boolean | null | undefined;
export interface VEl {
  t: string;
  a?: Record<string, VAttr>;
  /** Variables locales de estilo (`--z-…`): solo maquetación calculada. */
  s?: Record<string, string | number>;
  c?: VNode[];
  k?: string;
}
/** Hueco que pinta cada vía a su manera: un icono, o el minicalendario (Calendar). */
export interface VSlot {
  slot: "icon" | "minical";
  p: Record<string, unknown>;
  k?: string;
}
export type VNode = VEl | VSlot | string | null | undefined | false;

type HAttrs = Record<string, VAttr | Record<string, string | number>>;
const h = (t: string, a?: HAttrs | null, ...c: VNode[]): VEl => {
  const el: VEl = { t };
  if (a) {
    const { key, s: style, ...rest } = a;
    if (key !== undefined && key !== null) el.k = String(key);
    if (style && typeof style === "object") el.s = style;
    el.a = rest as Record<string, VAttr>;
  }
  const kids = c.filter((x) => x !== null && x !== undefined && x !== false);
  if (kids.length) el.c = kids;
  return el;
};
const icon = (name: string, size = 16): VSlot => ({ slot: "icon", p: { name, size } });
const on = (v: boolean | undefined) => (v ? "" : undefined);

/** HTML del árbol (para el contrato HTML y las pruebas). Escapa texto y atributos. */
export function toHTML(
  node: VNode,
  iconHTML: (name: string, size: number) => string = (n, s) => `<z-icon name="${n}" size="${s}"></z-icon>`,
): string {
  if (node === null || node === undefined || node === false) return "";
  if (typeof node === "string") return escapeText(node);
  if ("slot" in node) {
    if (node.slot === "icon") return iconHTML(String(node.p.name), Number(node.p.size));
    return `<div class="z-calendar z-agenda__minical"${Object.entries((node.p.attrs ?? {}) as Record<string, VAttr>)
      .map(([k, v]) => attrHTML(k, v))
      .join("")}></div>`;
  }
  const attrs = Object.entries(node.a ?? {})
    .map(([k, v]) => attrHTML(k, v))
    .join("");
  const style = node.s
    ? ` style="${escapeAttr(
        Object.entries(node.s)
          .map(([k, v]) => `${k}: ${v}`)
          .join("; "),
      )}"`
    : "";
  const inner = (node.c ?? []).map((c) => toHTML(c, iconHTML)).join("");
  return VOID.has(node.t) ? `<${node.t}${attrs}${style}>` : `<${node.t}${attrs}${style}>${inner}</${node.t}>`;
}
const VOID = new Set(["input", "br", "hr", "img"]);
const escapeText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (s: string) => escapeText(s).replace(/"/g, "&quot;");
function attrHTML(k: string, v: VAttr): string {
  if (v === null || v === undefined || v === false) return "";
  if (v === true || v === "") return ` ${k}`;
  return ` ${k}="${escapeAttr(String(v))}"`;
}

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
}

export const DEFAULT_LABELS: AgendaLabels = {
  calendar: "Calendar",
  today: "Today",
  previous: "Previous",
  next: "Next",
  views: { day: "Day", week: "Week", workweek: "Work week", month: "Month", agenda: "Agenda" },
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
};

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
}

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
  };
}

/* ---------- Formatos ---------- */

const formats = new Map<string, Intl.DateTimeFormat>();
function fmt(locale: string | undefined, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
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

export function timeText(min: number, locale?: string): string {
  return fmt(locale, TIME).format(ms(min));
}
/** Intervalo de horas con `formatRange` (marcas bidi del locale incluidas). */
export function timeRangeText(start: number, end: number, locale?: string): string {
  const f = fmt(locale, TIME);
  try {
    return f.formatRange(ms(start), ms(Math.max(end, start)));
  } catch {
    return `${f.format(ms(start))} – ${f.format(ms(end))}`;
  }
}
const dayLong = (date: string, locale?: string) => fmt(locale, { weekday: "long", day: "numeric", month: "long" }).format(parse(date));
const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? `{${k}}`));

/** Título de la barra: «November 16 – 22, 2026», «Thursday, 19 November 2026», «November 2026». */
export function periodTitle(view: AgendaView, days: string[], date: string, locale?: string): string {
  if (view === "day") return fmt(locale, { dateStyle: "full" }).format(parse(date));
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
  const sources = new Map(config.calendars.map((c) => [c.id, c]));
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
function fallbackFocus(state: AgendaState, model: AgendaModel, config: AgendaConfig): string {
  const inView = (d: string) => model.days.includes(d);
  const anchor = inView(model.today) ? model.today : inView(state.date) ? state.date : model.days[0]!;
  if (state.view === "month") return `d:${anchor}`;
  if (state.view === "agenda") {
    const first = model.occurrences.find((o) => o.end > model.now) ?? model.occurrences[0];
    return first ? `e:${first.key}` : "";
  }
  const first = model.occurrences.find((o) => !o.allDay && dateOf(o.start) === anchor);
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

function eventButton(
  bits: EventBits,
  variant: "timed" | "bar" | "dot" | "row",
  extra: { s?: Record<string, string | number>; cls?: string; cont?: [boolean, boolean] } = {},
) {
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
      key: `${variant}:${o.key}:${extra.cont ? `${extra.cont[0]}` : ""}:${String(extra.s?.["--z-ev-from"] ?? "")}`,
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
    task ? h("span", { class: "z-event__box", "aria-hidden": "true" }) : null,
    h(
      "span",
      { class: "z-event__title" },
      e.title,
      o.seriesId ? h("span", { class: "z-event__icon", "aria-hidden": "true" }, icon("arrow-path", 12)) : null,
    ),
    meta.length && variant !== "bar" ? h("span", { class: "z-sr-only" }, ", ") : null,
    meta.length && variant !== "bar"
      ? h("span", { class: "z-event__meta" }, ...meta.flatMap((m, i): VNode[] => (i ? [" · ", m] : [h("bdi", null, m)])))
      : null,
    editable && variant === "timed" ? h("span", { class: "z-event__resize", "data-edge": "end", "aria-hidden": "true" }) : null,
    // El nombre sale del contenido: lo visible (título, hora, lugar) y, oculto a la vista, el resto (día,
    // calendario, provisional, repite). Así el nombre siempre contiene el texto visible (WCAG 2.5.3).
    h("span", { class: "z-sr-only" }, restOfLabel(o, config, model.sources, bits.start, bits.end, variant === "bar" ? [] : meta)),
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

/* ---------- Vistas ---------- */

function timeGrid(config: AgendaConfig, state: AgendaState, model: AgendaModel): VEl {
  const { labels, locale } = config;
  const days = model.days;
  const first = config.dayStart;
  const last = config.dayEnd;
  const preview = state.drag ?? state.grabbed;
  // El evento que se arrastra se pinta en su sitio nuevo; el original queda como hueco.
  const timed = model.occurrences
    .filter((o) => !o.allDay)
    .map((o) => (preview?.key === o.key ? { ...o, start: preview.start, end: preview.end } : o));
  const segments = splitByDay(timed, days);
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
                s: { "--z-ev-from": bar.from + 1, "--z-ev-span": bar.span, "--z-ev-lane": bar.lane + 1 },
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
            ...hours.map((m) =>
              h("span", { key: `h${m}`, s: { "--z-tg-at": m }, "aria-hidden": "true" }, m === first ? "" : timeText(m, locale)),
            ),
            showNow ? h("span", { class: "z-timegrid__now-label", s: { "--z-tg-at": nowMin } }, timeText(model.now, locale)) : null,
          ),
          ...days.map((d) => {
            const daySegs = segments.filter((s) => s.date === d && s.end > first && s.start < last);
            const placement = layoutTimed(daySegs, 20);
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
              ...[...daySegs]
                .sort((a, b) => a.start - b.start || b.end - a.end)
                .map((seg) => {
                  const p = placement.get(seg)!;
                  const o = seg.item as Occurrence;
                  return eventButton({ o, config, model, state, start: o.start, end: o.end }, "timed", {
                    s: {
                      "--z-ev-s": Math.max(seg.start, first),
                      "--z-ev-d": Math.max(Math.min(seg.end, last) - Math.max(seg.start, first), 0),
                      "--z-ev-col": p.col,
                      "--z-ev-n": p.n,
                      "--z-ev-w": p.w,
                    },
                    cls: p.side ? "z-event--side" : undefined,
                    cont: [seg.contStart, seg.contEnd],
                  });
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
  const dayItems = sortOccurrences(
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
      const row = layoutRow(items, week, Math.max(1, config.dayMaxEvents));
      return h(
        "div",
        { key: week[0], class: "z-monthgrid__week", role: "row" },
        ...week.map((d, i) => {
          const count = items.filter((o) => o.start < dayStart(d) + 1440 && Math.max(o.end, o.start + 1) > dayStart(d));
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
  const { labels, locale } = config;
  const groups = model.days
    .map((d) => ({
      d,
      items: model.occurrences.filter((o) => o.start < dayStart(d) + 1440 && Math.max(o.end, o.start + 1) > dayStart(d)),
    }))
    .filter((g) => g.items.length);
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
  return h(
    "div",
    { class: "z-agendalist", role: "list", "aria-label": model.title },
    ...groups.map(({ d, items }) => {
      const today = d === model.today;
      const headingId = `${uid}-day-${d}`;
      const nowAt = today ? items.findIndex((o) => o.start > model.now && !o.allDay) : -1;
      return h(
        "div",
        { key: d, class: "z-agendalist__day", role: "listitem", "data-today": on(today), "aria-labelledby": headingId },
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
        h(
          "ul",
          { class: "z-agendalist__items", role: "list" },
          ...items.flatMap((o, i) => {
            const source = model.sources.get(o.event.calendarId);
            const row = h(
              "li",
              { key: o.key, class: "z-agendalist__item" },
              eventButton({ o, config, model, state, start: o.start, end: o.end }, "row", { cls: "z-event--list" }),
              source
                ? h(
                    "span",
                    { class: "z-agendalist__calendar", "aria-hidden": "true", "data-color": colorOf(o.event, model.sources) },
                    source.name,
                  )
                : null,
            );
            return i === nowAt
              ? [
                  h(
                    "li",
                    { key: "now", class: "z-agendalist__now", "aria-hidden": "true" },
                    `${labels.now} · ${timeText(model.now, locale)}`,
                  ),
                  row,
                ]
              : [row];
          }),
        ),
      );
    }),
  );
}

/* ---------- Armazón ---------- */

function popovers(config: AgendaConfig, state: AgendaState, model: AgendaModel, uid: string): VNode[] {
  const { labels, locale } = config;
  const out: VNode[] = [];
  if (state.more) {
    const d = state.more;
    const items = sortOccurrences(
      model.occurrences.filter((o) => o.start < dayStart(d) + 1440 && Math.max(o.end, o.start + 1) > dayStart(d)),
    );
    out.push(
      h(
        "div",
        {
          key: `more-${d}`,
          class: "z-liquid z-popover z-agenda__pop",
          popover: "manual",
          role: "dialog",
          "aria-label": dayLong(d, locale),
          "data-pop": "more",
          "data-for": d,
        },
        h(
          "div",
          { class: "z-agenda__pop-head" },
          h("strong", null, dayLong(d, locale)),
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
  const ids = new Set<string>();
  for (const o of model.occurrences) ids.add(`e:${o.key}`);
  for (const d of model.days) ids.add(`d:${d}`);
  const valid =
    state.focus &&
    (state.focus.startsWith("s:")
      ? model.days.includes(state.focus.split(":")[1]!) && state.view !== "month" && state.view !== "agenda"
      : state.view === "month"
        ? ids.has(state.focus)
        : state.focus.startsWith("e:") && ids.has(state.focus));
  model.focusId = valid ? state.focus! : fallbackFocus(state, model, config);

  const view =
    state.view === "month"
      ? monthGrid(config, state, model)
      : state.view === "agenda"
        ? agendaList(config, state, model, uid)
        : timeGrid(config, state, model);
  const counts = new Map<string, number>();
  for (const o of expandEvents({
    events: config.events,
    from: model.days[0]!,
    to: model.days[model.days.length - 1]!,
    timeZone: state.timeZone,
  }))
    counts.set(o.event.calendarId, (counts.get(o.event.calendarId) ?? 0) + 1);
  const hidden = new Set(state.hidden);
  const inView = (d: string) => d >= model.days[0]! && d <= model.days[model.days.length - 1]!;

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
            inView: state.view === "month" || state.view === "agenda" ? () => false : inView,
            hasEvents: (d: string) => model.occurrences.some((o) => dateOf(o.start) === d),
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
    h("div", { class: "z-sr-only z-agenda__live", role: "status", "aria-live": "polite" }),
  );
  return { tree, model };
}

/** Días entre dos fechas (para el teclado del mes). */
export const daysBetween = diffDays;
export { addDays };
