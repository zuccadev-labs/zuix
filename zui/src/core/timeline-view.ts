// Marcado de la línea temporal: Gantt (fases, tareas, hitos, dependencias, camino crítico, hoy, zoom) y recursos
// (filas de salas o personas, reservas por hora, conflictos con trama y texto, ventana virtual de filas). Árboles de
// core/vnode con el cálculo de core/timeline y core/virtual. Sin documento.

import { addDays, diffDays, localeWeekInfo, parse, weekNumber } from "./date";
import {
  barPosition,
  columnAt,
  criticalPath,
  dependencyEdges,
  isMilestone,
  pathOf,
  routeDependency,
  taskDays,
  taskEnd,
  timelineColumns,
  timelineRows,
  type TimelineGroup,
  type TimelineScale,
  type TimelineTask,
} from "./timeline";
import { virtualWindow } from "./virtual";
import { fill, fmt, h, icon, on, type VEl, type VNode } from "./vnode";

/** Ancho de columna por escala y alto de fila (px): maquetación calculada, la misma en el SVG de dependencias. */
export const TIMELINE_COL: Record<TimelineScale, number> = { day: 30, week: 84, month: 120 };
export const TIMELINE_ROW = 40;
export const RESOURCE_ROW = 52;
export const RESOURCE_HOUR = 88;

export interface TimelineLabels {
  task: string;
  resource: string;
  scales: Record<TimelineScale, string>;
  zoom: string;
  /** «{n} d». */
  daysShort: string;
  /** «{n} days». */
  days: string;
  /** «{n}% complete». */
  progress: string;
  milestone: string;
  critical: string;
  /** «Depends on {list}». */
  dependsOn: string;
  dependency: string;
  criticalPath: string;
  today: string;
  /** «Week {n}» y abreviatura «W{n}». */
  week: string;
  weekShort: string;
  expand: string;
  collapse: string;
  overlaps: string;
  busy: string;
  newBooking: string;
  grabHint: string;
  /** «Moved {title} to {when}». */
  moved: string;
  cancelled: string;
}

export const TIMELINE_LABELS: TimelineLabels = {
  task: "Task",
  resource: "Room",
  scales: { day: "Days", week: "Weeks", month: "Months" },
  zoom: "Zoom",
  daysShort: "{n} d",
  days: "{n} days",
  progress: "{n}% complete",
  milestone: "milestone",
  critical: "critical path",
  dependsOn: "Depends on {list}",
  dependency: "Dependency",
  criticalPath: "Critical path",
  today: "Today",
  week: "Week {n}",
  weekShort: "W{n}",
  expand: "Expand",
  collapse: "Collapse",
  overlaps: "Overlaps",
  busy: "Busy",
  newBooking: "New booking",
  grabHint: "Arrows to move · Shift+Arrows to resize · Enter to drop · Esc to cancel",
  moved: "Moved {title} to {when}",
  cancelled: "Move cancelled",
};

const dayFmt = (locale: string | undefined) => fmt(locale, { day: "numeric", month: "short" });
export function dateRangeText(from: string, toExclusive: string, locale?: string): string {
  const f = fmt(locale, { day: "numeric", month: "short" });
  const last = addDays(toExclusive, -1);
  if (last <= from) return f.format(parse(from));
  try {
    return f.formatRange(parse(from), parse(last));
  } catch {
    return `${f.format(parse(from))} – ${f.format(parse(last))}`;
  }
}

/* ---------- Gantt ---------- */

export interface TaskTimelineInput {
  uid: string;
  tasks: TimelineTask[];
  groups: TimelineGroup[];
  scale: TimelineScale;
  from: string;
  to: string;
  today: string;
  locale?: string;
  weekStart: number;
  collapsed: string[];
  /** Pieza enfocable: `t:<id>` o `g:<id>`. */
  focus: string | null;
  selected: string | null;
  /** Vista previa de un arrastre o de lo agarrado con teclado. */
  preview: { id: string; start: string; end: string } | null;
  grabbed: string | null;
  showCritical: boolean;
  showDependencies: boolean;
  editable: boolean;
  labels: TimelineLabels;
}

/** Filas visibles y la pieza enfocable de cada una (para el teclado). */
export function taskFocusIds(tasks: TimelineTask[], groups: TimelineGroup[], collapsed: string[]): string[] {
  return timelineRows(tasks, groups, collapsed).map((r) => (r.kind === "group" ? `g:${r.group.id}` : `t:${r.task.id}`));
}

function scaleHeader(
  columns: { date: string; days: number }[],
  scale: TimelineScale,
  input: { today: string; locale?: string; labels: TimelineLabels; weekStart: number },
): VNode[] {
  const { locale, labels } = input;
  const weekend = new Set(localeWeekInfo(locale).weekend);
  if (scale === "day") {
    // Fila de semanas (W46 · 9 Nov) y fila de días.
    const weeks: { start: number; span: number; date: string }[] = [];
    columns.forEach((c, i) => {
      const wd = (parse(c.date).getUTCDay() - input.weekStart + 7) % 7;
      if (i === 0 || wd === 0) weeks.push({ start: i, span: 0, date: c.date });
      weeks[weeks.length - 1]!.span++;
    });
    return [
      ...weeks.map((w) =>
        h(
          "span",
          { key: `w${w.date}`, class: "z-timeline__unit z-timeline__unit--group", s: { "--z-tl-at": w.start, "--z-tl-span": w.span } },
          `${fill(labels.weekShort, { n: weekNumber(w.date, 1, 4).week })} · ${dayFmt(locale).format(parse(w.date))}`,
        ),
      ),
      ...columns.map((c, i) =>
        h(
          "span",
          {
            key: c.date,
            class: "z-timeline__unit z-timeline__unit--day",
            s: { "--z-tl-at": i, "--z-tl-span": 1 },
            "data-weekend": on(weekend.has(parse(c.date).getUTCDay())),
            "data-today": on(c.date === input.today),
            "aria-label": fmt(locale, { dateStyle: "full" }).format(parse(c.date)),
          },
          h("small", { "aria-hidden": "true" }, fmt(locale, { weekday: "narrow" }).format(parse(c.date))),
          h("b", { "aria-hidden": "true" }, fmt(locale, { day: "numeric" }).format(parse(c.date))),
        ),
      ),
    ];
  }
  return columns.map((c, i) =>
    h(
      "span",
      {
        key: c.date,
        class: "z-timeline__unit z-timeline__unit--day",
        s: { "--z-tl-at": i, "--z-tl-span": 1 },
        "data-today": on(input.today >= c.date && input.today < addDays(c.date, c.days)),
      },
      ...(scale === "week"
        ? [
            h("small", null, fill(labels.weekShort, { n: weekNumber(c.date, 1, 4).week })),
            h("b", null, dayFmt(locale).format(parse(c.date))),
          ]
        : [
            h("small", null, fmt(locale, { year: "numeric" }).format(parse(c.date))),
            h("b", null, fmt(locale, { month: "short" }).format(parse(c.date))),
          ]),
    ),
  );
}

export function taskTimeline(input: TaskTimelineInput): VEl {
  const { uid, scale, labels, locale } = input;
  const columns = timelineColumns(input.from, input.to, scale, input.weekStart);
  const col = TIMELINE_COL[scale];
  const rows = timelineRows(input.tasks, input.groups, input.collapsed);
  const byId = new Map(input.tasks.map((t) => [t.id, t]));
  const cp = input.showCritical ? criticalPath(input.tasks) : null;
  const shown = (t: TimelineTask) =>
    input.preview?.id === t.id ? { start: input.preview.start, end: input.preview.end } : { start: t.start, end: taskEnd(t) };
  const rowOf = new Map<string, number>();
  rows.forEach((r, i) => {
    if (r.kind === "task") rowOf.set(r.task.id, i);
    else if (r.collapsed) for (const t of r.tasks) rowOf.set(t.id, i);
  });
  const focusIds = rows.map((r) => (r.kind === "group" ? `g:${r.group.id}` : `t:${r.task.id}`));
  const focus =
    input.focus && focusIds.includes(input.focus) ? input.focus : (focusIds.find((f) => f.startsWith("t:")) ?? focusIds[0] ?? "");
  const width = columns.length * col;
  const height = rows.length * TIMELINE_ROW;
  const todayAt = input.today >= input.from && input.today < input.to ? columnAt(input.today, columns) : null;
  const weekend = new Set(localeWeekInfo(locale).weekend);

  // Dependencias en coordenadas lógicas del área de pistas.
  const deps: VNode[] = [];
  if (input.showDependencies)
    for (const e of dependencyEdges(input.tasks)) {
      const a = byId.get(e.from)!;
      const b = byId.get(e.to)!;
      const ra = rowOf.get(a.id);
      const rb = rowOf.get(b.id);
      if (ra === undefined || rb === undefined || ra === rb) continue;
      const sa = shown(a);
      const sb = shown(b);
      const ax = isMilestone(a)
        ? (columnAt(sa.start, columns) + 0.5 / (scale === "day" ? 1 : 7)) * col + 8
        : columnAt(sa.end, columns) * col - 3;
      const bx = isMilestone(b)
        ? columnAt(sb.start, columns) * col + (scale === "day" ? col / 2 - 9 : 0)
        : columnAt(sb.start, columns) * col + 3;
      const points = routeDependency(
        { x: ax, y: ra * TIMELINE_ROW + TIMELINE_ROW / 2 },
        { x: bx, y: rb * TIMELINE_ROW + TIMELINE_ROW / 2 },
        8,
        TIMELINE_ROW / 2,
      );
      const critical = Boolean(cp?.edges.has(`${e.from}→${e.to}`));
      deps.push(
        h("path", {
          key: `${e.from}-${e.to}`,
          d: pathOf(points),
          "data-critical": on(critical),
          "marker-end": `url(#${uid}-${critical ? "arrow-critical" : "arrow"})`,
        }),
      );
    }

  const depText = (t: TimelineTask) => {
    const names = (t.dependsOn ?? []).map((id) => byId.get(id)?.title).filter(Boolean);
    return names.length ? fill(labels.dependsOn, { list: names.join(", ") }) : "";
  };

  const rowNodes = rows.map((r, i) => {
    if (r.kind === "group") {
      const id = `g:${r.group.id}`;
      const pos = barPosition(r.start, r.end, columns);
      return h(
        "div",
        {
          key: id,
          class: "z-timeline__row",
          role: "row",
          "data-group": "",
          "aria-level": 1,
          "aria-expanded": r.collapsed ? "false" : "true",
          "aria-rowindex": i + 2,
        },
        h(
          "div",
          { class: "z-timeline__label", role: "rowheader" },
          h(
            "button",
            {
              type: "button",
              class: "z-timeline__toggle",
              "data-group-id": r.group.id,
              "data-focus-id": id,
              "aria-expanded": r.collapsed ? "false" : "true",
              tabindex: focus === id ? 0 : -1,
            },
            h("span", { class: "z-timeline__chevron", "aria-hidden": "true" }, icon("chevron-down", 14)),
            h("span", { class: "z-timeline__name" }, r.group.title),
            h("span", { class: "z-sr-only" }, `, ${r.collapsed ? labels.expand : labels.collapse}`),
          ),
          h("span", { class: "z-timeline__sub", "aria-hidden": "true" }, fill(labels.daysShort, { n: diffDays(r.start, r.end) })),
        ),
        h(
          "div",
          { class: "z-timeline__track", role: "gridcell" },
          h("span", {
            class: "z-timeline__summary",
            role: "img",
            "aria-label": `${r.group.title}, ${dateRangeText(r.start, r.end, locale)}`,
            s: { "--z-tl-from": pos.from, "--z-tl-span": pos.span },
          }),
        ),
      );
    }
    const t = r.task;
    const id = `t:${t.id}`;
    const span = shown(t);
    const milestone = isMilestone(t);
    const critical = Boolean(cp?.tasks.has(t.id));
    const pos = barPosition(span.start, milestone ? span.start : span.end, columns);
    const days = milestone ? 0 : diffDays(span.start, span.end);
    const dep = depText(t);
    const depId = dep ? `${uid}-dep-${t.id}` : undefined;
    const when = milestone
      ? fmt(locale, { day: "numeric", month: "long" }).format(parse(span.start))
      : dateRangeText(span.start, span.end, locale);
    const progress = t.progress !== undefined && !milestone ? Math.max(0, Math.min(100, Math.round(t.progress))) : null;
    const nameParts = [t.title, when, milestone ? labels.milestone : fill(labels.days, { n: days })];
    if (progress !== null) nameParts.push(fill(labels.progress, { n: progress }));
    if (critical) nameParts.push(labels.critical);
    const item = milestone
      ? h(
          "button",
          {
            type: "button",
            class: "z-timeline__milestone",
            "data-task": t.id,
            "data-focus-id": id,
            "data-critical": on(critical),
            "data-selected": on(input.selected === t.id),
            "aria-describedby": depId,
            tabindex: focus === id ? 0 : -1,
            s: { "--z-tl-from": pos.from + (scale === "day" ? 0.5 : 0) },
          },
          h("i", { "aria-hidden": "true" }),
          h("span", { class: "z-timeline__milestone-text", "aria-hidden": "true" }, t.title),
          h("span", { class: "z-sr-only" }, nameParts.join(", ")),
        )
      : h(
          "button",
          {
            type: "button",
            class: "z-event z-timeline__bar",
            "data-variant": "bar",
            "data-task": t.id,
            "data-focus-id": id,
            "data-color": t.color ?? "1",
            "data-critical": on(critical),
            "data-selected": on(input.selected === t.id),
            "data-grabbed": on(input.grabbed === t.id),
            "data-editable": on(input.editable && t.editable !== false),
            "aria-pressed": input.grabbed === t.id ? "true" : undefined,
            "aria-describedby": depId,
            tabindex: focus === id ? 0 : -1,
            s: { "--z-tl-from": pos.from, "--z-tl-span": pos.span, "--z-tl-progress": `${progress ?? 0}%` },
          },
          h("span", { class: "z-event__title" }, t.title),
          progress !== null ? h("span", { class: "z-timeline__pct", "aria-hidden": "true" }, `${progress}%`) : null,
          h("span", { class: "z-sr-only" }, `, ${nameParts.slice(1).join(", ")}`),
          input.editable && t.editable !== false
            ? h("span", { class: "z-event__resize z-timeline__resize", "data-edge": "end", "aria-hidden": "true" })
            : null,
        );
    return h(
      "div",
      { key: id, class: "z-timeline__row", role: "row", "aria-level": r.group ? 2 : 1, "aria-rowindex": i + 2 },
      h(
        "div",
        { class: "z-timeline__label", role: "rowheader", "data-indent": on(Boolean(r.group)) },
        milestone
          ? h("span", { class: "z-timeline__flag", "aria-hidden": "true" }, icon("flag", 14))
          : h("span", { class: "z-timeline__dot", "data-color": t.color ?? "1", "aria-hidden": "true" }),
        h("span", { class: "z-timeline__name" }, t.title),
        h(
          "span",
          { class: "z-timeline__sub", "aria-hidden": "true" },
          milestone ? dayFmt(locale).format(parse(span.start)) : fill(labels.daysShort, { n: taskDays({ ...t, ...span }) }),
        ),
      ),
      h("div", { class: "z-timeline__track", role: "gridcell" }, item, dep ? h("span", { id: depId, class: "z-sr-only" }, dep) : null),
    );
  });

  return h(
    "div",
    { class: "z-timeline__scroll" },
    h(
      "div",
      {
        class: "z-timeline__grid",
        role: "treegrid",
        "aria-label": labels.task,
        "aria-rowcount": rows.length + 1,
        "aria-readonly": input.editable ? undefined : "true",
        s: { "--z-tl-cols": columns.length, "--z-tl-col": `${col}px`, "--z-tl-row": `${TIMELINE_ROW}px` },
      },
      h(
        "div",
        { class: "z-timeline__row z-timeline__head", role: "row", "aria-rowindex": 1 },
        h("div", { class: "z-timeline__corner", role: "columnheader" }, labels.task),
        h("div", { class: "z-timeline__scale", role: "columnheader", "data-scale": scale }, ...scaleHeader(columns, scale, input)),
      ),
      h(
        "div",
        { class: "z-timeline__body" },
        scale === "day"
          ? h(
              "div",
              { class: "z-timeline__shade", "aria-hidden": "true" },
              ...columns.map((c, i) => (weekend.has(parse(c.date).getUTCDay()) ? h("span", { key: c.date, s: { "--z-tl-at": i } }) : null)),
            )
          : null,
        ...rowNodes,
        h(
          "svg",
          {
            class: "z-timeline__deps",
            "aria-hidden": "true",
            width,
            height,
            viewBox: `0 0 ${width} ${height}`,
            focusable: "false",
          },
          h(
            "defs",
            null,
            h(
              "marker",
              { id: `${uid}-arrow`, viewBox: "0 0 8 8", refX: 7, refY: 4, markerWidth: 7, markerHeight: 7, orient: "auto" },
              h("path", { d: "M0 0 L8 4 L0 8 z" }),
            ),
            h(
              "marker",
              {
                id: `${uid}-arrow-critical`,
                class: "z-timeline__marker-critical",
                viewBox: "0 0 8 8",
                refX: 7,
                refY: 4,
                markerWidth: 7,
                markerHeight: 7,
                orient: "auto",
              },
              h("path", { d: "M0 0 L8 4 L0 8 z" }),
            ),
          ),
          ...deps,
        ),
        todayAt !== null
          ? h("div", { class: "z-timeline__today", "aria-hidden": "true", s: { "--z-tl-at": todayAt + (scale === "day" ? 0.5 : 0) } })
          : null,
      ),
    ),
  );
}

/* ---------- Recursos ---------- */

export interface ResourceRow {
  id: string;
  title: string;
  meta?: string;
}

export interface ResourceItem {
  key: string;
  resourceId: string;
  /** Minutos del día (en la zona de presentación). */
  start: number;
  end: number;
}

export interface ResourceTimelineInput {
  uid: string;
  resources: ResourceRow[];
  items: ResourceItem[];
  /** Minutos del día visibles. */
  dayStart: number;
  dayEnd: number;
  /** Minuto de ahora (si es hoy). */
  now: number | null;
  locale?: string;
  /** Desplazamiento y alto visibles (ventana virtual). Sin ellos se pintan todas las filas. */
  scroll?: { top: number; height: number } | null;
  /** Selección al crear arrastrando. */
  creating?: { resourceId: string; start: number; end: number } | null;
  labels: { resource: string; overlaps: string; newBooking: string };
  /** Pinta una reserva: recibe sus variables de posición y si choca con otra. */
  renderItem: (
    item: ResourceItem,
    layout: { s: Record<string, string | number>; conflict: boolean; half: "top" | "bottom" | null },
  ) => VNode;
  /** Pinta la cabecera de una fila (por defecto, título y meta). */
  renderLabel?: (row: ResourceRow) => VNode[];
  /** Capas extra sobre las pistas (sugerencia de buscar hueco). */
  overlay?: VNode;
}

const hourLabel = (m: number, locale?: string) => fmt(locale, { hour: "2-digit", minute: "2-digit" }).format(m * 60_000);

/** Reservas que chocan dentro de cada recurso (para la marca de conflicto y el reparto en mitades). */
export function conflicts(items: ResourceItem[]): Map<string, "top" | "bottom"> {
  const out = new Map<string, "top" | "bottom">();
  const byRow = new Map<string, ResourceItem[]>();
  for (const it of items) byRow.set(it.resourceId, [...(byRow.get(it.resourceId) ?? []), it]);
  for (const list of byRow.values()) {
    const sorted = [...list].sort((a, b) => a.start - b.start || b.end - a.end);
    for (let i = 0; i < sorted.length; i++)
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i]!;
        const b = sorted[j]!;
        if (b.start >= a.end) break;
        if (!out.has(a.key)) out.set(a.key, "top");
        out.set(b.key, out.get(a.key) === "top" ? "bottom" : "top");
      }
  }
  return out;
}

export function resourceTimeline(input: ResourceTimelineInput): VEl {
  const { locale, labels } = input;
  const hours: number[] = [];
  for (let m = Math.ceil(input.dayStart / 60) * 60; m < input.dayEnd; m += 60) hours.push(m);
  const span = (input.dayEnd - input.dayStart) / 60;
  const at = (m: number) => (m - input.dayStart) / 60;
  const clash = conflicts(input.items);
  const count = input.resources.length;
  const win = input.scroll
    ? virtualWindow({ count, size: RESOURCE_ROW, scroll: input.scroll.top, viewport: input.scroll.height, overscan: 4 })
    : { start: 0, end: count, before: 0, after: 0, total: count * RESOURCE_ROW };
  const byRow = new Map<string, ResourceItem[]>();
  for (const it of input.items) byRow.set(it.resourceId, [...(byRow.get(it.resourceId) ?? []), it]);
  const rows = input.resources.slice(win.start, win.end).map((r, i) =>
    h(
      "div",
      { key: r.id, class: "z-timeline__row", role: "row", "aria-rowindex": win.start + i + 2, "data-resource": r.id },
      h(
        "div",
        { class: "z-timeline__label", role: "rowheader" },
        ...(input.renderLabel?.(r) ?? [
          h("span", { class: "z-timeline__avatar", "aria-hidden": "true" }, icon("building-office", 14)),
          h(
            "span",
            { class: "z-timeline__meta" },
            h("span", { class: "z-timeline__name" }, r.title),
            r.meta ? h("small", null, r.meta) : null,
          ),
        ]),
      ),
      h(
        "div",
        { class: "z-timeline__track", role: "gridcell", "data-resource": r.id },
        ...(byRow.get(r.id) ?? [])
          .filter((it) => it.end > input.dayStart && it.start < input.dayEnd)
          .sort((a, b) => a.start - b.start)
          .map((it) => {
            const from = at(Math.max(it.start, input.dayStart));
            const to = at(Math.min(it.end, input.dayEnd));
            const half = clash.get(it.key) ?? null;
            return input.renderItem(it, {
              s: { "--z-tl-from": from, "--z-tl-span": Math.max(0.05, to - from) },
              conflict: Boolean(half),
              half,
            });
          }),
        input.creating?.resourceId === r.id
          ? h(
              "div",
              {
                class: "z-timeline__create",
                "aria-hidden": "true",
                s: { "--z-tl-from": at(input.creating.start), "--z-tl-span": (input.creating.end - input.creating.start) / 60 },
              },
              h("strong", null, labels.newBooking),
              h("span", null, `${hourLabel(input.creating.start, locale)} – ${hourLabel(input.creating.end, locale)}`),
            )
          : null,
      ),
    ),
  );
  return h(
    "div",
    { class: "z-timeline__scroll", "data-virtual": on(Boolean(input.scroll)) },
    h(
      "div",
      {
        class: "z-timeline__grid",
        role: "grid",
        "aria-label": labels.resource,
        "aria-rowcount": count + 1,
        s: { "--z-tl-cols": span, "--z-tl-col": `${RESOURCE_HOUR}px`, "--z-tl-row": `${RESOURCE_ROW}px`, "--z-tl-sub": 2 },
      },
      h(
        "div",
        { class: "z-timeline__row z-timeline__head", role: "row", "aria-rowindex": 1 },
        h("div", { class: "z-timeline__corner", role: "columnheader" }, labels.resource),
        h(
          "div",
          { class: "z-timeline__scale", role: "columnheader", "data-scale": "hour" },
          ...hours.map((m) =>
            h(
              "span",
              { key: `h${m}`, class: "z-timeline__unit z-timeline__unit--hour", s: { "--z-tl-at": at(m), "--z-tl-span": 1 } },
              hourLabel(m, locale),
            ),
          ),
        ),
      ),
      h(
        "div",
        { class: "z-timeline__body" },
        win.before ? h("div", { class: "z-timeline__spacer", "aria-hidden": "true", s: { "--z-tl-space": `${win.before}px` } }) : null,
        ...rows,
        win.after ? h("div", { class: "z-timeline__spacer", "aria-hidden": "true", s: { "--z-tl-space": `${win.after}px` } }) : null,
        input.overlay ?? null,
        input.now !== null && input.now >= input.dayStart && input.now <= input.dayEnd
          ? h("div", { class: "z-timeline__today z-timeline__now", "aria-hidden": "true", s: { "--z-tl-at": at(input.now) } })
          : null,
      ),
    ),
  );
}
