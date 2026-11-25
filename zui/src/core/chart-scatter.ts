// Dispersión y burbujas (ScatterChart) como árbol de core/chart-widget: puntos en HTML colocados por fracciones (forma
// por serie, tamaño por área con `sizeKey`), recta de regresión opcional en SVG y cada punto enfocable con su nombre
// completo. Las flechas recorren la serie en orden de x y ↑↓ cambian de serie. Sin documento al importar.

import { axisNumberOptions, bubbleRadius, extent, linearRegression, niceTicks, numberFormat, r3, type Regression } from "./chart";
import {
  type ChartConfig,
  type ChartMarker,
  type ChartState,
  colorOf,
  head,
  legend,
  markerOf,
  rootAttrs,
  srTexts,
  tableOf,
  tipSide,
  value,
  xAxisNode,
  yAxisNode,
} from "./chart-parts";
import { fill, h, on, type VEl, type VNode } from "./vnode";

export interface ScatterPoint {
  /** Índice plano (orden de foco): serie a serie y, dentro de cada una, por x. */
  index: number;
  /** Fila de `data`. */
  row: number;
  series: number;
  x: number;
  y: number;
  size: number | null;
  label: string;
}

export interface ScatterModel {
  points: ScatterPoint[];
  /** Índices planos de cada serie visible, en orden de x (para el teclado). */
  groups: number[][];
  series: Array<{ key: string; label: string; color: number; pattern: number; marker: ChartMarker; index: number }>;
  visible: number[];
  x: { lo: number; hi: number; ticks: number[] };
  y: { lo: number; hi: number; ticks: number[] };
  sizeMax: number;
  trends: Array<{ series: number; fit: Regression; x0: number; x1: number }>;
}

/** Puntos, escalas y rectas de tendencia de la dispersión (lo comparten el árbol y el teclado). */
export function scatterModel(config: ChartConfig, hidden: readonly string[]): ScatterModel {
  const { data } = config;
  const series = config.series.map((s, i) => ({
    key: s.key,
    label: s.label,
    color: colorOf(s, i),
    pattern: i % 4,
    marker: markerOf(s, i),
    index: i,
  }));
  const visible = series.filter((s) => !hidden.includes(s.key)).map((s) => s.index);
  const raw: Array<Omit<ScatterPoint, "index">> = [];
  data.forEach((row, r) => {
    const x = value(row[config.xKey]);
    const y = value(row[config.yKey]);
    if (x === null || y === null) return;
    const key = config.seriesKey ? String(row[config.seriesKey] ?? "") : "";
    const s = series.findIndex((o) => o.key === key);
    if (s < 0 || !visible.includes(s)) return;
    raw.push({
      row: r,
      series: s,
      x,
      y,
      size: config.sizeKey ? value(row[config.sizeKey]) : null,
      label: config.labelKey ? String(row[config.labelKey] ?? "") : "",
    });
  });
  const points: ScatterPoint[] = [];
  const groups: number[][] = [];
  for (const s of visible) {
    const own = raw.filter((p) => p.series === s).sort((a, b) => a.x - b.x || a.row - b.row);
    groups.push(own.map((_, i) => points.length + i));
    for (const p of own) points.push({ ...p, index: points.length });
  }
  const ex = extent(points.map((p) => p.x)) ?? [0, 1];
  const ey = extent(points.map((p) => p.y)) ?? [0, 1];
  const tx = niceTicks(config.xMin ?? ex[0], config.xMax ?? ex[1], 6);
  const ty = niceTicks(config.yMin ?? ey[0], config.yMax ?? ey[1], config.yTicks);
  const axis = (t: ReturnType<typeof niceTicks>, min?: number, max?: number) => {
    const lo = min ?? t.min;
    const hi = max ?? t.max;
    return { lo, hi, ticks: t.ticks.filter((v) => v >= lo - 1e-9 && v <= hi + 1e-9) };
  };
  const trends: ScatterModel["trends"] = [];
  if (config.trend)
    for (const s of visible) {
      const own = points.filter((p) => p.series === s);
      const fit = linearRegression(own.map((p) => [p.x, p.y] as const));
      const span = extent(own.map((p) => p.x));
      if (fit && span) trends.push({ series: s, fit, x0: span[0], x1: span[1] });
    }
  return {
    points,
    groups,
    series,
    visible,
    x: axis(tx, config.xMin, config.xMax),
    y: axis(ty, config.yMin, config.yMax),
    sizeMax: Math.max(0, ...points.map((p) => (p.size !== null && p.size > 0 ? p.size : 0))),
    trends,
  };
}

export function scatterTree(config: ChartConfig, state: ChartState, uid: string): VEl {
  const { labels, locale } = config;
  const m = scatterModel(config, state.hidden);
  const fx = (v: number) => (v - m.x.lo) / (m.x.hi - m.x.lo || 1);
  const fy = (v: number) => (v - m.y.lo) / (m.y.hi - m.y.lo || 1);
  const xFmt = numberFormat(locale, config.xValueFormat);
  const yFmt = numberFormat(locale, config.valueFormat);
  const sFmt = numberFormat(locale, config.sizeFormat);
  const xAxisFmt = numberFormat(locale, axisNumberOptions(config.xValueFormat, Math.max(Math.abs(m.x.lo), Math.abs(m.x.hi))));
  const yAxisFmt = numberFormat(locale, axisNumberOptions(config.valueFormat, Math.max(Math.abs(m.y.lo), Math.abs(m.y.hi))));
  const bubbles = Boolean(config.sizeKey);
  const n = m.points.length;
  const active = state.active !== null && state.active >= 0 && state.active < n ? state.active : null;
  const focusIndex = active ?? (n ? 0 : null);
  const many = config.series.length > 1;

  // «Acme (Enterprise): Revenue 12,000, Margin 31%, Employees 420».
  const pointName = (p: ScatterPoint) => {
    const s = m.series[p.series]!;
    const sizeText =
      p.size !== null && config.sizeLabel ? `, ${fill(labels.value, { series: config.sizeLabel, value: sFmt.format(p.size) })}` : "";
    return fill(labels.scatterPoint, {
      label: p.label,
      series: many ? (p.label ? ` (${s.label})` : s.label) : "",
      x: fill(labels.value, { series: config.xLabel, value: xFmt.format(p.x) }),
      y: fill(labels.value, { series: config.yLabel, value: yFmt.format(p.y) }),
      size: sizeText,
    }).replace(/^: /, "");
  };

  const pointNodes = m.points.map((p) => {
    const s = m.series[p.series]!;
    const isActive = state.tip && p.index === active;
    return h("span", {
      key: `p:${s.key}:${p.row}`,
      class: "z-chart__point",
      role: "img",
      "data-index": p.index,
      "data-color": s.color,
      "data-pattern": s.pattern,
      "data-marker": s.marker,
      "data-bubble": on(bubbles),
      "data-active": on(isActive),
      tabindex: p.index === focusIndex ? 0 : -1,
      "aria-label": pointName(p),
      s: {
        "--x": r3(fx(p.x)),
        "--y": r3(fy(p.y)),
        "--r": `${bubbles ? bubbleRadius(p.size ?? 0, m.sizeMax) : 5}px`,
      },
    });
  });

  const svgY = (f: number) => r3((1 - f) * 100);
  const grid = config.grid
    ? [...m.y.ticks.map((t) => `M0 ${svgY(fy(t))}H100`), ...m.x.ticks.map((t) => `M${r3(fx(t) * 100)} 0V100`)].join("")
    : "";
  const trendPaths = m.trends.map((t) => {
    const s = m.series[t.series]!;
    const y0 = t.fit.slope * t.x0 + t.fit.intercept;
    const y1 = t.fit.slope * t.x1 + t.fit.intercept;
    return h("path", {
      key: `t:${s.key}`,
      class: "z-chart__trend",
      "data-color": s.color,
      d: `M${r3(fx(t.x0) * 100)} ${svgY(fy(y0))}L${r3(fx(t.x1) * 100)} ${svgY(fy(y1))}`,
    });
  });
  const svg = h(
    "svg",
    { key: "svg", class: "z-chart__svg", viewBox: "0 0 100 100", preserveAspectRatio: "none", "aria-hidden": "true", focusable: "false" },
    grid ? h("path", { key: "grid", class: "z-chart__grid", d: grid }) : null,
    h("g", { key: "marks", class: "z-chart__marks" }, ...trendPaths),
  );

  let tip: VNode = null;
  if (config.tooltip && state.tip && active !== null) {
    const p = m.points[active]!;
    const s = m.series[p.series]!;
    const row = (key: string, text: string, name: string, color?: number) =>
      h(
        "span",
        { key, class: "z-chart__tip-row" },
        h("span", { class: "z-chart__tip-key", "data-color": color, "data-total": color ? undefined : "" }),
        h("b", null, text),
        h("span", null, name),
      );
    const x = fx(p.x);
    tip = h(
      "div",
      {
        key: "tip",
        class: "z-chart__tip",
        "aria-hidden": "true",
        "data-axis": "free",
        "data-side": tipSide(x),
        s: { "--x": r3(x), "--y": r3(fy(p.y)) },
      },
      h("span", { class: "z-chart__tip-title" }, p.label || s.label),
      row("x", xFmt.format(p.x), config.xLabel),
      row("y", yFmt.format(p.y), config.yLabel, s.color),
      p.size !== null && config.sizeLabel ? row("size", sFmt.format(p.size), config.sizeLabel) : null,
    );
  }

  const valueTicks = (ticks: number[], f: (v: number) => number, nf: Intl.NumberFormat) =>
    ticks.map((t, i) => ({ at: f(t), text: nf.format(t), minor: ticks.length > 5 && i % 2 === 1 }));
  const plot = h(
    "div",
    {
      class: "z-chart__plot",
      role: "group",
      "aria-label": config.title || labels.types.scatter,
      "aria-describedby": `${uid}-summary ${uid}-hint`,
    },
    svg,
    n
      ? h("div", { key: "points", class: "z-chart__points" }, ...pointNodes)
      : h("span", { key: "empty", class: "z-chart__empty" }, labels.noData),
    tip,
  );

  const summary =
    config.summary ||
    (n
      ? [
          fill(labels.summary, {
            type: labels.types.scatter,
            count: m.visible.length,
            names: m.visible.map((i) => m.series[i]!.label).join(", "),
            points: n,
            first: xFmt.format(m.points.reduce((a, p) => Math.min(a, p.x), Number.POSITIVE_INFINITY)),
            last: xFmt.format(m.points.reduce((a, p) => Math.max(a, p.x), Number.NEGATIVE_INFINITY)),
          }),
          ...m.trends.map((t) =>
            fill(labels.trendSummary, {
              series: m.series[t.series]!.label,
              slope: numberFormat(locale, { maximumSignificantDigits: 3 }).format(t.fit.slope),
              r2: numberFormat(locale, { maximumFractionDigits: 2 }).format(t.fit.r2),
            }),
          ),
        ].join(" ")
      : labels.noData);

  const cols = [...(many ? [labels.legend] : []), config.xLabel, config.yLabel, ...(config.sizeKey ? [config.sizeLabel] : [])];
  const table = tableOf(
    config,
    uid,
    config.labelKey ? config.labelKey : "#",
    cols,
    m.points.map((p) => ({
      key: `r${p.index}`,
      head: p.label || String(p.index + 1),
      cells: [
        ...(many ? [m.series[p.series]!.label] : []),
        xFmt.format(p.x),
        yFmt.format(p.y),
        ...(config.sizeKey ? [p.size === null ? labels.missing : sFmt.format(p.size)] : []),
      ],
    })),
  );
  const items = m.series.map((s) => ({ key: s.key, label: s.label, color: s.color, pattern: s.pattern, marker: s.marker }));
  return h(
    "div",
    { ...rootAttrs(config, state), "data-markers": "" },
    h(
      "figure",
      { class: "z-chart__figure" },
      head(config, state, uid),
      legend({ ...config, markers: true }, state, items, "rect"),
      state.view === "table"
        ? table
        : h(
            "div",
            { key: "frame", class: "z-chart__frame", "data-scatter": "" },
            yAxisNode(valueTicks(m.y.ticks, fy, yAxisFmt)),
            plot,
            xAxisNode(valueTicks(m.x.ticks, fx, xAxisFmt), true),
          ),
      ...srTexts(uid, summary, labels.keyboardScatter),
    ),
  );
}
