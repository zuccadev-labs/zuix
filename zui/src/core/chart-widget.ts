// Gráficos de líneas, áreas, barras y anillo como pieza (core/widget): un solo árbol para React y para el modo DOM.
// Marcas de línea y área en SVG (viewBox 100 × 100 sin conservar la proporción, trazos que no escalan) y barras,
// puntos, ejes, cruceta y tooltip en HTML colocado por fracciones: nada se mide, así que el marcado del servidor ya es
// el definitivo y el gráfico se adapta a su contenedor (consultas de contenedor). Accesible: `figure` + `figcaption`,
// resumen para lectores de pantalla, un punto enfocable por posición del eje (flechas, Inicio/Fin) con su nombre
// completo, leyenda que oculta series, tabla de datos alternativa y marcas o tramas además del color. Sin documento
// al importar.
import { localize, formatList } from "./locale";

import {
  arcCentroid,
  arcPath,
  axisNumberOptions,
  bandScale,
  type Curve,
  extent,
  hitEdges,
  gridStep,
  indexAt,
  linePath,
  nearestPoint,
  scatterStep,
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
import {
  CHART_LABELS,
  type ChartConfig,
  type ChartLabels,
  type ChartProps,
  type ChartSeries,
  type ChartState,
  type ChartType,
  colorOf,
  head,
  isRound,
  legend,
  MARKERS,
  markerOf,
  rootAttrs,
  round,
  yAxisNode,
  tableOf,
  TYPES,
  value,
} from "./chart-parts";
import { bulletTree } from "./chart-bullet";
import { heatModel, heatmapTree } from "./chart-heatmap";
import { radarTree } from "./chart-radar";
import { scatterModel, scatterTree } from "./chart-scatter";
import { fill, fmt, h, on, type VEl, type VNode } from "./vnode";
import { list, num, yes, type Widget, type WidgetHost } from "./widget";

export { CHART_COLORS, CHART_LABELS } from "./chart-parts";
export type { ChartConfig, ChartLabels, ChartMarker, ChartProps, ChartSeries, ChartState, ChartType } from "./chart-parts";

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
  const bars = config.type === "bar" || config.type === "combo";
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
    const xKey = p.xKey ?? (isRound(type) || type === "bullet" ? "label" : "x");
    const given = (Array.isArray(p.series) ? p.series : []).filter((s): s is ChartSeries => Boolean(s && typeof s.key === "string"));
    const yKey = p.yKey ?? "y";
    let series = given.length ? given : [{ key: isRound(type) ? "value" : "y", label: "" }];
    if (type === "scatter") {
      // Una serie por valor de `seriesKey` (en orden de aparición), con el nombre y el color de `series` si los trae.
      const keys = p.seriesKey ? [...new Set(data.map((row) => String(row[p.seriesKey!] ?? "")))] : [""];
      for (const s of given) if (!keys.includes(s.key) && p.seriesKey) keys.push(s.key);
      series = keys.map((k) => given.find((s) => s.key === k) ?? { key: k, label: k || (p.yLabel ?? yKey) });
    }
    const auto =
      data.length > 0 &&
      data.every((row) => {
        const v = row[xKey];
        return (v instanceof Date || typeof v === "string") && Number.isFinite(toTime(v));
      });
    const xType = p.xType === "time" || p.xType === "number" || p.xType === "category" ? p.xType : auto ? "time" : "category";
    const labels = { ...localize("chart", CHART_LABELS), ...p.labels, types: { ...localize("chart", CHART_LABELS).types, ...p.labels?.types } };
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
      stacked: Boolean(p.stacked) && (type === "bar" || type === "area" || type === "combo"),
      orientation:
        type === "bullet"
          ? p.orientation === "vertical"
            ? "vertical"
            : "horizontal"
          : p.orientation === "horizontal" && type === "bar"
            ? "horizontal"
            : "vertical",
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
      legend: p.legend ?? (isRound(type) || type === "combo" || type === "heatmap" || type === "bullet" ? true : series.length > 1),
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
      yKey,
      sizeKey: p.sizeKey,
      seriesKey: p.seriesKey,
      labelKey: p.labelKey,
      trend: Boolean(p.trend),
      xValueFormat: p.xValueFormat ?? {},
      sizeFormat: p.sizeFormat ?? {},
      yLabel: p.yLabel ?? yKey,
      sizeLabel: p.sizeLabel ?? p.sizeKey ?? "",
      xMin: Number.isFinite(p.xMin) ? p.xMin : undefined,
      xMax: Number.isFinite(p.xMax) ? p.xMax : undefined,
      gridShape: p.gridShape === "circle" ? "circle" : "polygon",
      y2Min: Number.isFinite(p.y2Min) ? p.y2Min : undefined,
      y2Max: Number.isFinite(p.y2Max) ? p.y2Max : undefined,
      y2Format: p.y2Format ?? p.valueFormat ?? {},
      valueKey: p.valueKey ?? "value",
      scale: p.scale === "diverging" ? "diverging" : "sequential",
      domain:
        Array.isArray(p.domain) && Number.isFinite(p.domain[0]) && Number.isFinite(p.domain[1])
          ? [Math.min(p.domain[0]!, p.domain[1]!), Math.max(p.domain[0]!, p.domain[1]!)]
          : undefined,
      midpoint: Number.isFinite(p.midpoint) ? p.midpoint! : 0,
      showValues: Boolean(p.showValues),
      ranges: (Array.isArray(p.ranges) ? p.ranges : []).filter((v) => Number.isFinite(v)).sort((a, b) => a - b),
      rangeLabels: Array.isArray(p.rangeLabels) ? p.rangeLabels.map(String) : [],
    };
  },
  initial(config) {
    return { view: config.defaultView, active: null, tip: false, hidden: config.hidden ?? config.defaultHidden };
  },
  control(config, state) {
    return config.hidden && config.hidden.join("\n") !== state.hidden.join("\n") ? { ...state, hidden: config.hidden } : state;
  },
  tree(config, state, uid) {
    if (isRound(config.type)) return roundTree(config, state, uid);
    if (config.type === "scatter") return scatterTree(config, state, uid);
    if (config.type === "radar") return radarTree(config, state, uid);
    if (config.type === "heatmap") return heatmapTree(config, state, uid);
    if (config.type === "bullet") return bulletTree(config, state, uid);
    return cartesianTree(config, state, uid);
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
      orientation: d.orientation === "horizontal" || d.orientation === "vertical" ? d.orientation : undefined,
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
      yKey: d.yKey,
      sizeKey: d.sizeKey,
      seriesKey: d.seriesKey,
      labelKey: d.labelKey,
      trend: yes(d.trend),
      xValueFormat: json.xValueFormat as Intl.NumberFormatOptions | undefined,
      sizeFormat: json.sizeFormat as Intl.NumberFormatOptions | undefined,
      yLabel: d.yLabel,
      sizeLabel: d.sizeLabel,
      xMin: n(d.xMin),
      xMax: n(d.xMax),
      gridShape: d.gridShape === "circle" ? "circle" : undefined,
      y2Min: n(d.y2Min),
      y2Max: n(d.y2Max),
      y2Format: json.y2Format as Intl.NumberFormatOptions | undefined,
      valueKey: d.valueKey,
      scale: d.scale === "diverging" ? "diverging" : undefined,
      domain: Array.isArray(json.domain) ? (json.domain as [number, number]) : undefined,
      midpoint: n(d.midpoint),
      showValues: yes(d.showValues),
      ranges: Array.isArray(json.ranges) ? (json.ranges as number[]) : undefined,
      rangeLabels: Array.isArray(json.rangeLabels) ? (json.rangeLabels as string[]) : undefined,
    };
  },
};

// —— Líneas, áreas y barras ——

function cartesianTree(config: ChartConfig, state: ChartState, uid: string): VEl {
  const { labels, data, type, locale } = config;
  const n = data.length;
  const combo = type === "combo";
  const bars = type === "bar" || combo;
  const horizontal = type === "bar" && config.orientation === "horizontal";
  const all = config.series.map((s, i) => ({
    ...s,
    index: i,
    color: colorOf(s, i),
    pattern: i % 4,
    marker: markerOf(s, i),
    kind: (combo ? (s.type === "line" ? "line" : "bar") : bars ? "bar" : "line") as "bar" | "line",
    second: combo && s.axis === "end",
    values: data.map((row) => value(row[s.key])),
  }));
  const visible = all.filter((s) => !state.hidden.includes(s.key));
  const barSeries = visible.filter((s) => s.kind === "bar");
  const lineSeries = visible.filter((s) => s.kind === "line");
  const x = xModel(config);
  // Se apilan las barras (o las áreas); en el combinado, las líneas nunca.
  const stackSet = bars ? barSeries : visible;
  const stacked = config.stacked ? stack(stackSet.map((s) => s.values)) : null;
  const stackOf = (s: (typeof visible)[number]) => (stacked ? stackSet.indexOf(s) : -1);
  const spanOf = (second: boolean) => {
    const own = visible.filter((s) => s.second === second);
    const vals: Array<number | null> = [];
    for (const s of own) {
      const k = stackOf(s);
      if (k >= 0) for (const [a, b] of stacked![k]!) vals.push(a, b);
      else vals.push(...s.values);
    }
    return extent(vals);
  };
  const zero = bars || type === "area";
  const scaleOf = (second: boolean) => {
    const span = spanOf(second);
    const min = second ? config.y2Min : config.yMin;
    const max = second ? config.y2Max : config.yMax;
    // El combinado con barras en un eje lo lleva al 0; un eje solo de líneas no tiene por qué.
    const z = combo ? visible.some((s) => s.second === second && s.kind === "bar") : zero;
    const t = niceTicks(min ?? span?.[0] ?? 0, max ?? span?.[1] ?? 1, config.yTicks, z);
    const lo = min ?? t.min;
    const hi = max ?? t.max;
    return { lo, hi, f: (v: number) => (v - lo) / (hi - lo || 1), ticks: t.ticks.filter((v) => v >= lo - 1e-9 && v <= hi + 1e-9) };
  };
  const primary = scaleOf(false);
  const hasSecond = combo && visible.some((s) => s.second);
  const secondary = hasSecond ? scaleOf(true) : primary;
  const ylo = primary.lo;
  const yhi = primary.hi;
  const yf = primary.f; // fracción desde la base
  const yticks = primary.ticks;
  const fOf = (s: { second: boolean }) => (s.second ? secondary.f : yf);
  const valueFmt = numberFormat(locale, config.valueFormat);
  const value2Fmt = numberFormat(locale, config.y2Format);
  const axisFmt = numberFormat(locale, axisNumberOptions(config.valueFormat, Math.max(Math.abs(ylo), Math.abs(yhi))));
  const axis2Fmt = numberFormat(locale, axisNumberOptions(config.y2Format, Math.max(Math.abs(secondary.lo), Math.abs(secondary.hi))));
  const fmtOf = (s: { second: boolean }) => (v: number | null) =>
    v === null ? labels.missing : (s.second ? value2Fmt : valueFmt).format(v);
  const active = state.active !== null && state.active >= 0 && state.active < n ? state.active : null;
  const focusIndex = active ?? (n ? 0 : null);
  const base = Math.min(Math.max(yf(0), 0), 1);
  const totalOf = (i: number) => stackSet.reduce((a, s) => a + (s.values[i] ?? 0), 0);
  const showTotal = config.stacked && stackSet.length > 1;

  // Nombre de cada posición: «Mar 2026: Revenue 1,200, Costs 800, Total 2,000».
  const pointName = (i: number) => {
    const parts = visible.map((s) => fill(labels.value, { series: s.label, value: fmtOf(s)(s.values[i] ?? null) }));
    if (showTotal) parts.push(fill(labels.value, { series: labels.total, value: valueFmt.format(totalOf(i)) }));
    return fill(labels.point, { x: x.label[i] ?? "", values: parts.join(", ") });
  };

  const band = bandScale(n, 0.3, 0.15);
  // Marcas SVG (líneas y áreas) en un viewBox 100 × 100: y crece hacia abajo.
  const svgY = (f: number) => r3((1 - f) * 100);
  const marks: VNode[] = [];
  const dots: VNode[] = [];
  const barNodes: VNode[] = [];
  for (const s of lineSeries) {
    const k = combo ? -1 : stackOf(s);
    const f = fOf(s);
    const top: Point[] = s.values.map((v, i) => {
      const yv = k >= 0 ? stacked![k]![i]![1] : v;
      return v === null || yv === null ? null : [r3(x.pos[i]! * 100), svgY(f(yv))];
    });
    if (type === "area") {
      const bottom: Point[] = s.values.map((_, i) => [r3(x.pos[i]! * 100), k >= 0 ? svgY(yf(stacked![k]![i]![0])) : svgY(base)]);
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
      const yv = k >= 0 ? stacked![k]![i]![1] : v;
      dots.push(
        h("span", {
          key: `d:${s.key}:${i}`,
          class: "z-chart__dot",
          "data-color": s.color,
          "data-marker": config.markers ? s.marker : "circle",
          "data-active": on(state.tip && i === active),
          "aria-hidden": "true",
          s: { "--x": r3(x.pos[i]!), "--y": r3(f(yv)) },
        }),
      );
    });
  }
  if (barSeries.length) {
    const groups = config.stacked ? 1 : Math.max(1, barSeries.length);
    const sub = band.bandwidth / groups;
    barSeries.forEach((s, k) => {
      const f = fOf(s);
      s.values.forEach((v, i) => {
        if (v === null) return;
        const [lo, hi] = stacked ? stacked[k]![i]! : v >= 0 ? [0, v] : [v, 0];
        const a = Math.min(Math.max(f(Math.min(lo, hi)), 0), 1);
        const b = Math.min(Math.max(f(Math.max(lo, hi)), 0), 1);
        const center = config.stacked ? band.center(i) : band.start(i) + sub * (k + 0.5);
        // Extremo redondeado: el de la punta del dato (el último del apilado en cada sentido).
        const negative = v < 0;
        const cap =
          !stacked ||
          barSeries.slice(k + 1).every((o) => {
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
    combo ? null : h("g", { key: "marks", class: "z-chart__marks" }, ...marks),
  );
  // Combinado: las líneas en su propio SVG, por encima de las barras.
  const lineSvg =
    combo && marks.length
      ? h(
          "svg",
          {
            key: "lines",
            class: "z-chart__svg",
            viewBox: "0 0 100 100",
            preserveAspectRatio: "none",
            "aria-hidden": "true",
            focusable: "false",
          },
          h("g", { key: "marks", class: "z-chart__marks" }, ...marks),
        )
      : null;

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
        h("b", null, fmtOf(s)(s.values[active] ?? null)),
        h("span", null, s.label),
      ),
    );
    if (showTotal)
      rows.push(
        h(
          "span",
          { key: "total", class: "z-chart__tip-row", "data-total": "" },
          h("span", { class: "z-chart__tip-key", "data-total": "" }),
          h("b", null, valueFmt.format(totalOf(active))),
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
    (!bars || (combo && lineSeries.length > 0 && barSeries.length === 0)) && state.tip && active !== null
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
  // En un eje de tiempo o número los rótulos son más anchos: alternan desde 5.
  const catTicks =
    x.ticks.length > 6 || ((!bars || config.xType === "time") && x.ticks.length > 4)
      ? x.ticks
      : x.ticks.map((t) => ({ ...t, minor: false }));
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
  const y2Axis = hasSecond
    ? yAxisNode(
        secondary.ticks.map((t, i) => ({ at: secondary.f(t), text: axis2Fmt.format(t), minor: secondary.ticks.length > 5 && i % 2 === 1 })),
        "end",
        "y2axis",
      )
    : null;
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
    lineSvg,
    cross,
    dots.length ? h("div", { key: "dots", class: "z-chart__dots" }, ...dots) : null,
    n ? hits : h("span", { key: "empty", class: "z-chart__empty" }, labels.noData),
    tip,
  );

  const legendItems = all.map((s) => ({
    key: s.key,
    label: s.label,
    color: s.color,
    pattern: s.pattern,
    marker: s.marker,
    mark: combo ? (s.kind === "line" ? ("line" as const) : ("rect" as const)) : undefined,
  }));
  const table = tableOf(
    config,
    uid,
    config.xLabel,
    visible.map((s) => s.label),
    data.map((_, i) => ({ key: `r${i}`, head: x.label[i] ?? "", cells: visible.map((s) => fmtOf(s)(s.values[i] ?? null)) })),
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
            {
              key: "frame",
              class: "z-chart__frame",
              "data-orientation": horizontal ? "horizontal" : undefined,
              "data-y2": on(hasSecond),
            },
            yAxis,
            plot,
            y2Axis,
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
      names: formatList(visible.map((s) => s.label)),
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
    if (c.type === "scatter") return root.querySelectorAll(".z-chart__point").length;
    if (c.type === "heatmap") return root.querySelectorAll(".z-chart__cell").length;
    return c.data.length;
  };
  /** Tipos cuyas zonas activas son elementos propios (sector, cuña, celda, fila): el puntero va por `closest`. */
  const byTarget = (t: string) => isRound(t as ChartType) || t === "radar" || t === "heatmap" || t === "bullet";
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
      if (c.type === "heatmap" || c.type === "scatter") {
        const map: Record<string, string> = {
          ArrowRight: "right",
          ArrowLeft: "left",
          ArrowDown: "down",
          ArrowUp: "up",
          Home: "home",
          End: "end",
          PageDown: "pageDown",
          PageUp: "pageUp",
        };
        const k = map[key];
        if (k) {
          event.preventDefault();
          if (c.type === "heatmap") {
            const m = heatModel(c);
            const ctrl = event.ctrlKey || event.metaKey;
            const g = k === "home" ? (ctrl ? "first" : "rowStart") : k === "end" ? (ctrl ? "last" : "rowEnd") : k;
            next = gridStep(i, m.rows.length, m.cols.length, g as Parameters<typeof gridStep>[3]);
          } else {
            const m = scatterModel(c, host.state().hidden);
            const g = { right: "next", left: "prev", down: "down", up: "up", home: "first", end: "last", pageDown: "down", pageUp: "up" }[
              k
            ] as Parameters<typeof scatterStep>[3];
            next = scatterStep(
              m.groups,
              m.points.map((p) => p.x),
              i,
              g,
            );
          }
          host.update({ active: next, tip: true }, true);
          return;
        }
      }
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
      if (byTarget(c.type)) {
        const hit = (event.target as Element).closest?.("[data-index]");
        if (hit && root.contains(hit)) select(Number(hit.getAttribute("data-index")), false);
        return;
      }
      if (c.type === "scatter") {
        const plot = (event.target as Element).closest?.<HTMLElement>(".z-chart__plot");
        if (!plot) return;
        const pts = [...plot.querySelectorAll<HTMLElement>(".z-chart__point")];
        const centers = pts.map((el) => {
          const r = el.getBoundingClientRect();
          return [r.left + r.width / 2, r.top + r.height / 2] as const;
        });
        const i = nearestPoint(centers, [event.clientX, event.clientY]);
        if (i < 0) return;
        const [cx, cy] = centers[i]!;
        // Solo cerca de un punto (32 px o su radio): en el vacío no salta el tooltip de un punto lejano.
        const reach = Math.max(32, pts[i]!.getBoundingClientRect().width / 2 + 8);
        if (Math.hypot(cx - event.clientX, cy - event.clientY) <= reach) select(Number(pts[i]!.dataset.index), false);
        else if (host.state().tip && !root.contains(root.ownerDocument.activeElement)) host.update({ tip: false });
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
  if (c.type === "scatter") {
    const p = scatterModel(c, host.state().hidden).points[index];
    host.emit("point-click", { index, datum: p ? c.data[p.row] : undefined });
    return;
  }
  if (c.type === "heatmap") {
    const row = heatModel(c).source[index] ?? -1;
    host.emit("point-click", { index, datum: row >= 0 ? c.data[row] : undefined });
    return;
  }
  if (isRound(c.type)) {
    const visible = c.data.filter((row, i) => !host.state().hidden.includes(String(row[c.xKey] ?? i)));
    host.emit("point-click", { index, datum: visible[index] });
  } else host.emit("point-click", { index, datum: c.data[index] });
}
