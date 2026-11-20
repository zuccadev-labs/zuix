// Gráficos de líneas, áreas, barras y anillo como pieza (core/widget): un solo árbol para React y para el modo DOM.
// Marcas de línea y área en SVG (viewBox 100 × 100 sin conservar la proporción, trazos que no escalan) y barras,
// puntos, ejes, cruceta y tooltip en HTML colocado por fracciones: nada se mide, así que el marcado del servidor ya es
// el definitivo y el gráfico se adapta a su contenedor (consultas de contenedor). Accesible: `figure` + `figcaption`,
// resumen para lectores de pantalla, un punto enfocable por posición del eje (flechas, Inicio/Fin) con su nombre
// completo, leyenda que oculta series, tabla de datos alternativa y marcas o tramas además del color. Sin documento
// al importar.

import {
  arcCentroid,
  arcPath,
  axisNumberOptions,
  bandScale,
  type Curve,
  extent,
  hitEdges,
  indexAt,
  linePath,
  areaPath,
  niceTicks,
  numberFormat,
  pieLayout,
  type Point,
  r3,
  stack,
  timeGrain,
  timePointFormat,
  timeTickFormat,
  timeTicks,
  toTime,
} from "./chart";
import { fill, fmt, h, icon, on, type VEl, type VNode } from "./vnode";
import { list, num, yes, type Widget, type WidgetHost } from "./widget";

export type ChartType = "line" | "area" | "bar" | "donut" | "pie";
export type ChartMarker = "circle" | "square" | "diamond" | "triangle";
export const CHART_COLORS = 8;
const MARKERS: ChartMarker[] = ["circle", "square", "diamond", "triangle"];

export interface ChartSeries {
  /** Clave del valor en cada fila de `data`. */
  key: string;
  label: string;
  /** Color de serie 1–8 (`--z-chart-N`). Por defecto, su posición en `series`: el color sigue a la serie. */
  color?: number;
  /** Forma del marcador (con `markers`). Por defecto, una por posición. */
  marker?: ChartMarker;
}

export interface ChartLabels {
  viewAsTable: string;
  /** Nombre del grupo de la leyenda. */
  legend: string;
  /** Instrucciones de teclado (descripción del área de trazado). */
  keyboard: string;
  /** «{x}: {values}»: nombre de cada posición del eje. */
  point: string;
  /** «{series} {value}». */
  value: string;
  missing: string;
  total: string;
  /** «{type}, {count} series: {names}. {points} points from {first} to {last}.» */
  summary: string;
  /** «{series}: from {min} to {max}.» */
  range: string;
  /** «{label}: {value} ({percent})» en el anillo. */
  slice: string;
  noData: string;
  types: Record<ChartType, string>;
}

export const CHART_LABELS: ChartLabels = {
  viewAsTable: "View as table",
  legend: "Series",
  keyboard: "Use the arrow keys to move between points.",
  point: "{x}: {values}",
  value: "{series} {value}",
  missing: "no data",
  total: "Total",
  summary: "{type}, {count} series: {names}. {points} points from {first} to {last}.",
  range: "{series}: from {min} to {max}.",
  slice: "{label}: {value} ({percent})",
  noData: "No data",
  types: { line: "Line chart", area: "Area chart", bar: "Bar chart", donut: "Donut chart", pie: "Pie chart" },
};

export interface ChartProps {
  type?: ChartType;
  data?: ReadonlyArray<Record<string, unknown>>;
  /** Clave de la categoría o del tiempo en cada fila. */
  xKey?: string;
  /** Nombre del eje de categorías o tiempo (cabecera de la tabla alternativa). Por defecto, `xKey`. */
  xLabel?: string;
  series?: ReadonlyArray<ChartSeries>;
  /** Tipo del eje horizontal. Por defecto, `time` si todos los valores son fechas (Date, ISO o ms) y `category` si no. */
  xType?: "category" | "time" | "number";
  title?: string;
  /** Texto visible bajo el título (también describe el gráfico). */
  description?: string;
  /** Resumen para lectores de pantalla. Por defecto se compone de los datos. */
  summary?: string;
  stacked?: boolean;
  orientation?: "vertical" | "horizontal";
  curve?: Curve;
  /** Marcador con forma propia por serie en cada punto (no depender solo del color). */
  markers?: boolean;
  /** Trazo discontinuo o trama por serie (también con colores forzados y al imprimir). */
  patterns?: boolean;
  yMin?: number;
  yMax?: number;
  /** Divisiones aproximadas del eje de valores. */
  yTicks?: number;
  valueFormat?: Intl.NumberFormatOptions;
  /** Formato de los rótulos de tiempo (por defecto, según la escala). */
  xFormat?: Intl.DateTimeFormatOptions;
  locale?: string;
  grid?: boolean;
  /** Leyenda (por defecto, con dos o más series). */
  legend?: boolean;
  tooltip?: boolean;
  /** Alto del área de trazado en px. */
  height?: number;
  defaultView?: "chart" | "table";
  /** Claves de series ocultas (controlado). */
  hidden?: readonly string[];
  defaultHidden?: readonly string[];
  /** Animación de entrada (siempre sin movimiento con `prefers-reduced-motion`). */
  animate?: boolean;
  /** Panel de cristal con relleno (por defecto). `false` para meterlo en una tarjeta propia. */
  framed?: boolean;
  /** Anillo: texto bajo el valor central (por defecto, «Total»). */
  centerLabel?: string;
  /** Anillo: valor central (por defecto, el total formateado). */
  centerValue?: string;
  labels?: Partial<ChartLabels>;
}

export interface ChartConfig {
  type: ChartType;
  data: ReadonlyArray<Record<string, unknown>>;
  xKey: string;
  xLabel: string;
  series: ChartSeries[];
  xType: "category" | "time" | "number";
  title: string;
  description: string;
  summary: string;
  stacked: boolean;
  orientation: "vertical" | "horizontal";
  curve: Curve;
  markers: boolean;
  patterns: boolean;
  yMin?: number;
  yMax?: number;
  yTicks: number;
  valueFormat: Intl.NumberFormatOptions;
  xFormat?: Intl.DateTimeFormatOptions;
  locale?: string;
  grid: boolean;
  legend: boolean;
  tooltip: boolean;
  height?: number;
  defaultView: "chart" | "table";
  hidden?: string[];
  defaultHidden: string[];
  animate: boolean;
  framed: boolean;
  centerLabel?: string;
  centerValue?: string;
  labels: ChartLabels;
}

export interface ChartState {
  view: "chart" | "table";
  /** Posición del eje (o sector) activa: la enfocable y la del tooltip. */
  active: number | null;
  /** El tooltip se ve (puntero encima o foco dentro). */
  tip: boolean;
  hidden: string[];
}

const TYPES: ChartType[] = ["line", "area", "bar", "donut", "pie"];
const round = (v: number) => (Number.isFinite(v) ? v : 0);
const isRound = (t: ChartType) => t === "donut" || t === "pie";
const value = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? n : null;
};
const colorOf = (s: ChartSeries, i: number) => {
  const c = Math.round(s.color ?? i + 1);
  return ((((c - 1) % CHART_COLORS) + CHART_COLORS) % CHART_COLORS) + 1;
};
const markerOf = (s: ChartSeries, i: number): ChartMarker => s.marker ?? MARKERS[i % MARKERS.length]!;

/** Datos derivados del eje horizontal (o de categorías): posiciones, rótulos y marcas. */
interface XModel {
  /** Posición (fracción) de cada fila. */
  pos: number[];
  /** Rótulo completo de cada fila (tooltip, tabla y nombre accesible). */
  label: string[];
  ticks: Array<{ at: number; text: string; minor: boolean }>;
}

function xModel(config: ChartConfig): XModel {
  const { data, xKey, locale } = config;
  const raw = data.map((row) => row[xKey]);
  const n = raw.length;
  const bars = config.type === "bar";
  if (config.xType === "time") {
    const times = raw.map(toTime);
    const grain = timeGrain(times);
    const point = fmt(locale, config.xFormat ?? timePointFormat(grain));
    const label = times.map((t) => (Number.isFinite(t) ? point.format(new Date(t)) : String(raw[0] ?? "")));
    if (bars) return bandModel(config, label, times, grain);
    const span = extent(times) ?? [0, 1];
    const lo = span[0];
    const width = span[1] - span[0] || 1;
    const pos = times.map((t) => (n === 1 ? 0.5 : (t - lo) / width));
    const tt = timeTicks(span[0], span[1], 6);
    const tick = fmt(locale, config.xFormat ?? timeTickFormat(tt.unit, tt.every));
    const ticks = tt.ticks.map((t, i) => ({ at: (t - lo) / width, text: tick.format(new Date(t)), minor: i % 2 === 1 }));
    return { pos, label, ticks };
  }
  if (config.xType === "number" && !bars) {
    const nums = raw.map((v) => value(v) ?? Number.NaN);
    const span = extent(nums) ?? [0, 1];
    const t = niceTicks(span[0], span[1], 6);
    const f = numberFormat(locale);
    const width = span[1] - span[0] || 1;
    const pos = nums.map((v) => (n === 1 ? 0.5 : (v - span[0]) / width));
    const ticks = t.ticks
      .filter((v) => v >= span[0] - 1e-9 && v <= span[1] + 1e-9)
      .map((v, i) => ({ at: (v - span[0]) / width, text: f.format(v), minor: i % 2 === 1 }));
    return { pos, label: nums.map((v) => (Number.isFinite(v) ? f.format(v) : "")), ticks };
  }
  const label = raw.map((v) => (v instanceof Date ? fmt(locale, { dateStyle: "medium" }).format(v) : String(v ?? "")));
  if (bars) return bandModel(config, label);
  const pos = raw.map((_, i) => (n === 1 ? 0.5 : i / (n - 1)));
  const every = Math.max(1, Math.ceil(n / 12));
  const ticks = pos
    .map((at, i) => ({ at, text: label[i]!, minor: (i / every) % 2 === 1, i }))
    .filter((t) => t.i % every === 0)
    .map(({ i: _i, ...t }) => t);
  return { pos, label, ticks };
}

/** Categorías en bandas (barras): rótulo en el centro de cada banda, aclarado si hay muchas. */
function bandModel(config: ChartConfig, label: string[], times?: number[], grain?: ReturnType<typeof timeGrain>): XModel {
  const n = label.length;
  const band = bandScale(n, 0.3, 0.15);
  const pos = label.map((_, i) => band.center(i));
  const short = times && grain ? fmt(config.locale, config.xFormat ?? timeTickFormat(grain)) : null;
  const every = Math.max(1, Math.ceil(n / (config.orientation === "horizontal" ? 24 : 12)));
  const ticks = pos
    .map((at, i) => ({
      at,
      text: short && Number.isFinite(times![i]!) ? short.format(new Date(times![i]!)) : label[i]!,
      minor: (i / every) % 2 === 1,
      i,
    }))
    .filter((t) => t.i % every === 0)
    .map(({ i: _i, ...t }) => t);
  return { pos, label, ticks };
}

export const chartWidget: Widget<ChartProps, ChartConfig, ChartState> = {
  root: "z-chart",
  configure(p) {
    const type = TYPES.includes(p.type as ChartType) ? (p.type as ChartType) : "line";
    const data = Array.isArray(p.data) ? p.data : [];
    const xKey = p.xKey ?? (isRound(type) ? "label" : "x");
    const series = (Array.isArray(p.series) && p.series.length ? p.series : [{ key: isRound(type) ? "value" : "y", label: "" }]).filter(
      (s): s is ChartSeries => Boolean(s && typeof s.key === "string"),
    );
    const auto =
      data.length > 0 &&
      data.every((row) => {
        const v = row[xKey];
        return (v instanceof Date || typeof v === "string") && Number.isFinite(toTime(v));
      });
    const xType = p.xType === "time" || p.xType === "number" || p.xType === "category" ? p.xType : auto ? "time" : "category";
    const labels = { ...CHART_LABELS, ...p.labels, types: { ...CHART_LABELS.types, ...p.labels?.types } };
    return {
      type,
      data,
      xKey,
      xLabel: p.xLabel ?? xKey,
      series: series.map((s) => ({ ...s, label: s.label ?? s.key })),
      xType,
      title: p.title ?? "",
      description: p.description ?? "",
      summary: p.summary ?? "",
      stacked: Boolean(p.stacked) && (type === "bar" || type === "area"),
      orientation: p.orientation === "horizontal" && type === "bar" ? "horizontal" : "vertical",
      curve: p.curve === "monotone" || p.curve === "step" ? p.curve : "linear",
      markers: Boolean(p.markers),
      patterns: Boolean(p.patterns),
      yMin: Number.isFinite(p.yMin) ? p.yMin : undefined,
      yMax: Number.isFinite(p.yMax) ? p.yMax : undefined,
      yTicks: Math.max(2, Math.min(12, Math.round(p.yTicks ?? 5))),
      valueFormat: p.valueFormat ?? {},
      xFormat: p.xFormat,
      locale: p.locale,
      grid: p.grid !== false,
      legend: p.legend ?? (isRound(type) ? true : series.length > 1),
      tooltip: p.tooltip !== false,
      height: Number.isFinite(p.height) && (p.height ?? 0) > 0 ? p.height : undefined,
      defaultView: p.defaultView === "table" ? "table" : "chart",
      hidden: p.hidden ? [...p.hidden] : undefined,
      defaultHidden: p.defaultHidden ? [...p.defaultHidden] : [],
      animate: p.animate !== false,
      framed: p.framed !== false,
      centerLabel: p.centerLabel,
      centerValue: p.centerValue,
      labels,
    };
  },
  initial(config) {
    return { view: config.defaultView, active: null, tip: false, hidden: config.hidden ?? config.defaultHidden };
  },
  control(config, state) {
    return config.hidden && config.hidden.join("\n") !== state.hidden.join("\n") ? { ...state, hidden: config.hidden } : state;
  },
  tree(config, state, uid) {
    return isRound(config.type) ? roundTree(config, state, uid) : cartesianTree(config, state, uid);
  },
  attach(root, host) {
    return attachChart(root, host);
  },
  after(root, host, focus) {
    if (!focus) return;
    const target = root.querySelector<HTMLElement | SVGElement>('[data-index][tabindex="0"]');
    if (target && target !== root.ownerDocument.activeElement) target.focus({ preventScroll: true });
    void host;
  },
  fromDom(el, json) {
    const d = el.dataset;
    const n = (v: string | undefined) => (v !== undefined && v !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined);
    return {
      type: (d.type as ChartType) ?? undefined,
      data: Array.isArray(json.data) ? (json.data as Array<Record<string, unknown>>) : undefined,
      xKey: d.xKey ?? (json.xKey as string | undefined),
      xLabel: d.xLabel,
      series: json.series as ChartSeries[] | undefined,
      xType: (d.xType as ChartProps["xType"]) ?? undefined,
      title: d.title,
      description: d.description,
      summary: d.summary,
      stacked: yes(d.stacked),
      orientation: d.orientation === "horizontal" ? "horizontal" : "vertical",
      curve: (d.curve as Curve) ?? undefined,
      markers: yes(d.markers),
      patterns: yes(d.patterns),
      yMin: n(d.yMin),
      yMax: n(d.yMax),
      yTicks: d.yTicks !== undefined ? num(d.yTicks, 5) : undefined,
      valueFormat: json.valueFormat as Intl.NumberFormatOptions | undefined,
      xFormat: json.xFormat as Intl.DateTimeFormatOptions | undefined,
      locale: d.locale,
      grid: d.grid !== "false",
      legend: d.legend === undefined ? undefined : d.legend !== "false",
      tooltip: d.tooltip !== "false",
      height: n(d.height),
      defaultView: d.view === "table" ? "table" : "chart",
      defaultHidden: d.hidden !== undefined ? list(d.hidden) : undefined,
      animate: d.animate !== "false",
      framed: d.framed !== "false",
      centerLabel: d.centerLabel,
      centerValue: d.centerValue,
      labels: json.labels as Partial<ChartLabels> | undefined,
    };
  },
};

// —— Piezas comunes ——

function head(config: ChartConfig, state: ChartState, uid: string): VEl {
  return h(
    "figcaption",
    { key: "head", class: "z-chart__head" },
    h(
      "span",
      { class: "z-chart__heading" },
      config.title ? h("span", { class: "z-chart__title", id: `${uid}-title` }, config.title) : null,
      config.description ? h("span", { class: "z-chart__desc" }, config.description) : null,
    ),
    h(
      "button",
      { type: "button", class: "z-chart__toggle", "aria-pressed": state.view === "table" ? "true" : "false" },
      icon("table-cells", 16),
      config.labels.viewAsTable,
    ),
  );
}

function legend(
  config: ChartConfig,
  state: ChartState,
  items: Array<{ key: string; label: string; color: number; pattern: number; marker: ChartMarker; extra?: string }>,
  mark: "line" | "rect",
): VNode {
  if (!config.legend || !items.length) return null;
  const shown = items.filter((s) => !state.hidden.includes(s.key)).length;
  return h(
    "div",
    { key: "legend", class: "z-chart__legend", role: "group", "aria-label": config.labels.legend },
    ...items.map((s) => {
      const visible = !state.hidden.includes(s.key);
      return h(
        "button",
        {
          key: s.key,
          type: "button",
          class: "z-chart__key",
          "data-key": s.key,
          "aria-pressed": visible ? "true" : "false",
          // La última serie visible no se puede ocultar (el gráfico no queda vacío).
          "aria-disabled": visible && shown <= 1 ? "true" : undefined,
        },
        h("span", {
          class: "z-chart__swatch",
          "data-mark": mark,
          "data-color": s.color,
          "data-pattern": s.pattern,
          "data-marker": config.markers ? s.marker : undefined,
          "aria-hidden": "true",
        }),
        h("span", { class: "z-chart__key-label" }, s.label),
        s.extra ? h("span", { class: "z-chart__key-value" }, s.extra) : null,
      );
    }),
  );
}

function rootAttrs(config: ChartConfig, state: ChartState) {
  return {
    class: config.framed ? "z-chart z-liquid" : "z-chart",
    "data-framed": on(config.framed),
    "data-type": config.type,
    "data-orientation": config.type === "bar" ? config.orientation : undefined,
    "data-stacked": on(config.stacked),
    "data-markers": on(config.markers),
    "data-patterns": on(config.patterns),
    "data-animate": on(config.animate),
    "data-view": state.view,
    s: config.height ? { "--z-chart-height": `${config.height}px` } : undefined,
  };
}

function tableOf(
  config: ChartConfig,
  uid: string,
  header: string,
  cols: string[],
  rows: Array<{ key: string; head: string; cells: string[] }>,
) {
  return h(
    "div",
    { key: "table", class: "z-chart__table-wrap", role: "region", tabindex: 0, "aria-labelledby": `${uid}-caption` },
    h(
      "table",
      { class: "z-chart__table" },
      h("caption", { id: `${uid}-caption` }, config.title || config.labels.types[config.type]),
      h("thead", null, h("tr", null, h("th", { scope: "col" }, header), ...cols.map((c, i) => h("th", { key: `c${i}`, scope: "col" }, c)))),
      h(
        "tbody",
        null,
        ...rows.map((r) =>
          h("tr", { key: r.key }, h("th", { scope: "row" }, r.head), ...r.cells.map((c, i) => h("td", { key: `v${i}` }, c))),
        ),
      ),
    ),
  );
}

// —— Líneas, áreas y barras ——

function cartesianTree(config: ChartConfig, state: ChartState, uid: string): VEl {
  const { labels, data, type, locale } = config;
  const n = data.length;
  const bars = type === "bar";
  const horizontal = bars && config.orientation === "horizontal";
  const all = config.series.map((s, i) => ({
    ...s,
    index: i,
    color: colorOf(s, i),
    pattern: i % 4,
    marker: markerOf(s, i),
    values: data.map((row) => value(row[s.key])),
  }));
  const visible = all.filter((s) => !state.hidden.includes(s.key));
  const x = xModel(config);
  const stacked = config.stacked ? stack(visible.map((s) => s.values)) : null;
  const span = stacked ? extent(stacked.flatMap((rows) => rows.flatMap(([a, b]) => [a, b]))) : extent(visible.flatMap((s) => s.values));
  const zero = bars || type === "area";
  const yt = niceTicks(config.yMin ?? span?.[0] ?? 0, config.yMax ?? span?.[1] ?? 1, config.yTicks, zero);
  const ylo = config.yMin ?? yt.min;
  const yhi = config.yMax ?? yt.max;
  const yf = (v: number) => (v - ylo) / (yhi - ylo || 1); // fracción desde la base
  const yticks = yt.ticks.filter((t) => t >= ylo - 1e-9 && t <= yhi + 1e-9);
  const valueFmt = numberFormat(locale, config.valueFormat);
  const axisFmt = numberFormat(locale, axisNumberOptions(config.valueFormat, Math.max(Math.abs(ylo), Math.abs(yhi))));
  const fmtValue = (v: number | null) => (v === null ? labels.missing : valueFmt.format(v));
  const active = state.active !== null && state.active >= 0 && state.active < n ? state.active : null;
  const focusIndex = active ?? (n ? 0 : null);
  const base = Math.min(Math.max(yf(0), 0), 1);

  // Nombre de cada posición: «Mar 2026: Revenue 1,200, Costs 800, Total 2,000».
  const pointName = (i: number) => {
    const parts = visible.map((s) => fill(labels.value, { series: s.label, value: fmtValue(s.values[i] ?? null) }));
    if (config.stacked && visible.length > 1)
      parts.push(fill(labels.value, { series: labels.total, value: valueFmt.format(visible.reduce((a, s) => a + (s.values[i] ?? 0), 0)) }));
    return fill(labels.point, { x: x.label[i] ?? "", values: parts.join(", ") });
  };

  const band = bandScale(n, 0.3, 0.15);
  // Marcas SVG (líneas y áreas) en un viewBox 100 × 100: y crece hacia abajo.
  const svgY = (f: number) => r3((1 - f) * 100);
  const marks: VNode[] = [];
  const dots: VNode[] = [];
  const barNodes: VNode[] = [];
  if (!bars) {
    for (let k = 0; k < visible.length; k++) {
      const s = visible[k]!;
      const top: Point[] = s.values.map((v, i) => {
        const yv = stacked ? stacked[k]![i]![1] : v;
        return v === null || yv === null ? null : [r3(x.pos[i]! * 100), svgY(yf(yv))];
      });
      if (type === "area") {
        const bottom: Point[] = s.values.map((_, i) => [r3(x.pos[i]! * 100), stacked ? svgY(yf(stacked[k]![i]![0])) : svgY(base)]);
        marks.push(
          h("path", {
            key: `a:${s.key}`,
            class: "z-chart__area",
            d: areaPath(top, bottom, config.curve),
            "data-color": s.color,
            "data-pattern": s.pattern,
          }),
        );
      }
      marks.push(
        h("path", {
          key: `l:${s.key}`,
          class: "z-chart__line",
          d: linePath(top, config.curve),
          "data-color": s.color,
          "data-pattern": s.pattern,
        }),
      );
      // Marcadores: todos con `markers` (hasta 60 posiciones), y siempre los de la posición activa.
      s.values.forEach((v, i) => {
        if (v === null) return;
        const show = (config.markers && n <= 60) || (state.tip && i === active) || n === 1;
        if (!show) return;
        const yv = stacked ? stacked[k]![i]![1] : v;
        dots.push(
          h("span", {
            key: `d:${s.key}:${i}`,
            class: "z-chart__dot",
            "data-color": s.color,
            "data-marker": config.markers ? s.marker : "circle",
            "data-active": on(state.tip && i === active),
            "aria-hidden": "true",
            s: { "--x": r3(x.pos[i]!), "--y": r3(yf(yv)) },
          }),
        );
      });
    }
  } else {
    const groups = config.stacked ? 1 : Math.max(1, visible.length);
    const sub = band.bandwidth / groups;
    visible.forEach((s, k) => {
      s.values.forEach((v, i) => {
        if (v === null) return;
        const [lo, hi] = stacked ? stacked[k]![i]! : v >= 0 ? [0, v] : [v, 0];
        const a = Math.min(Math.max(yf(Math.min(lo, hi)), 0), 1);
        const b = Math.min(Math.max(yf(Math.max(lo, hi)), 0), 1);
        const center = config.stacked ? band.center(i) : band.start(i) + sub * (k + 0.5);
        // Extremo redondeado: el de la punta del dato (el último del apilado en cada sentido).
        const negative = v < 0;
        const cap =
          !stacked ||
          visible.slice(k + 1).every((o) => {
            const ov = o.values[i];
            return ov === null || ov === undefined || ov === 0 || Math.sign(ov) !== Math.sign(v);
          });
        const under = Boolean(stacked) && (negative ? hi < 0 : lo > 0);
        barNodes.push(
          h("span", {
            key: `b:${s.key}:${i}`,
            class: "z-chart__bar",
            "data-color": s.color,
            "data-pattern": s.pattern,
            "data-negative": on(negative),
            "data-cap": on(cap && v !== 0),
            "data-under": on(under),
            "data-active": on(state.tip && i === active),
            "aria-hidden": "true",
            s: {
              "--x": r3(horizontal ? 1 - center : center),
              "--w": r3(config.stacked ? band.bandwidth : sub),
              "--y0": r3(a),
              "--y1": r3(b),
            },
          }),
        );
      });
    });
  }

  // Cuadrícula y base (SVG, trazo de 1 px que no escala).
  const gridPath = config.grid ? yticks.map((t) => (horizontal ? `M${r3(yf(t) * 100)} 0V100` : `M0 ${svgY(yf(t))}H100`)).join("") : "";
  const showBase = zero && base > 0 && base < 1;
  const svg = h(
    "svg",
    { key: "svg", class: "z-chart__svg", viewBox: "0 0 100 100", preserveAspectRatio: "none", "aria-hidden": "true", focusable: "false" },
    gridPath ? h("path", { key: "grid", class: "z-chart__grid", d: gridPath }) : null,
    showBase
      ? h("path", { key: "base", class: "z-chart__base", d: horizontal ? `M${r3(base * 100)} 0V100` : `M0 ${svgY(base)}H100` })
      : null,
    h("g", { key: "marks", class: "z-chart__marks" }, ...marks),
  );

  // Zonas activas: una por posición del eje, enfocable con su nombre completo.
  const gap = (band.step - band.bandwidth) / 2;
  const edges: Array<[number, number]> = bars
    ? x.pos.map((_, i) => [Math.max(0, band.start(i) - gap), Math.min(1, band.start(i) + band.bandwidth + gap)])
    : hitEdges(x.pos);
  const hits = h(
    "div",
    { key: "hits", class: "z-chart__hits" },
    ...x.pos.map((_, i) =>
      h("span", {
        key: `h${i}`,
        class: "z-chart__hit",
        role: "img",
        "data-index": i,
        "data-active": on(state.tip && i === active),
        tabindex: i === focusIndex ? 0 : -1,
        "aria-label": pointName(i),
        s: { "--a": r3(edges[i]![0]), "--b": r3(edges[i]![1]) },
      }),
    ),
  );

  // Tooltip: valor primero (fuerte) y nombre de la serie después; clave de línea, no caja.
  let tip: VNode = null;
  if (config.tooltip && state.tip && active !== null && visible.length) {
    const at = x.pos[active]!;
    const rows = visible.map((s) =>
      h(
        "span",
        { key: s.key, class: "z-chart__tip-row" },
        h("span", { class: "z-chart__tip-key", "data-color": s.color, "data-pattern": s.pattern }),
        h("b", null, fmtValue(s.values[active] ?? null)),
        h("span", null, s.label),
      ),
    );
    if (config.stacked && visible.length > 1)
      rows.push(
        h(
          "span",
          { key: "total", class: "z-chart__tip-row", "data-total": "" },
          h("span", { class: "z-chart__tip-key", "data-total": "" }),
          h("b", null, valueFmt.format(visible.reduce((a, s) => a + (s.values[active] ?? 0), 0))),
          h("span", null, labels.total),
        ),
      );
    tip = h(
      "div",
      {
        key: "tip",
        class: "z-chart__tip",
        "aria-hidden": "true",
        "data-side": horizontal ? undefined : at > 0.6 ? "start" : "end",
        "data-axis": horizontal ? "y" : "x",
        s: { "--x": r3(horizontal ? 1 - at : at) },
      },
      h("span", { class: "z-chart__tip-title" }, x.label[active] ?? ""),
      ...rows,
    );
  }

  const cross =
    !bars && state.tip && active !== null
      ? h("span", { key: "cross", class: "z-chart__cross", "aria-hidden": "true", s: { "--x": r3(x.pos[active]!) } })
      : null;
  const bandHi =
    bars && state.tip && active !== null
      ? h("span", {
          key: "band",
          class: "z-chart__band",
          "aria-hidden": "true",
          s: { "--a": r3(edges[active]![0]), "--b": r3(edges[active]![1]) },
        })
      : null;

  // Ejes (HTML colocado por fracciones; el más largo de los rótulos en flujo fija el ancho del eje vertical).
  const valueTicks = yticks.map((t, i) => ({ at: yf(t), text: axisFmt.format(t), minor: yticks.length > 5 && i % 2 === 1 }));
  // Con pocas categorías se ven todas; con muchas, una de cada dos cede en un contenedor estrecho.
  const catTicks = x.ticks.length > 6 ? x.ticks : x.ticks.map((t) => ({ ...t, minor: false }));
  const vAxisTicks = horizontal ? catTicks.map((t) => ({ ...t, at: 1 - t.at })) : valueTicks;
  const hAxisTicks = horizontal ? valueTicks : catTicks;
  // Todos los rótulos en flujo (sin alto): el eje toma el ancho del más ancho, sea cual sea la fuente.
  const yAxis = h(
    "div",
    { class: "z-chart__axis", "data-axis": "y", "aria-hidden": "true" },
    h("span", { class: "z-chart__sizer" }, ...vAxisTicks.map((t, i) => h("span", { key: `s${i}` }, t.text))),
    ...vAxisTicks.map((t, i) =>
      h("span", { key: `y${i}`, class: "z-chart__tick", "data-minor": on(t.minor), s: { "--at": r3(t.at) } }, t.text),
    ),
  );
  const xAxis = h(
    "div",
    { class: "z-chart__axis", "data-axis": "x", "aria-hidden": "true" },
    ...hAxisTicks.map((t, i) =>
      h(
        "span",
        {
          key: `x${i}`,
          class: "z-chart__tick",
          "data-minor": on(t.minor),
          "data-edge": !bars || horizontal ? (t.at < 0.04 ? "start" : t.at > 0.96 ? "end" : undefined) : undefined,
          s: { "--at": r3(t.at) },
        },
        t.text,
      ),
    ),
  );

  const summaryId = `${uid}-summary`;
  const hintId = `${uid}-hint`;
  const plot = h(
    "div",
    {
      class: "z-chart__plot",
      role: "group",
      "aria-label": config.title || labels.types[type],
      "aria-describedby": `${summaryId} ${hintId}`,
    },
    svg,
    bars ? h("div", { key: "bars", class: "z-chart__bars" }, bandHi, ...barNodes) : null,
    cross,
    dots.length ? h("div", { key: "dots", class: "z-chart__dots" }, ...dots) : null,
    n ? hits : h("span", { key: "empty", class: "z-chart__empty" }, labels.noData),
    tip,
  );

  const legendItems = all.map((s) => ({ key: s.key, label: s.label, color: s.color, pattern: s.pattern, marker: s.marker }));
  const table = tableOf(
    config,
    uid,
    config.xLabel,
    visible.map((s) => s.label),
    data.map((_, i) => ({ key: `r${i}`, head: x.label[i] ?? "", cells: visible.map((s) => fmtValue(s.values[i] ?? null)) })),
  );
  return h(
    "div",
    rootAttrs(config, state),
    h(
      "figure",
      { class: "z-chart__figure" },
      head(config, state, uid),
      legend(config, state, legendItems, type === "line" ? "line" : "rect"),
      state.view === "table"
        ? table
        : h(
            "div",
            { key: "frame", class: "z-chart__frame", "data-orientation": horizontal ? "horizontal" : undefined },
            yAxis,
            plot,
            xAxis,
          ),
      h("p", { key: "summary", class: "z-sr-only", id: summaryId }, config.summary || summarize(config, visible, x.label, valueFmt)),
      h("p", { key: "hint", class: "z-sr-only", id: hintId }, labels.keyboard),
    ),
  );
}

function summarize(
  config: ChartConfig,
  visible: Array<{ label: string; values: Array<number | null> }>,
  xs: string[],
  f: Intl.NumberFormat,
): string {
  const { labels } = config;
  if (!xs.length || !visible.length) return labels.noData;
  const parts = [
    fill(labels.summary, {
      type: labels.types[config.type],
      count: visible.length,
      names: visible.map((s) => s.label).join(", "),
      points: xs.length,
      first: xs[0] ?? "",
      last: xs[xs.length - 1] ?? "",
    }),
  ];
  for (const s of visible) {
    const e = extent(s.values);
    if (e) parts.push(fill(labels.range, { series: s.label, min: f.format(e[0]), max: f.format(e[1]) }));
  }
  return parts.join(" ");
}

// —— Anillo y tarta ——

function roundTree(config: ChartConfig, state: ChartState, uid: string): VEl {
  const { labels, data, locale } = config;
  const key = config.series[0]?.key ?? "value";
  const all = data.map((row, i) => {
    const c = value(row.color);
    return {
      key: String(row[config.xKey] ?? i),
      label: String(row[config.xKey] ?? ""),
      color: colorOf({ key: "", label: "", color: c ?? undefined }, i),
      pattern: i % 4,
      marker: MARKERS[i % MARKERS.length]!,
      value: Math.max(0, round(value(row[key]) ?? 0)),
    };
  });
  const visible = all.filter((s) => !state.hidden.includes(s.key));
  const total = visible.reduce((a, s) => a + s.value, 0);
  const valueFmt = numberFormat(locale, config.valueFormat);
  const pct = numberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  const donut = config.type === "donut";
  // Anillo: hueco angular entre sectores. Tarta: sin hueco angular (sería una cuña); la separa un trazo de superficie.
  const arcs = pieLayout(
    visible.map((s) => s.value),
    donut ? 0.035 : 0,
  );
  const r1 = 50;
  const r0 = donut ? 32 : 0;
  const active = state.active !== null && state.active < visible.length ? state.active : null;
  const focusIndex = active ?? (visible.length ? 0 : null);
  const sliceName = (i: number) =>
    fill(labels.slice, { label: visible[i]!.label, value: valueFmt.format(visible[i]!.value), percent: pct.format(arcs[i]!.fraction) });
  const slices = arcs.map((a, i) =>
    a.value > 0
      ? h("path", {
          key: `s:${visible[i]!.key}`,
          class: "z-chart__slice",
          d: arcPath(50, 50, r0, r1, a.start, a.end),
          "data-index": i,
          "data-color": visible[i]!.color,
          "data-pattern": visible[i]!.pattern,
          "data-active": on(state.tip && i === active),
          role: "img",
          tabindex: i === focusIndex ? 0 : -1,
          "aria-label": sliceName(i),
        })
      : null,
  );
  let tip: VNode = null;
  if (config.tooltip && !donut && state.tip && active !== null && arcs[active]) {
    const a = arcs[active]!;
    const [cx, cy] = arcCentroid(50, 50, r0, r1, a.start, a.end);
    tip = h(
      "div",
      {
        key: "tip",
        class: "z-chart__tip",
        "aria-hidden": "true",
        "data-axis": "free",
        "data-side": cx < 50 ? "end" : "start",
        s: { "--x": r3(cx / 100), "--y": r3(1 - cy / 100) },
      },
      h(
        "span",
        { class: "z-chart__tip-row" },
        h("span", { class: "z-chart__tip-key", "data-color": visible[active]!.color, "data-pattern": visible[active]!.pattern }),
        h("b", null, valueFmt.format(a.value)),
        h("span", null, `${visible[active]!.label} · ${pct.format(a.fraction)}`),
      ),
    );
  }
  const summaryId = `${uid}-summary`;
  const hintId = `${uid}-hint`;
  const summary =
    config.summary ||
    (visible.length
      ? `${labels.types[config.type]}. ${fill(labels.value, { series: labels.total, value: valueFmt.format(total) })}. ${visible
          .map((_, i) => sliceName(i))
          .join(", ")}.`
      : labels.noData);
  const plot = h(
    "div",
    {
      class: "z-chart__plot",
      role: "group",
      "aria-label": config.title || labels.types[config.type],
      "aria-describedby": `${summaryId} ${hintId}`,
    },
    h(
      "svg",
      { key: "svg", class: "z-chart__svg", viewBox: "0 0 100 100", focusable: "false" },
      config.patterns
        ? h(
            "defs",
            { key: "defs" },
            ...[-45, 45, 0].map((deg, i) =>
              h(
                "pattern",
                {
                  key: `p${i}`,
                  id: `${uid}-p${i + 1}`,
                  width: 4,
                  height: 4,
                  patternUnits: "userSpaceOnUse",
                  patternTransform: `rotate(${deg})`,
                },
                h("path", { class: "z-chart__hatch", d: "M0 0V4" }),
              ),
            ),
          )
        : null,
      h(
        "g",
        { key: "marks", class: "z-chart__marks" },
        ...slices,
        // Trama por sector (patterns): la forma además del color.
        ...(config.patterns
          ? arcs.map((a, i) =>
              a.value > 0 && visible[i]!.pattern > 0
                ? h("path", {
                    key: `t:${visible[i]!.key}`,
                    class: "z-chart__slice-hatch",
                    d: arcPath(50, 50, r0, r1, a.start, a.end),
                    fill: `url(#${uid}-p${visible[i]!.pattern})`,
                  })
                : null,
            )
          : []),
      ),
    ),
    // Anillo: el centro muestra el total y, al pasar o enfocar un sector, ese sector (sin tooltip flotante).
    donut && visible.length
      ? state.tip && active !== null && arcs[active]
        ? h(
            "span",
            { key: "center", class: "z-chart__center", "aria-hidden": "true", "data-active": "" },
            h("b", null, valueFmt.format(arcs[active]!.value)),
            h("span", null, `${visible[active]!.label} · ${pct.format(arcs[active]!.fraction)}`),
          )
        : h(
            "span",
            { key: "center", class: "z-chart__center", "aria-hidden": "true" },
            h("b", null, config.centerValue ?? valueFmt.format(total)),
            h("span", null, config.centerLabel ?? labels.total),
          )
      : null,
    visible.length ? null : h("span", { key: "empty", class: "z-chart__empty" }, labels.noData),
    tip,
  );
  const table = tableOf(
    config,
    uid,
    config.xLabel,
    [config.series[0]?.label || key, "%"],
    visible.map((s, i) => ({ key: s.key, head: s.label, cells: [valueFmt.format(s.value), pct.format(arcs[i]!.fraction)] })),
  );
  const items = all.map((s) => ({
    ...s,
    extra: state.hidden.includes(s.key) ? undefined : pct.format(total ? s.value / total : 0),
  }));
  return h(
    "div",
    rootAttrs(config, state),
    h(
      "figure",
      { class: "z-chart__figure" },
      head(config, state, uid),
      state.view === "table"
        ? table
        : h("div", { key: "frame", class: "z-chart__frame", "data-round": "" }, plot, legend(config, state, items, "rect")),
      h("p", { key: "summary", class: "z-sr-only", id: summaryId }, summary),
      h("p", { key: "hint", class: "z-sr-only", id: hintId }, labels.keyboard),
    ),
  );
}

// —— Interacción ——

function attachChart(root: HTMLElement, host: WidgetHost<ChartConfig, ChartState>): () => void {
  const abort = new AbortController();
  const signal = abort.signal;
  const count = () => {
    const c = host.config();
    if (isRound(c.type)) return root.querySelectorAll(".z-chart__slice").length;
    return c.data.length;
  };
  const rtl = () => root.closest("[dir]")?.getAttribute("dir") === "rtl";
  const select = (i: number, focus: boolean) => {
    const s = host.state();
    if (s.active !== i || !s.tip) host.update({ active: i, tip: true }, focus);
  };
  root.addEventListener(
    "click",
    (event) => {
      const target = event.target as Element;
      if (target.closest(".z-chart__toggle")) {
        const view = host.state().view === "table" ? "chart" : "table";
        host.update({ view, tip: false });
        host.emit("view-change", { view });
        return;
      }
      const keyBtn = target.closest<HTMLElement>(".z-chart__key");
      if (keyBtn) {
        if (keyBtn.getAttribute("aria-disabled") === "true") return;
        const k = keyBtn.dataset.key ?? "";
        const hidden = host.state().hidden.includes(k) ? host.state().hidden.filter((x) => x !== k) : [...host.state().hidden, k];
        // Controlado: avisa y espera la prop; sin controlar, cambia por su cuenta.
        if (!host.config().hidden) host.update({ hidden, active: null, tip: false });
        host.emit("hidden-change", { hidden });
        return;
      }
      const hit = target.closest<Element>("[data-index]");
      if (hit && root.contains(hit)) {
        const index = Number(hit.getAttribute("data-index"));
        select(index, true);
        emitPoint(host, index);
      }
    },
    { signal },
  );
  root.addEventListener(
    "keydown",
    (event) => {
      const hit = (event.target as Element).closest?.("[data-index]");
      if (!hit || !root.contains(hit)) {
        if (event.key === "Escape" && host.state().tip) host.update({ tip: false });
        return;
      }
      const i = Number(hit.getAttribute("data-index"));
      const n = count();
      const c = host.config();
      const horizontal = c.type === "bar" && c.orientation === "horizontal";
      let key = event.key;
      if (rtl() && !horizontal) key = key === "ArrowLeft" ? "ArrowRight" : key === "ArrowRight" ? "ArrowLeft" : key;
      let next: number | null = null;
      if (key === "ArrowRight" || key === "ArrowDown") next = i + 1;
      else if (key === "ArrowLeft" || key === "ArrowUp") next = i - 1;
      else if (key === "Home") next = 0;
      else if (key === "End") next = n - 1;
      else if (key === "PageDown") next = i + 5;
      else if (key === "PageUp") next = i - 5;
      else if (key === "Escape") {
        if (host.state().tip) {
          event.preventDefault();
          host.update({ tip: false });
        }
        return;
      } else if (key === "Enter" || key === " ") {
        event.preventDefault();
        emitPoint(host, i);
        return;
      } else return;
      event.preventDefault();
      next = Math.max(0, Math.min(n - 1, next));
      host.update({ active: next, tip: true }, true);
    },
    { signal },
  );
  root.addEventListener(
    "focusin",
    (event) => {
      const hit = (event.target as Element).closest?.("[data-index]");
      if (hit && root.contains(hit)) select(Number(hit.getAttribute("data-index")), false);
    },
    { signal },
  );
  root.addEventListener(
    "focusout",
    (event) => {
      if (!root.contains(event.relatedTarget as Node | null) && host.state().tip && !root.matches(":hover")) host.update({ tip: false });
    },
    { signal },
  );
  root.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType === "touch") return;
      const c = host.config();
      if (isRound(c.type)) {
        const slice = (event.target as Element).closest?.(".z-chart__slice");
        if (slice) select(Number(slice.getAttribute("data-index")), false);
        return;
      }
      const plot = (event.target as Element).closest?.<HTMLElement>(".z-chart__plot");
      if (!plot || !c.data.length) return;
      const rect = plot.getBoundingClientRect();
      const horizontal = c.type === "bar" && c.orientation === "horizontal";
      const f = horizontal
        ? (event.clientY - rect.top) / (rect.height || 1)
        : rtl()
          ? (rect.right - event.clientX) / (rect.width || 1)
          : (event.clientX - rect.left) / (rect.width || 1);
      const hits = [...plot.querySelectorAll<HTMLElement>(".z-chart__hit")];
      const edges = hits.map((el) => {
        const a = Number(el.style.getPropertyValue("--a"));
        const b = Number(el.style.getPropertyValue("--b"));
        return [a, b] as [number, number];
      });
      const i = indexAt(edges, Math.min(Math.max(f, 0), 1));
      if (i >= 0) select(i, false);
    },
    { signal },
  );
  root.addEventListener(
    "pointerleave",
    () => {
      if (host.state().tip && !root.contains(root.ownerDocument.activeElement)) host.update({ tip: false });
    },
    { signal },
  );
  return () => abort.abort();
}

function emitPoint(host: WidgetHost<ChartConfig, ChartState>, index: number): void {
  const c = host.config();
  if (isRound(c.type)) {
    const visible = c.data.filter((row, i) => !host.state().hidden.includes(String(row[c.xKey] ?? i)));
    host.emit("point-click", { index, datum: visible[index] });
  } else host.emit("point-click", { index, datum: c.data[index] });
}
