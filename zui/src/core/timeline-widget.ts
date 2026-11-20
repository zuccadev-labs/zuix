// TimelineView como pieza (core/widget): Gantt (`mode="tasks"`) o recursos (`mode="resources"`). Teclado de un
// treegrid con tabindex itinerante (↑↓ entre filas, ←→ pliega y despliega una fase), agarrar–mover–soltar con teclado
// (±1 día, Mayús cambia la duración; en recursos ±`snapDuration`), arrastre con puntero (captura, umbral, por días o
// minutos), crear arrastrando sobre una fila vacía de recursos y ventana virtual de filas. Sin documento al importar.

import {
  clockMinutes,
  dateOf,
  dayStart,
  expandEvents,
  minuteOfDay,
  nowIn,
  rewriteSpan,
  snap,
  type CalendarEvent,
  type CalendarSource,
  type Occurrence,
} from "./agenda";
import { addDays, diffDays, localeWeekInfo, todayISO, valid } from "./date";
import { isRtl } from "./dir";
import { arrowDirection, nextInDirection } from "./spatial";
import {
  isMilestone,
  resizeTask,
  shiftTask,
  taskEnd,
  timelineColumns,
  type TimelineGroup,
  type TimelineScale,
  type TimelineTask,
} from "./timeline";
import {
  dateRangeText,
  RESOURCE_HOUR,
  resourceTimeline,
  TIMELINE_COL,
  TIMELINE_LABELS,
  taskFocusIds,
  taskTimeline,
  type ResourceItem,
  type ResourceRow,
  type TimelineLabels,
} from "./timeline-view";
import { fill, fmt, h, icon, on, type VEl } from "./vnode";
import { announceIn, focusActive, num, yes, type Widget, type WidgetHost } from "./widget";
import { safeTimeZone } from "./zone";

export interface Resource extends ResourceRow {
  group?: string;
}

export interface TimelineViewProps {
  mode?: "tasks" | "resources";
  /** Título de la barra («Design system Q4», «Rooms · Thu 19 Nov»). */
  title?: string;
  /* Tareas */
  tasks?: TimelineTask[];
  groups?: TimelineGroup[];
  scale?: TimelineScale;
  defaultScale?: TimelineScale;
  /** Escalas del selector de zoom. */
  scales?: TimelineScale[];
  /** Rango visible `{ from, to }` (to exclusivo). Por defecto, el de las tareas con margen. */
  range?: { from: string; to: string };
  /** Marca el camino crítico (por defecto, sí). */
  criticalPath?: boolean;
  dependencies?: boolean;
  /* Recursos */
  resources?: Resource[];
  events?: CalendarEvent[];
  calendars?: CalendarSource[];
  date?: string;
  timeZone?: string;
  dayStart?: string;
  dayEnd?: string;
  snapDuration?: number;
  /** Ventana virtual de filas a partir de este número de recursos (por defecto 60). */
  virtualizeFrom?: number;
  /* Común */
  editable?: boolean;
  selectable?: boolean;
  locale?: string;
  weekStartsOn?: number;
  today?: string;
  now?: number | string;
  labels?: Partial<TimelineLabels>;
}

export interface TimelineConfig {
  mode: "tasks" | "resources";
  title: string;
  tasks: TimelineTask[];
  groups: TimelineGroup[];
  scale: TimelineScale | null;
  defaultScale: TimelineScale;
  scales: TimelineScale[];
  from: string;
  to: string;
  criticalPath: boolean;
  dependencies: boolean;
  resources: Resource[];
  events: CalendarEvent[];
  calendars: CalendarSource[];
  date: string;
  timeZone: string;
  dayStart: number;
  dayEnd: number;
  snapDuration: number;
  virtualizeFrom: number;
  editable: boolean;
  selectable: boolean;
  locale?: string;
  weekStart: number;
  today: string;
  now: number | null;
  labels: TimelineLabels;
}

export interface TimelineState {
  scale: TimelineScale;
  collapsed: string[];
  focus: string | null;
  selected: string | null;
  grabbed: string | null;
  /** Tareas: fechas provisionales; recursos: minutos de pared provisionales. */
  preview: { id: string; start: string; end: string } | null;
  slotPreview: { key: string; start: number; end: number } | null;
  creating: { resourceId: string; start: number; end: number } | null;
  scroll: { top: number; height: number } | null;
}

const SCALES: TimelineScale[] = ["day", "week", "month"];

function defaultRange(tasks: TimelineTask[]): { from: string; to: string } {
  if (!tasks.length) {
    const t = todayISO();
    return { from: addDays(t, -7), to: addDays(t, 28) };
  }
  const from = tasks.map((t) => t.start).sort()[0]!;
  const to = tasks
    .map((t) => taskEnd(t))
    .sort()
    .at(-1)!;
  return { from: addDays(from, 0), to: addDays(to, 2) };
}

// Ocurrencias del día por lista de eventos (la misma lista entre pintados: desplazar no vuelve a expandir).
const dayCache = new WeakMap<CalendarEvent[], Map<string, Occurrence[]>>();
function occurrencesOf(config: TimelineConfig): Occurrence[] {
  const key = `${config.date}|${config.timeZone}`;
  let byKey = dayCache.get(config.events);
  const hit = byKey?.get(key);
  if (hit) return hit;
  const list = expandEvents({ events: config.events, from: config.date, to: config.date, timeZone: config.timeZone });
  if (!byKey) {
    byKey = new Map();
    dayCache.set(config.events, byKey);
  }
  if (byKey.size > 16) byKey.clear();
  byKey.set(key, list);
  return list;
}

function resourceItems(config: TimelineConfig, state: TimelineState): { items: ResourceItem[]; occ: Map<string, Occurrence> } {
  const base = dayStart(config.date);
  const occ = new Map<string, Occurrence>();
  const items: ResourceItem[] = [];
  for (const o of occurrencesOf(config)) {
    if (o.allDay) continue;
    const ids = o.event.resourceIds ?? [];
    const preview = state.slotPreview?.key === o.key ? state.slotPreview : null;
    for (const rid of ids) {
      const key = `${o.key}@${rid}`;
      occ.set(key, o);
      items.push({ key, resourceId: rid, start: (preview?.start ?? o.start) - base, end: (preview?.end ?? o.end) - base });
    }
  }
  return { items, occ };
}

const colorOf = (e: CalendarEvent, calendars: CalendarSource[]) => e.color ?? calendars.find((c) => c.id === e.calendarId)?.color ?? "1";
const clock = (m: number, locale?: string) => fmt(locale, { hour: "2-digit", minute: "2-digit" }).format(minuteOfDay(m) * 60_000);
function clockRange(a: number, b: number, locale?: string): string {
  const f = fmt(locale, { hour: "2-digit", minute: "2-digit" });
  try {
    return f.formatRange(minuteOfDay(a) * 60_000, minuteOfDay(a) * 60_000 + Math.max(0, b - a) * 60_000);
  } catch {
    return `${clock(a, locale)} – ${clock(b, locale)}`;
  }
}

export const timelineWidget: Widget<TimelineViewProps, TimelineConfig, TimelineState> = {
  root: "z-timeline",
  configure(p) {
    const tasks = p.tasks ?? [];
    const range = p.range && valid(p.range.from) && valid(p.range.to) ? p.range : defaultRange(tasks);
    const nowMs = p.now === undefined ? null : typeof p.now === "number" ? p.now : Date.parse(p.now);
    const scales = (p.scales ?? SCALES).filter((s) => SCALES.includes(s));
    return {
      mode: p.mode === "resources" ? "resources" : "tasks",
      title: p.title ?? "",
      tasks,
      groups: p.groups ?? [],
      scale: p.scale && SCALES.includes(p.scale) ? p.scale : null,
      defaultScale: p.defaultScale && SCALES.includes(p.defaultScale) ? p.defaultScale : "day",
      scales: scales.length ? scales : SCALES,
      from: range.from,
      to: range.to,
      criticalPath: p.criticalPath !== false,
      dependencies: p.dependencies !== false,
      resources: p.resources ?? [],
      events: p.events ?? [],
      calendars: p.calendars ?? [],
      date: valid(p.date) ? p.date : valid(p.today) ? p.today : todayISO(),
      timeZone: safeTimeZone(p.timeZone),
      dayStart: clockMinutes(p.dayStart, 8 * 60),
      dayEnd: clockMinutes(p.dayEnd, 19 * 60),
      snapDuration: Math.max(5, p.snapDuration ?? 15),
      virtualizeFrom: Math.max(1, p.virtualizeFrom ?? 60),
      editable: Boolean(p.editable),
      selectable: Boolean(p.selectable),
      locale: p.locale,
      weekStart: (((p.weekStartsOn ?? localeWeekInfo(p.locale).firstDay) % 7) + 7) % 7,
      today: valid(p.today) ? p.today : todayISO(),
      now: Number.isFinite(nowMs) ? (nowMs as number) : null,
      labels: { ...TIMELINE_LABELS, ...p.labels, scales: { ...TIMELINE_LABELS.scales, ...p.labels?.scales } },
    };
  },
  initial(config) {
    return {
      scale: config.scale ?? config.defaultScale,
      collapsed: config.groups.filter((g) => g.collapsed).map((g) => g.id),
      focus: null,
      selected: null,
      grabbed: null,
      preview: null,
      slotPreview: null,
      creating: null,
      scroll: null,
    };
  },
  control(config, state) {
    return config.scale && config.scale !== state.scale ? { ...state, scale: config.scale } : state;
  },
  tree(config, state, uid) {
    const { labels } = config;
    const tasks = config.mode === "tasks";
    const head = h(
      "div",
      { class: "z-timeline__toolbar" },
      config.title ? h("h2", { class: "z-timeline__title" }, config.title) : null,
      h("span", { class: "z-timeline__spacer-flex" }),
      tasks && config.scales.length > 1
        ? h(
            "div",
            { class: "z-segmented z-timeline__zoom", role: "group", "aria-label": labels.zoom },
            ...config.scales.map((s) =>
              h(
                "button",
                {
                  key: s,
                  type: "button",
                  class: "z-segmented__item",
                  "data-scale-option": s,
                  "aria-current": s === state.scale ? "true" : undefined,
                  "data-state": s === state.scale ? "on" : "off",
                },
                h("span", { class: "z-segmented__label" }, labels.scales[s]),
              ),
            ),
          )
        : null,
    );
    let body: VEl;
    if (tasks) {
      body = taskTimeline({
        uid,
        tasks: config.tasks,
        groups: config.groups,
        scale: state.scale,
        from: config.from,
        to: config.to,
        today: config.today,
        locale: config.locale,
        weekStart: config.weekStart,
        collapsed: state.collapsed,
        focus: state.focus,
        selected: state.selected,
        preview: state.preview,
        grabbed: state.grabbed,
        showCritical: config.criticalPath,
        showDependencies: config.dependencies,
        editable: config.editable,
        labels,
      });
    } else {
      const { items, occ } = resourceItems(config, state);
      const focusKeys = items.map((it) => it.key);
      const focus = state.focus && focusKeys.includes(state.focus) ? state.focus : (focusKeys[0] ?? "");
      const nowMin = config.now !== null ? nowIn(config.now, config.timeZone) : null;
      body = resourceTimeline({
        uid,
        resources: config.resources,
        items,
        dayStart: config.dayStart,
        dayEnd: config.dayEnd,
        now: nowMin !== null && dateOf(nowMin) === config.date ? minuteOfDay(nowMin) : null,
        locale: config.locale,
        scroll: config.resources.length >= config.virtualizeFrom ? (state.scroll ?? { top: 0, height: 640 }) : null,
        creating: state.creating,
        labels: { resource: labels.resource, overlaps: labels.overlaps, newBooking: labels.newBooking },
        renderItem: (it, layout) => {
          const o = occ.get(it.key)!;
          const time = clockRange(it.start, it.end, config.locale);
          return h(
            "button",
            {
              key: it.key,
              type: "button",
              class: "z-event z-timeline__booking",
              "data-variant": "timed",
              "data-key": it.key,
              "data-focus-id": it.key,
              "data-color": colorOf(o.event, config.calendars),
              "data-conflict": on(layout.conflict),
              "data-half": layout.half ?? undefined,
              "data-selected": on(state.selected === it.key),
              "data-grabbed": on(state.grabbed === it.key),
              "data-tentative": on(o.event.status === "tentative"),
              "aria-pressed": state.grabbed === it.key ? "true" : undefined,
              tabindex: focus === it.key ? 0 : -1,
              s: layout.s,
            },
            h(
              "span",
              { class: "z-event__title" },
              layout.conflict ? h("span", { class: "z-timeline__warn", "aria-hidden": "true" }, icon("exclamation-triangle", 12)) : null,
              o.event.title,
            ),
            h("span", { class: "z-sr-only" }, ", "),
            h("span", { class: "z-event__meta" }, h("bdi", null, time)),
            h(
              "span",
              { class: "z-sr-only" },
              [
                "",
                config.resources.find((r) => r.id === it.resourceId)?.title,
                layout.conflict ? labels.overlaps : null,
                config.calendars.find((c) => c.id === o.event.calendarId)?.name,
              ]
                .filter((x) => x !== null && x !== undefined)
                .join(", "),
            ),
          );
        },
      });
    }
    const legend = tasks
      ? h(
          "div",
          { class: "z-timeline__legend", "aria-hidden": "true" },
          config.dependencies ? h("span", null, h("i", { class: "z-timeline__key-line" }), labels.dependency) : null,
          config.criticalPath ? h("span", null, h("i", { class: "z-timeline__key-line", "data-critical": "" }), labels.criticalPath) : null,
          h("span", null, h("i", { class: "z-timeline__key-ms" }), labels.milestone),
          h("span", null, h("i", { class: "z-timeline__key-today" }), labels.today),
        )
      : null;
    return h(
      "div",
      {
        class: "z-timeline z-liquid",
        "data-mode": config.mode,
        "data-scale": tasks ? state.scale : "hour",
        "data-grabbing": on(Boolean(state.grabbed)),
      },
      head,
      body,
      state.grabbed ? h("p", { class: "z-timeline__hint", "aria-hidden": "true" }, labels.grabHint) : null,
      legend,
      h("div", { key: "live", class: "z-sr-only", role: "status", "aria-live": "polite", "data-live": "" }),
    );
  },
  attach(root, host) {
    const abort = new AbortController();
    const signal = abort.signal;
    const drag = {
      id: null as string | null,
      pointer: -1,
      x: 0,
      started: false,
      mode: "move" as "move" | "resize" | "create",
      resource: "",
      origin: 0,
      moved: false,
    };
    const ids = () => {
      const c = host.config();
      const s = host.state();
      return c.mode === "tasks" ? taskFocusIds(c.tasks, c.groups, s.collapsed) : [];
    };
    const taskOf = (id: string) => host.config().tasks.find((t) => t.id === id);
    const commitTask = (t: TimelineTask, start: string, end: string, kind: "move" | "resize") => {
      if (start === t.start && end === taskEnd(t)) return;
      host.emit("task-change", { task: t, start, end, kind });
      const c = host.config();
      announceIn(
        root,
        fill(c.labels.moved, { title: t.title, when: dateRangeText(start, isMilestone(t) ? addDays(start, 1) : end, c.locale) }),
      );
    };
    const { occFor, itemFor } = {
      occFor: (key: string) => resourceItems(host.config(), host.state()).occ.get(key),
      itemFor: (key: string) => resourceItems(host.config(), host.state()).items.find((i) => i.key === key),
    };
    const commitBooking = (key: string, start: number, end: number) => {
      const c = host.config();
      const o = occFor(key);
      if (!o) return;
      const base = dayStart(c.date);
      if (o.start === base + start && o.end === base + end) return;
      const out = rewriteSpan(o.event, { start: base + start, end: base + end }, c.timeZone);
      host.emit("event-change", { event: o.event, occurrence: o.key, seriesId: o.seriesId, start: out.start, end: out.end, kind: "move" });
      announceIn(root, fill(c.labels.moved, { title: o.event.title, when: clockRange(start, end, c.locale) }));
    };

    root.addEventListener(
      "click",
      (event) => {
        const target = event.target as HTMLElement;
        if (drag.moved) {
          drag.moved = false;
          event.preventDefault();
          return;
        }
        const zoom = target.closest<HTMLElement>("[data-scale-option]");
        if (zoom) {
          const scale = zoom.dataset.scaleOption as TimelineScale;
          if (scale !== host.state().scale) {
            host.update({ scale });
            host.emit("scale-change", { scale });
          }
          return;
        }
        const toggle = target.closest<HTMLElement>(".z-timeline__toggle");
        if (toggle?.dataset.groupId) {
          const id = toggle.dataset.groupId;
          const set = new Set(host.state().collapsed);
          const open = set.has(id);
          if (open) set.delete(id);
          else set.add(id);
          host.update({ collapsed: [...set], focus: `g:${id}` }, true);
          host.emit("group-toggle", { groupId: id, collapsed: !open });
          return;
        }
        const piece = target.closest<HTMLElement>("[data-task]");
        if (piece?.dataset.task) {
          const t = taskOf(piece.dataset.task);
          if (t) {
            host.update({ selected: t.id, focus: `t:${t.id}` });
            host.emit("task-click", { task: t });
          }
          return;
        }
        const booking = target.closest<HTMLElement>(".z-timeline__booking");
        if (booking?.dataset.key) {
          const o = occFor(booking.dataset.key);
          host.update({ selected: booking.dataset.key, focus: booking.dataset.key });
          if (o) host.emit("event-click", { event: o.event, occurrence: o.key, resourceId: itemFor(booking.dataset.key)?.resourceId });
        }
      },
      { signal },
    );

    root.addEventListener(
      "keydown",
      (event) => {
        const target = event.target as HTMLElement;
        const piece = target.closest<HTMLElement>("[data-focus-id]");
        if (!piece || event.defaultPrevented) return;
        const c = host.config();
        const s = host.state();
        const rtl = isRtl(root);
        const key = rtl && event.key === "ArrowLeft" ? "ArrowRight" : rtl && event.key === "ArrowRight" ? "ArrowLeft" : event.key;
        const id = piece.dataset.focusId!;
        // Agarrado: mover o redimensionar con flechas, soltar con Intro, cancelar con Escape.
        if (s.grabbed && (s.grabbed === id || `t:${s.grabbed}` === id)) {
          event.preventDefault();
          if (event.key === "Escape") {
            host.update({ grabbed: null, preview: null, slotPreview: null }, true);
            announceIn(root, c.labels.cancelled);
            return;
          }
          if (event.key === "Enter" || event.key === " ") {
            if (c.mode === "tasks" && s.preview) {
              const t = taskOf(s.preview.id);
              if (t)
                commitTask(
                  t,
                  s.preview.start,
                  s.preview.end,
                  s.preview.end !== taskEnd(t) && s.preview.start === t.start ? "resize" : "move",
                );
            } else if (s.slotPreview)
              commitBooking(s.slotPreview.key, s.slotPreview.start - dayStart(c.date), s.slotPreview.end - dayStart(c.date));
            host.update({ grabbed: null, preview: null, slotPreview: null }, true);
            return;
          }
          const sign = key === "ArrowLeft" ? -1 : key === "ArrowRight" ? 1 : 0;
          if (!sign) return;
          if (c.mode === "tasks") {
            const t = taskOf(s.grabbed)!;
            const cur = s.preview ?? { id: t.id, start: t.start, end: taskEnd(t) };
            const base = { ...t, start: cur.start, end: cur.end };
            const next = event.shiftKey ? resizeTask(base, sign) : shiftTask(base, sign);
            host.update({ preview: { id: t.id, ...next } }, true);
            announceIn(root, dateRangeText(next.start, isMilestone(t) ? addDays(next.start, 1) : next.end, c.locale));
          } else {
            const o = occFor(s.grabbed);
            if (!o) return;
            const cur = s.slotPreview ?? { key: s.grabbed, start: o.start, end: o.end };
            const step = sign * c.snapDuration;
            const next = event.shiftKey
              ? { ...cur, end: Math.max(cur.start + c.snapDuration, cur.end + step) }
              : { ...cur, start: cur.start + step, end: cur.end + step };
            host.update({ slotPreview: next }, true);
            announceIn(root, clockRange(next.start, next.end, c.locale));
          }
          return;
        }
        if (c.mode === "tasks") {
          const list = ids();
          const i = list.indexOf(id);
          const go = (j: number) => {
            const next = list[Math.max(0, Math.min(list.length - 1, j))];
            if (next && next !== id) host.update({ focus: next }, true);
          };
          if (event.key === "ArrowDown") go(i + 1);
          else if (event.key === "ArrowUp") go(i - 1);
          else if (event.key === "Home") go(0);
          else if (event.key === "End") go(list.length - 1);
          else if (id.startsWith("g:") && (key === "ArrowLeft" || key === "ArrowRight")) {
            const gid = id.slice(2);
            const set = new Set(s.collapsed);
            if ((key === "ArrowLeft") === set.has(gid)) return;
            if (key === "ArrowLeft") set.add(gid);
            else set.delete(gid);
            host.update({ collapsed: [...set] }, true);
            host.emit("group-toggle", { groupId: gid, collapsed: key === "ArrowLeft" });
          } else if (id.startsWith("t:") && (event.key === "Enter" || event.key === " ")) {
            const t = taskOf(id.slice(2));
            if (!t) return;
            if (s.selected === t.id && c.editable && t.editable !== false) {
              host.update({ grabbed: t.id, preview: { id: t.id, start: t.start, end: taskEnd(t) } }, true);
              announceIn(root, `${t.title}. ${c.labels.grabHint}`);
            } else {
              host.update({ selected: t.id, focus: id });
              host.emit("task-click", { task: t });
            }
          } else return;
          event.preventDefault();
          return;
        }
        // Recursos: navegación espacial entre reservas.
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          const o = occFor(id);
          if (!o) return;
          if (s.selected === id && c.editable && o.event.editable !== false) {
            host.update({ grabbed: id, slotPreview: { key: id, start: o.start, end: o.end } }, true);
            announceIn(root, `${o.event.title}. ${c.labels.grabHint}`);
          } else {
            host.update({ selected: id, focus: id });
            host.emit("event-click", { event: o.event, occurrence: o.key, resourceId: itemFor(id)?.resourceId });
          }
          return;
        }
        const dir = arrowDirection(event.key);
        if (!dir) return;
        const pieces = [...root.querySelectorAll<HTMLElement>(".z-timeline__booking")];
        const j = nextInDirection(
          piece.getBoundingClientRect(),
          pieces.map((p) => p.getBoundingClientRect()),
          dir,
        );
        if (j >= 0 && pieces[j] !== piece) {
          event.preventDefault();
          host.update({ focus: pieces[j]!.dataset.focusId! }, true);
        }
      },
      { signal },
    );

    // Puntero: mover y redimensionar barras (por días) y reservas (por minutos); crear sobre una fila vacía.
    const unitPx = () => {
      const c = host.config();
      if (c.mode === "resources") return RESOURCE_HOUR / 60; // px por minuto
      const s = host.state();
      const cols = timelineColumns(c.from, c.to, s.scale, c.weekStart);
      const days = cols.length ? diffDays(cols[0]!.date, addDays(cols.at(-1)!.date, cols.at(-1)!.days)) : 1;
      return (cols.length * TIMELINE_COL[s.scale]) / Math.max(1, days); // px por día
    };
    root.addEventListener(
      "pointerdown",
      (event) => {
        if (event.button !== 0) return;
        const c = host.config();
        const target = event.target as HTMLElement;
        const bar = target.closest<HTMLElement>(".z-timeline__bar[data-editable], .z-timeline__milestone, .z-timeline__booking");
        if (bar && c.editable) {
          drag.id = bar.dataset.task ?? bar.dataset.key ?? null;
          drag.mode = target.closest(".z-timeline__resize") ? "resize" : "move";
        } else if (c.mode === "resources" && c.selectable && target.matches(".z-timeline__track")) {
          const rect = target.getBoundingClientRect();
          const x = isRtl(root) ? rect.right - event.clientX : event.clientX - rect.left;
          drag.id = "create";
          drag.mode = "create";
          drag.resource = target.dataset.resource ?? "";
          drag.origin = snap(c.dayStart + x / unitPx(), c.snapDuration);
        } else return;
        drag.pointer = event.pointerId;
        drag.x = event.clientX;
        drag.started = false;
        drag.moved = false;
        (bar ?? target).setPointerCapture?.(event.pointerId);
      },
      { signal },
    );
    const doc = root.ownerDocument;
    doc.addEventListener(
      "pointermove",
      (event) => {
        if (event.pointerId !== drag.pointer || !drag.id) return;
        const dx = (event.clientX - drag.x) * (isRtl(root) ? -1 : 1);
        if (!drag.started && Math.abs(dx) < 4) return;
        drag.started = true;
        const c = host.config();
        if (drag.mode === "create") {
          const at = snap(drag.origin + dx / unitPx(), c.snapDuration);
          const [a, b] = at < drag.origin ? [at, drag.origin] : [drag.origin, Math.max(at, drag.origin + c.snapDuration)];
          host.update({ creating: { resourceId: drag.resource, start: Math.max(c.dayStart, a), end: Math.min(c.dayEnd, b) } });
          return;
        }
        if (c.mode === "tasks") {
          const t = taskOf(drag.id);
          if (!t) return;
          const days = Math.round(dx / unitPx());
          const next = drag.mode === "resize" ? resizeTask(t, days) : shiftTask(t, days);
          host.update({ preview: { id: t.id, ...next }, selected: t.id });
        } else {
          const o = occFor(drag.id);
          if (!o) return;
          const minutes = snap(dx / unitPx(), c.snapDuration);
          const next =
            drag.mode === "resize"
              ? { key: drag.id, start: o.start, end: Math.max(o.start + c.snapDuration, o.end + minutes) }
              : { key: drag.id, start: o.start + minutes, end: o.end + minutes };
          host.update({ slotPreview: next, selected: drag.id });
        }
      },
      { signal },
    );
    const end = (event: PointerEvent, cancel = false) => {
      if (event.pointerId !== drag.pointer || !drag.id) return;
      const c = host.config();
      const s = host.state();
      if (drag.started && !cancel) {
        drag.moved = true;
        if (drag.mode === "create" && s.creating) {
          const base = `${c.date}T`;
          const t = (m: number) => `${base}${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
          host.emit("select-slot", {
            resourceId: s.creating.resourceId,
            start: t(s.creating.start),
            end: t(s.creating.end),
            allDay: false,
            timeZone: c.timeZone,
          });
        } else if (c.mode === "tasks" && s.preview) {
          const t = taskOf(s.preview.id);
          if (t) commitTask(t, s.preview.start, s.preview.end, drag.mode === "resize" ? "resize" : "move");
        } else if (s.slotPreview)
          commitBooking(s.slotPreview.key, s.slotPreview.start - dayStart(c.date), s.slotPreview.end - dayStart(c.date));
      }
      if (drag.started) host.update({ preview: null, slotPreview: null, creating: drag.mode === "create" && !cancel ? s.creating : null });
      drag.id = null;
      drag.pointer = -1;
    };
    doc.addEventListener("pointerup", (e) => end(e), { signal });
    doc.addEventListener("pointercancel", (e) => end(e, true), { signal });

    // Ventana virtual: al desplazar, solo se vuelve a pintar si cambia la ventana.
    let frame = 0;
    root.addEventListener(
      "scroll",
      (event) => {
        const scroller = event.target as HTMLElement;
        if (!scroller.matches?.(".z-timeline__scroll[data-virtual]")) return;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          const head = scroller.querySelector<HTMLElement>(".z-timeline__head")?.offsetHeight ?? 0;
          host.update({ scroll: { top: Math.max(0, scroller.scrollTop - head), height: scroller.clientHeight } });
        });
      },
      { signal, capture: true },
    );
    return () => {
      abort.abort();
      cancelAnimationFrame(frame);
    };
  },
  after(root, host, focus) {
    const s = host.state();
    const scroller = root.querySelector<HTMLElement>(".z-timeline__scroll[data-virtual]");
    if (scroller && !s.scroll) {
      const head = scroller.querySelector<HTMLElement>(".z-timeline__head")?.offsetHeight ?? 0;
      const height = scroller.clientHeight;
      if (height) queueMicrotask(() => host.update({ scroll: { top: Math.max(0, scroller.scrollTop - head), height } }));
    }
    if (!focus) return;
    const id = s.focus ?? (s.grabbed ? (host.config().mode === "tasks" ? `t:${s.grabbed}` : s.grabbed) : null);
    if (id) {
      const el = root.querySelector<HTMLElement>(`[data-focus-id="${CSS.escape(id)}"]`);
      if (el && el !== root.ownerDocument.activeElement) {
        el.focus({ preventScroll: true });
        el.scrollIntoView?.({ block: "nearest", inline: "nearest" });
        return;
      }
    }
    focusActive(root);
  },
  fromDom(el, json) {
    const d = el.dataset;
    return {
      mode: d.mode === "resources" ? "resources" : "tasks",
      title: d.title,
      tasks: json.tasks as TimelineTask[] | undefined,
      groups: json.groups as TimelineGroup[] | undefined,
      defaultScale: (d.scale as TimelineScale) ?? undefined,
      scales: d.scales ? (d.scales.split(/[\s,]+/) as TimelineScale[]) : undefined,
      range: json.range as { from: string; to: string } | undefined,
      criticalPath: d.criticalPath !== "false",
      dependencies: d.dependencies !== "false",
      resources: json.resources as Resource[] | undefined,
      events: json.events as CalendarEvent[] | undefined,
      calendars: json.calendars as CalendarSource[] | undefined,
      date: d.date,
      timeZone: d.timeZone,
      dayStart: d.dayStart,
      dayEnd: d.dayEnd,
      snapDuration: d.snapDuration ? num(d.snapDuration, 15) : undefined,
      virtualizeFrom: d.virtualizeFrom ? num(d.virtualizeFrom, 60) : undefined,
      editable: yes(d.editable),
      selectable: yes(d.selectable),
      locale: d.locale,
      weekStartsOn: d.weekStart !== undefined ? num(d.weekStart, 1) : undefined,
      today: d.today,
      now: d.now,
      labels: json.labels as Partial<TimelineLabels> | undefined,
    };
  },
};

export type { WidgetHost };
