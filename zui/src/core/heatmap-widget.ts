// CalendarHeatmap (mapa de calor / contribuciones) como pieza (core/widget): rejilla por semanas con 5 niveles y
// leyenda, nombre accesible por celda («14 contributions on Thursday, 12 November»), etiqueta visible al enfocar o
// pasar, tabla alternativa («View as table») y variante por tamaño (`encoding="size"`): el nivel no depende solo del
// color. Sin documento al importar.

import { addDays, addMonths, diffDays, localeWeekInfo, parse, startOfWeek, todayISO, valid } from "./date";
import { busiestWeekday, heatmapLevel, heatmapThresholds, heatmapTotal, heatmapWeeks, monthStarts, streaks } from "./heatmap";
import { fill, fmt, h, icon, on } from "./vnode";
import { num, yes, type Widget } from "./widget";

export interface HeatmapLabels {
  /** «{n} contributions» y «1 contribution». */
  value: string;
  valueOne: string;
  none: string;
  /** «{value} on {date}». */
  cell: string;
  less: string;
  more: string;
  viewAsTable: string;
  viewAsGrid: string;
  date: string;
  count: string;
  longest: string;
  current: string;
  busiest: string;
  /** «Level {n} of 4». */
  level: string;
}

export const HEATMAP_LABELS: HeatmapLabels = {
  value: "{n} contributions",
  valueOne: "1 contribution",
  none: "No contributions",
  cell: "{value} on {date}",
  less: "Less",
  more: "More",
  viewAsTable: "View as table",
  viewAsGrid: "View as grid",
  date: "Date",
  count: "Contributions",
  longest: "longest streak (days)",
  current: "current streak",
  busiest: "busiest weekday",
  level: "Level {n} of 4",
};

export interface CalendarHeatmapProps {
  values?: Record<string, number>;
  /** Rango `{ from, to }` (incluidos). Por defecto, las 53 semanas que acaban hoy. */
  range?: { from: string; to: string };
  /** Umbrales de los niveles 1–4 (por defecto, cuantiles de los valores). */
  levels?: number[];
  encoding?: "color" | "size";
  /** Título visible (y nombre de la rejilla). */
  title?: string;
  showStats?: boolean;
  showLegend?: boolean;
  /** Tabla alternativa en vez de la rejilla (también con el botón «View as table»). */
  defaultView?: "grid" | "table";
  /** Filo en todo día con actividad (como `prefers-contrast: more`). */
  outline?: boolean;
  locale?: string;
  weekStartsOn?: number;
  today?: string;
  labels?: Partial<HeatmapLabels>;
}

export interface HeatmapConfig {
  values: Record<string, number>;
  from: string;
  to: string;
  levels: number[] | null;
  encoding: "color" | "size";
  title: string;
  showStats: boolean;
  showLegend: boolean;
  defaultView: "grid" | "table";
  outline: boolean;
  locale?: string;
  weekStart: number;
  today: string;
  labels: HeatmapLabels;
}

export interface HeatmapState {
  view: "grid" | "table";
  focus: string | null;
  /** Día bajo el puntero (etiqueta visible). */
  hover: string | null;
  /** La etiqueta se ve: el foco llegó con el teclado o el puntero está encima. */
  tip: boolean;
}

/** La fecha ISO anterior de dos (se comparan como texto). */
const earlier = (a: string, b: string) => [a, b].sort()[0]!;

function numberFormat(locale?: string): Intl.NumberFormat {
  try {
    return new Intl.NumberFormat(locale);
  } catch {
    return new Intl.NumberFormat();
  }
}

export const heatmapWidget: Widget<CalendarHeatmapProps, HeatmapConfig, HeatmapState> = {
  root: "z-heatmap",
  configure(p) {
    const today = valid(p.today) ? p.today : todayISO();
    const ws = (((p.weekStartsOn ?? localeWeekInfo(p.locale).firstDay) % 7) + 7) % 7;
    const range =
      p.range && valid(p.range.from) && valid(p.range.to) ? p.range : { from: startOfWeek(addDays(today, -364), ws), to: today };
    return {
      values: p.values ?? {},
      from: range.from,
      to: range.to,
      levels: p.levels?.length === 4 ? [...p.levels].sort((a, b) => a - b) : null,
      encoding: p.encoding === "size" ? "size" : "color",
      title: p.title ?? "",
      showStats: p.showStats !== false,
      showLegend: p.showLegend !== false,
      defaultView: p.defaultView === "table" ? "table" : "grid",
      outline: Boolean(p.outline),
      locale: p.locale,
      weekStart: ws,
      today,
      labels: { ...HEATMAP_LABELS, ...p.labels },
    };
  },
  initial(config) {
    return { view: config.defaultView, focus: null, hover: null, tip: false };
  },
  tree(config, state, uid) {
    const { labels, locale, values } = config;
    const weeks = heatmapWeeks(config.from, config.to, config.weekStart);
    const inRange = Object.entries(values)
      .filter(([d]) => d >= config.from && d <= config.to)
      .map(([, v]) => v);
    const thresholds = config.levels ?? heatmapThresholds(inRange, 4);
    const dayName = fmt(locale, { weekday: "long", day: "numeric", month: "long" });
    const number = numberFormat(locale);
    const valueText = (v: number) => (v === 1 ? labels.valueOne : v > 0 ? fill(labels.value, { n: number.format(v) }) : labels.none);
    const cellText = (d: string) => fill(labels.cell, { value: valueText(values[d] ?? 0), date: dayName.format(parse(d)) });
    const lastPast = earlier(config.today, config.to);
    const focus = state.focus && state.focus >= config.from && state.focus <= lastPast ? state.focus : lastPast;
    const tipDay = state.tip ? (state.hover ?? focus) : null;
    const titleId = `${uid}-title`;
    const weekdays = Array.from({ length: 7 }, (_, r) => addDays(startOfWeek("2026-11-16", config.weekStart), r));
    const stats = streaks(values, config.today);
    const busiest = busiestWeekday(Object.fromEntries(Object.entries(values).filter(([d]) => d >= config.from && d <= config.to)));
    const total = heatmapTotal(values, config.from, config.to);
    const grid = h(
      "div",
      { class: "z-heatmap__scroll" },
      h(
        "div",
        { class: "z-heatmap__body", s: { "--z-hm-weeks": weeks.length } },
        h(
          "div",
          { class: "z-heatmap__months", "aria-hidden": "true" },
          ...monthStarts(weeks).map((m) =>
            h("span", { key: m.month, s: { "--z-hm-col": m.column + 2 } }, fmt(locale, { month: "short" }).format(parse(`${m.month}-01`))),
          ),
        ),
        h(
          "div",
          {
            class: "z-heatmap__grid",
            role: "grid",
            "aria-labelledby": config.title ? titleId : undefined,
            "aria-label": config.title ? undefined : labels.count,
            "aria-readonly": "true",
          },
          ...weekdays.map((wd, r) =>
            h(
              "div",
              { key: `r${r}`, class: "z-heatmap__row", role: "row" },
              h(
                "span",
                { class: "z-heatmap__weekday", role: "rowheader", "aria-label": fmt(locale, { weekday: "long" }).format(parse(wd)) },
                h("span", { "aria-hidden": "true" }, r % 2 === 0 ? fmt(locale, { weekday: "short" }).format(parse(wd)) : ""),
              ),
              ...weeks.map((week, c) => {
                const d = week[r];
                if (!d) return h("span", { key: `c${c}`, class: "z-heatmap__cell", "data-pad": "", role: "presentation" });
                const future = d > config.today;
                const level = future ? 0 : heatmapLevel(values[d], thresholds);
                return h(
                  "span",
                  {
                    key: d,
                    class: "z-heatmap__cell",
                    role: "gridcell",
                    "data-date": d,
                    "data-focus-id": `d:${d}`,
                    "data-level": level,
                    "data-future": on(future),
                    "data-today": on(d === config.today),
                    "aria-current": d === config.today ? "date" : undefined,
                    "aria-label": future ? dayName.format(parse(d)) : cellText(d),
                    "aria-disabled": future ? "true" : undefined,
                    tabindex: d === focus ? 0 : -1,
                  },
                  d === tipDay && !future
                    ? h(
                        "span",
                        {
                          class: "z-heatmap__tip",
                          "aria-hidden": "true",
                          "data-edge": c > weeks.length - 8 ? "end" : c < 6 ? "start" : undefined,
                        },
                        h("b", null, valueText(values[d] ?? 0)),
                        ` · ${dayName.format(parse(d))}`,
                      )
                    : null,
                );
              }),
            ),
          ),
        ),
      ),
    );
    const table = h(
      "div",
      { class: "z-heatmap__table-wrap", role: "region", tabindex: 0, "aria-labelledby": `${uid}-caption` },
      h(
        "table",
        { class: "z-heatmap__table" },
        h("caption", { id: `${uid}-caption` }, config.title || labels.count),
        h("thead", null, h("tr", null, h("th", { scope: "col" }, labels.date), h("th", { scope: "col" }, labels.count))),
        h(
          "tbody",
          null,
          ...Array.from({ length: Math.max(0, diffDays(config.from, lastPast) + 1) }, (_, i) => addDays(config.from, i)).map((d) =>
            h(
              "tr",
              { key: d, "data-level": heatmapLevel(values[d], thresholds) },
              h("th", { scope: "row" }, fmt(locale, { dateStyle: "medium" }).format(parse(d))),
              h("td", null, number.format(values[d] ?? 0)),
            ),
          ),
        ),
      ),
    );
    const legend = config.showLegend
      ? h(
          "div",
          { class: "z-heatmap__legend" },
          h("span", null, labels.less),
          ...[0, 1, 2, 3, 4].map((l) =>
            h("span", {
              key: `l${l}`,
              class: "z-heatmap__cell z-heatmap__swatch",
              "data-level": l,
              role: "img",
              "aria-label": fill(labels.level, { n: l }),
            }),
          ),
          h("span", null, labels.more),
        )
      : null;
    return h(
      "div",
      {
        class: "z-heatmap z-liquid",
        "data-encoding": config.encoding,
        "data-outline": on(config.outline),
        "data-view": state.view,
      },
      h(
        "div",
        { class: "z-heatmap__head" },
        config.title ? h("h3", { class: "z-heatmap__title", id: titleId }, config.title) : null,
        h(
          "button",
          { type: "button", class: "z-heatmap__toggle", "aria-pressed": state.view === "table" ? "true" : "false" },
          icon("table-cells", 16),
          labels.viewAsTable,
        ),
      ),
      state.view === "table" ? table : grid,
      config.showStats || legend
        ? h(
            "div",
            { class: "z-heatmap__foot" },
            config.showStats
              ? h(
                  "dl",
                  { class: "z-heatmap__stats" },
                  h("div", null, h("dt", null, labels.longest), h("dd", null, String(stats.longest))),
                  h("div", null, h("dt", null, labels.current), h("dd", null, String(stats.current))),
                  busiest !== null
                    ? h(
                        "div",
                        null,
                        h("dt", null, labels.busiest),
                        h("dd", null, fmt(locale, { weekday: "short" }).format(parse(addDays("2026-11-15", busiest)))),
                      )
                    : null,
                  h("div", { class: "z-sr-only" }, h("dt", null, labels.count), h("dd", null, String(total))),
                )
              : null,
            legend,
          )
        : null,
    );
  },
  attach(root, host) {
    const abort = new AbortController();
    const signal = abort.signal;
    root.addEventListener(
      "click",
      (event) => {
        const target = event.target as HTMLElement;
        if (target.closest(".z-heatmap__toggle")) {
          const view = host.state().view === "table" ? "grid" : "table";
          host.update({ view });
          host.emit("view-change", { view });
          return;
        }
        const cell = target.closest<HTMLElement>(".z-heatmap__cell[data-date]");
        if (cell && !cell.dataset.future) {
          host.update({ focus: cell.dataset.date!, tip: true }, true);
          host.emit("day-click", { date: cell.dataset.date, value: host.config().values[cell.dataset.date!] ?? 0 });
        }
      },
      { signal },
    );
    root.addEventListener(
      "keydown",
      (event) => {
        const cell = (event.target as HTMLElement).closest<HTMLElement>(".z-heatmap__cell[data-date]");
        if (!cell) return;
        const date = cell.dataset.date!;
        const c = host.config();
        const rtl = root.closest("[dir]")?.getAttribute("dir") === "rtl";
        const key = rtl && event.key === "ArrowLeft" ? "ArrowRight" : rtl && event.key === "ArrowRight" ? "ArrowLeft" : event.key;
        let next: string | null = null;
        if (key === "ArrowUp") next = addDays(date, -1);
        else if (key === "ArrowDown") next = addDays(date, 1);
        else if (key === "ArrowLeft") next = addDays(date, -7);
        else if (key === "ArrowRight") next = addDays(date, 7);
        else if (key === "PageUp") next = addMonths(date, -1);
        else if (key === "PageDown") next = addMonths(date, 1);
        else if (key === "Home") next = c.from;
        else if (key === "End") next = earlier(c.today, c.to);
        else if (key === "Enter" || key === " ") {
          event.preventDefault();
          host.emit("day-click", { date, value: c.values[date] ?? 0 });
          return;
        } else return;
        const last = earlier(c.today, c.to);
        next = next < c.from ? c.from : next > last ? last : next;
        event.preventDefault();
        if (next !== date) host.update({ focus: next, hover: null, tip: true }, true);
      },
      { signal },
    );
    root.addEventListener(
      "focusin",
      (event) => {
        const cell = (event.target as HTMLElement).closest<HTMLElement>(".z-heatmap__cell[data-date]");
        if (cell && (host.state().focus !== cell.dataset.date || !host.state().tip)) host.update({ focus: cell.dataset.date!, tip: true });
      },
      { signal },
    );
    root.addEventListener(
      "focusout",
      (event) => {
        if (!root.contains(event.relatedTarget as Node | null) && host.state().tip && !host.state().hover) host.update({ tip: false });
      },
      { signal },
    );
    root.addEventListener(
      "pointerover",
      (event) => {
        const cell = (event.target as HTMLElement).closest<HTMLElement>(".z-heatmap__cell[data-date]");
        const date = cell && !cell.dataset.future ? cell.dataset.date! : null;
        if (date !== host.state().hover)
          host.update({ hover: date, tip: Boolean(date) || root.contains(root.ownerDocument.activeElement) });
      },
      { signal },
    );
    root.addEventListener(
      "pointerleave",
      () => {
        if (host.state().hover) host.update({ hover: null, tip: root.contains(root.ownerDocument.activeElement) });
      },
      { signal },
    );
    return () => abort.abort();
  },
  fromDom(el, json) {
    const d = el.dataset;
    return {
      values: json.values as Record<string, number> | undefined,
      range: d.from && d.to ? { from: d.from, to: d.to } : undefined,
      levels: json.levels as number[] | undefined,
      encoding: d.encoding === "size" ? "size" : "color",
      title: d.title,
      showStats: d.stats !== "false",
      showLegend: d.legend !== "false",
      defaultView: d.view === "table" ? "table" : "grid",
      outline: yes(d.outline),
      locale: d.locale,
      weekStartsOn: d.weekStart !== undefined ? num(d.weekStart, 1) : undefined,
      today: d.today,
      labels: json.labels as Partial<HeatmapLabels> | undefined,
    };
  },
};
