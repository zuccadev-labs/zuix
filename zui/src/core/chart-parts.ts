// Piezas compartidas de los gráficos (core/chart-widget y los árboles de cada tipo): tipos, textos por defecto,
// lectura de valores, cabecera con «View as table», leyenda, raíz, tabla alternativa y ejes colocados por fracciones.
// Sin documento al importar.

import { type Curve, r3 } from "./chart";
import { h, icon, on, type VEl, type VNode } from "./vnode";

export type ChartType = "line" | "area" | "bar" | "donut" | "pie" | "scatter" | "radar" | "combo" | "heatmap" | "bullet";
export type ChartMarker = "circle" | "square" | "diamond" | "triangle";
export const CHART_COLORS = 8;
export const MARKERS: ChartMarker[] = ["circle", "square", "diamond", "triangle"];

export interface ChartSeries {
  /** Clave del valor en cada fila de `data`. */
  key: string;
  label: string;
  /** Color de serie 1–8 (`--z-chart-N`). Por defecto, su posición en `series`: el color sigue a la serie. */
  color?: number;
  /** Forma del marcador (con `markers`). Por defecto, una por posición. */
  marker?: ChartMarker;
  /** ComboChart: la serie se pinta como barras (por defecto) o como línea. */
  type?: "bar" | "line";
  /** ComboChart: eje de valores de la serie, el principal (`start`, por defecto) o el secundario (`end`). */
  axis?: "start" | "end";
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
  /** Instrucciones de teclado de la dispersión. */
  keyboardScatter: string;
  /** Instrucciones de teclado del mapa de calor (rejilla). */
  keyboardGrid: string;
  /** Dispersión: «{label}{series}: {x}, {y}{size}». */
  scatterPoint: string;
  /** Nombre de la línea de tendencia en la leyenda y el resumen: «{series} trend». */
  trend: string;
  /** «{series} trend: slope {slope}, R² {r2}.» */
  trendSummary: string;
  /** Mapa de calor: «{row}, {column}: {value}». */
  cell: string;
  /** Mapa de calor: nombre de la leyenda de escala. */
  scale: string;
  /** BulletChart: nombre del valor medido. */
  actual: string;
  /** BulletChart: nombre del objetivo. */
  target: string;
  /** BulletChart: «{label}: {value}, {target} {goal}{range}». */
  bullet: string;
  /** BulletChart: «, in {range}». */
  inRange: string;
  /** BulletChart: cabecera del rango en la tabla. */
  band: string;
  /** RadarChart: escala bajo el radar, «Scale {min} to {max}, rings every {step}». */
  radarScale: string;
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
  keyboardScatter: "Use the left and right arrow keys to move between points, and up and down to change series.",
  keyboardGrid: "Use the arrow keys to move between cells. Home and End go to the start and end of the row.",
  scatterPoint: "{label}{series}: {x}, {y}{size}",
  trend: "{series} trend",
  trendSummary: "{series} trend: slope {slope}, R² {r2}.",
  cell: "{row}, {column}: {value}",
  scale: "Scale",
  actual: "Value",
  target: "Target",
  bullet: "{label}: {value}, {target} {goal}{range}",
  inRange: ", in {range}",
  band: "Range",
  radarScale: "Scale {min} to {max}, rings every {step}",
  types: {
    line: "Line chart",
    area: "Area chart",
    bar: "Bar chart",
    donut: "Donut chart",
    pie: "Pie chart",
    scatter: "Scatter chart",
    radar: "Radar chart",
    combo: "Combo chart",
    heatmap: "Heatmap",
    bullet: "Bullet chart",
  },
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
  // —— ScatterChart ——
  /** Dispersión y mapa de calor: clave del valor vertical (dispersión) o de la fila (mapa de calor). */
  yKey?: string;
  /** Dispersión: clave del tamaño (burbuja: el área es proporcional al valor). */
  sizeKey?: string;
  /** Dispersión: clave que reparte las filas en series (el valor de la clave es la `key` de la serie). */
  seriesKey?: string;
  /** Dispersión: clave del nombre de cada punto (entra en su nombre accesible y en el tooltip). */
  labelKey?: string;
  /** Dispersión: recta de regresión lineal por serie. */
  trend?: boolean;
  /** Dispersión: formato de los valores del eje horizontal. */
  xValueFormat?: Intl.NumberFormatOptions;
  /** Dispersión: formato del tamaño. */
  sizeFormat?: Intl.NumberFormatOptions;
  /** Dispersión: nombre del eje vertical (cabecera de la tabla). Por defecto, `yKey`. */
  yLabel?: string;
  /** Dispersión: nombre del tamaño. Por defecto, `sizeKey`. */
  sizeLabel?: string;
  xMin?: number;
  xMax?: number;
  // —— RadarChart ——
  /** Radar: forma de la retícula (polígono por defecto, o círculos). */
  gridShape?: "polygon" | "circle";
  // —— ComboChart ——
  y2Min?: number;
  y2Max?: number;
  /** Formato de los valores del eje secundario (por defecto, el de `valueFormat`). */
  y2Format?: Intl.NumberFormatOptions;
  // —— HeatmapChart ——
  /** Mapa de calor: clave del valor de cada celda. */
  valueKey?: string;
  /** Mapa de calor: escala secuencial (por defecto) o divergente alrededor de `midpoint`. */
  scale?: "sequential" | "diverging";
  /** Mapa de calor: extremos de la escala (por defecto, los de los datos). */
  domain?: readonly [number, number];
  /** Mapa de calor divergente: valor neutro (por defecto, 0). */
  midpoint?: number;
  /** Mapa de calor: el valor escrito en cada celda. */
  showValues?: boolean;
  // —— BulletChart ——
  /** BulletChart: límites superiores de los rangos cualitativos, de menor a mayor (comunes a todas las filas). */
  ranges?: readonly number[];
  /** BulletChart: nombres de los rangos («Poor», «Fair», «Good»). */
  rangeLabels?: readonly string[];
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
  yKey: string;
  sizeKey?: string;
  seriesKey?: string;
  labelKey?: string;
  trend: boolean;
  xValueFormat: Intl.NumberFormatOptions;
  sizeFormat: Intl.NumberFormatOptions;
  yLabel: string;
  sizeLabel: string;
  xMin?: number;
  xMax?: number;
  gridShape: "polygon" | "circle";
  y2Min?: number;
  y2Max?: number;
  y2Format: Intl.NumberFormatOptions;
  valueKey: string;
  scale: "sequential" | "diverging";
  domain?: [number, number];
  midpoint: number;
  showValues: boolean;
  ranges: number[];
  rangeLabels: string[];
}

export interface ChartState {
  view: "chart" | "table";
  /** Posición del eje (o sector) activa: la enfocable y la del tooltip. */
  active: number | null;
  /** El tooltip se ve (puntero encima o foco dentro). */
  tip: boolean;
  hidden: string[];
}

export const TYPES: ChartType[] = ["line", "area", "bar", "donut", "pie", "scatter", "radar", "combo", "heatmap", "bullet"];
export const round = (v: number) => (Number.isFinite(v) ? v : 0);
export const isRound = (t: ChartType) => t === "donut" || t === "pie";
export const value = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? n : null;
};
export const colorOf = (s: ChartSeries, i: number) => {
  const c = Math.round(s.color ?? i + 1);
  return ((((c - 1) % CHART_COLORS) + CHART_COLORS) % CHART_COLORS) + 1;
};
export const markerOf = (s: ChartSeries, i: number): ChartMarker => s.marker ?? MARKERS[i % MARKERS.length]!;

// —— Piezas comunes ——

export function head(config: ChartConfig, state: ChartState, uid: string): VEl {
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

export function legend(
  config: ChartConfig,
  state: ChartState,
  items: Array<{ key: string; label: string; color: number; pattern: number; marker: ChartMarker; extra?: string; mark?: "line" | "rect" }>,
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
          "data-mark": s.mark ?? mark,
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

export function rootAttrs(config: ChartConfig, state: ChartState) {
  return {
    class: config.framed ? "z-chart z-liquid" : "z-chart",
    "data-framed": on(config.framed),
    "data-type": config.type,
    "data-orientation": config.type === "bar" || config.type === "bullet" ? config.orientation : undefined,
    "data-stacked": on(config.stacked),
    "data-markers": on(config.markers),
    "data-patterns": on(config.patterns),
    "data-animate": on(config.animate),
    "data-view": state.view,
    s: config.height ? { "--z-chart-height": `${config.height}px` } : undefined,
  };
}

export function tableOf(
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

/** Leyenda sin interacción (escala del mapa de calor, piezas del BulletChart): una lista con nombre. */
export function staticLegend(
  config: ChartConfig,
  items: Array<{
    key: string;
    label: string;
    color?: number;
    mark: string;
    pattern?: number;
    level?: number;
    range?: number;
    levels?: number;
  }>,
  name: string = config.labels.legend,
): VNode {
  if (!config.legend || !items.length) return null;
  return h(
    "ul",
    { key: "legend", class: "z-chart__legend", "data-static": "", "aria-label": name },
    ...items.map((s) =>
      h(
        "li",
        { key: s.key, class: "z-chart__key" },
        h("span", {
          class: "z-chart__swatch",
          "data-mark": s.mark,
          "data-color": s.color,
          "data-pattern": s.pattern,
          "data-level": s.level,
          "data-range": s.range,
          "data-levels": s.levels,
          "aria-hidden": "true",
        }),
        // Un tramo de números («27.2 – 33») se lee de izquierda a derecha también en RTL.
        h("span", { class: "z-chart__key-label", dir: "auto" }, s.label),
      ),
    ),
  );
}

export interface Tick {
  at: number;
  text: string;
  minor: boolean;
}

/** Eje vertical (valores o categorías): todos los rótulos en flujo fijan el ancho, cada uno colocado por fracción. */
export function yAxisNode(ticks: Tick[], side: "start" | "end" = "start", key = "yaxis"): VEl {
  return h(
    "div",
    { key, class: "z-chart__axis", "data-axis": "y", "data-side": side === "end" ? "end" : undefined, "aria-hidden": "true" },
    h("span", { class: "z-chart__sizer" }, ...ticks.map((t, i) => h("span", { key: `s${i}` }, t.text))),
    ...ticks.map((t, i) => h("span", { key: `y${i}`, class: "z-chart__tick", "data-minor": on(t.minor), s: { "--at": r3(t.at) } }, t.text)),
  );
}

/** Eje horizontal: rótulos centrados en su posición; los de los bordes se apoyan hacia dentro si `edges`. */
export function xAxisNode(ticks: Tick[], edges: boolean, key = "xaxis"): VEl {
  return h(
    "div",
    { key, class: "z-chart__axis", "data-axis": "x", "aria-hidden": "true" },
    ...ticks.map((t, i) =>
      h(
        "span",
        {
          key: `x${i}`,
          class: "z-chart__tick",
          "data-minor": on(t.minor),
          "data-edge": edges ? (t.at < 0.04 ? "start" : t.at > 0.96 ? "end" : undefined) : undefined,
          s: { "--at": r3(t.at) },
        },
        t.text,
      ),
    ),
  );
}

/** Resumen y pista de teclado para lectores de pantalla (los describe el área de trazado). */
export function srTexts(uid: string, summary: string, hint: string): VNode[] {
  return [
    h("p", { key: "summary", class: "z-sr-only", id: `${uid}-summary` }, summary),
    h("p", { key: "hint", class: "z-sr-only", id: `${uid}-hint` }, hint),
  ];
}

/** Lado del tooltip respecto a su ancla: hacia el centro del área. */
export const tipSide = (x: number) => (x > 0.6 ? "start" : "end");
