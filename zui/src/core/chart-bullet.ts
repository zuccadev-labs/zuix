// Gráfico de bala (BulletChart, Stephen Few) como árbol de core/chart-widget: por fila, una barra del valor sobre
// bandas de rangos cualitativos (de más oscura, la peor, a más clara) y una marca del objetivo, horizontal o
// vertical, con una escala común a todas las filas. Cada fila es enfocable con su nombre completo («Revenue: 270,
// target 250, in Good»). En HTML colocado por fracciones. Sin documento al importar.

import { axisNumberOptions, niceTicks, numberFormat, r3 } from "./chart";
import {
  type ChartConfig,
  type ChartState,
  colorOf,
  head,
  rootAttrs,
  srTexts,
  staticLegend,
  tableOf,
  value,
  xAxisNode,
  yAxisNode,
} from "./chart-parts";
import { fill, h, on, type VEl, type VNode } from "./vnode";

export interface BulletRow {
  label: string;
  value: number | null;
  target: number | null;
  ranges: number[];
  color: number;
}

export function bulletRows(config: ChartConfig): BulletRow[] {
  const key = config.series[0]?.key && config.series[0].key !== "y" ? config.series[0].key : config.valueKey;
  return config.data.map((row) => {
    const own = Array.isArray(row.ranges) ? (row.ranges as unknown[]).map(value).filter((v): v is number => v !== null) : [];
    const c = value(row.color);
    return {
      label: String(row[config.xKey] ?? ""),
      value: value(row[key]),
      target: value(row.target),
      ranges: (own.length ? own : config.ranges).slice().sort((a, b) => a - b),
      color: colorOf({ key: "", label: "", color: c ?? undefined }, 0),
    };
  });
}

/** Índice del rango que contiene `v` (el primero cuyo límite superior lo alcanza), o −1. */
export function rangeIndex(v: number, ranges: readonly number[]): number {
  for (let i = 0; i < ranges.length; i++) if (v <= ranges[i]!) return i;
  return ranges.length ? ranges.length - 1 : -1;
}

export function bulletTree(config: ChartConfig, state: ChartState, uid: string): VEl {
  const { labels, locale } = config;
  const rows = bulletRows(config);
  const n = rows.length;
  const vertical = config.orientation === "vertical";
  const top = Math.max(
    0,
    ...rows.flatMap((r) => [r.value ?? 0, r.target ?? 0, ...r.ranges]),
    ...config.data.map((row) => value(row.max) ?? 0),
  );
  const bottom = Math.min(0, ...rows.map((r) => r.value ?? 0));
  const t = niceTicks(config.yMin ?? bottom, config.yMax ?? top, config.yTicks, true);
  const lo = config.yMin ?? t.min;
  const hi = config.yMax ?? t.max;
  const f = (v: number) => Math.min(1, Math.max(0, (v - lo) / (hi - lo || 1)));
  const ticks = t.ticks.filter((v) => v >= lo - 1e-9 && v <= hi + 1e-9);
  const valueFmt = numberFormat(locale, config.valueFormat);
  const axisFmt = numberFormat(locale, axisNumberOptions(config.valueFormat, Math.max(Math.abs(lo), Math.abs(hi))));
  const fmtValue = (v: number | null) => (v === null ? labels.missing : valueFmt.format(v));
  const active = state.active !== null && state.active >= 0 && state.active < n ? state.active : null;
  const focusIndex = active ?? (n ? 0 : null);
  const rangeName = (r: BulletRow) => {
    if (r.value === null || !r.ranges.length) return "";
    const k = rangeIndex(r.value, r.ranges);
    const name = config.rangeLabels[k];
    return name ? fill(labels.inRange, { range: name }) : "";
  };
  const rowName = (r: BulletRow) =>
    fill(labels.bullet, {
      label: r.label,
      value: fmtValue(r.value),
      target: r.target === null ? "" : labels.target.toLowerCase(),
      goal: r.target === null ? "" : valueFmt.format(r.target),
      range: rangeName(r),
    })
      .replace(/, +(?=,|$)/g, "")
      .replace(/ {2,}/g, " ");
  const levels = Math.max(1, ...rows.map((r) => r.ranges.length));

  const rowNodes = rows.map((r, i) => {
    const isActive = state.tip && i === active;
    let prev = lo;
    const bands = r.ranges.map((edge, k) => {
      const a = f(prev);
      prev = edge;
      return h("span", {
        key: `g${k}`,
        class: "z-chart__range",
        // Rango 0 (el peor) el más oscuro; la escala de grises sola ya los ordena.
        "data-range": levels - r.ranges.length + k,
        "data-levels": levels,
        s: { "--a": r3(a), "--b": r3(f(edge)) },
      });
    });
    let tip: VNode = null;
    if (isActive && config.tooltip)
      tip = h(
        "span",
        {
          key: "tip",
          class: "z-chart__tip",
          "aria-hidden": "true",
          "data-axis": vertical ? "bullet-v" : "bullet-h",
          "data-side": f(Math.max(r.value ?? 0, r.target ?? 0)) > 0.6 ? "start" : "end",
          s: { "--at": r3(f(Math.max(r.value ?? 0, r.target ?? 0))) },
        },
        h("span", { class: "z-chart__tip-title" }, r.label),
        h(
          "span",
          { class: "z-chart__tip-row" },
          h("span", { class: "z-chart__tip-key", "data-color": r.color }),
          h("b", null, fmtValue(r.value)),
          h("span", null, labels.actual),
        ),
        r.target !== null
          ? h(
              "span",
              { class: "z-chart__tip-row" },
              h("span", { class: "z-chart__tip-key", "data-target": "" }),
              h("b", null, valueFmt.format(r.target)),
              h("span", null, labels.target),
            )
          : null,
        rangeName(r) && r.value !== null
          ? h("span", { class: "z-chart__tip-title" }, config.rangeLabels[rangeIndex(r.value, r.ranges)] ?? "")
          : null,
      );
    const v = r.value;
    return h(
      "div",
      { key: `r${i}`, class: "z-chart__bullet", "data-active": on(isActive) },
      h("span", { class: "z-chart__bullet-label", "aria-hidden": "true" }, r.label),
      h(
        "span",
        {
          class: "z-chart__bullet-track",
          role: "img",
          "data-index": i,
          tabindex: i === focusIndex ? 0 : -1,
          "aria-label": rowName(r),
        },
        ...bands,
        v !== null
          ? h("span", {
              key: "measure",
              class: "z-chart__measure",
              "data-color": r.color,
              "data-negative": on(v < 0),
              s: { "--a": r3(f(Math.min(0, v))), "--b": r3(f(Math.max(0, v))) },
            })
          : null,
        r.target !== null ? h("span", { key: "target", class: "z-chart__target", s: { "--at": r3(f(r.target)) } }) : null,
        tip,
      ),
    );
  });

  const axisTicks = ticks.map((v, i) => ({ at: f(v), text: axisFmt.format(v), minor: ticks.length > 5 && i % 2 === 1 }));
  const plot = h(
    "div",
    {
      class: "z-chart__plot",
      role: "group",
      "aria-label": config.title || labels.types.bullet,
      "aria-describedby": `${uid}-summary ${uid}-hint`,
      "data-bullets": "",
      s: { "--z-chart-rows": Math.max(1, n) },
    },
    n ? null : h("span", { key: "empty", class: "z-chart__empty" }, labels.noData),
    ...rowNodes,
  );

  const items = [
    { key: "value", label: labels.actual, mark: "rect", color: rows[0]?.color ?? 1 },
    ...(rows.some((r) => r.target !== null) ? [{ key: "target", label: labels.target, mark: "target" }] : []),
    ...config.rangeLabels.slice(0, levels).map((name, k) => ({ key: `range${k}`, label: name, mark: "range", range: k, levels })),
  ];
  const summary = config.summary || (n ? `${labels.types.bullet}. ${rows.map((r) => rowName(r)).join(". ")}.` : labels.noData);
  const table = tableOf(
    config,
    uid,
    config.xLabel,
    [labels.actual, labels.target, ...(config.rangeLabels.length ? [labels.band] : [])],
    rows.map((r, i) => ({
      key: `r${i}`,
      head: r.label,
      cells: [
        fmtValue(r.value),
        r.target === null ? labels.missing : valueFmt.format(r.target),
        ...(config.rangeLabels.length
          ? [r.value === null ? labels.missing : (config.rangeLabels[rangeIndex(r.value, r.ranges)] ?? "")]
          : []),
      ],
    })),
  );
  return h(
    "div",
    rootAttrs(config, state),
    h(
      "figure",
      { class: "z-chart__figure" },
      head(config, state, uid),
      staticLegend(config, items),
      state.view === "table"
        ? table
        : h(
            "div",
            { key: "frame", class: "z-chart__frame", "data-bullet": vertical ? "vertical" : "horizontal" },
            plot,
            vertical ? yAxisNode(axisTicks) : xAxisNode(axisTicks, true),
          ),
      ...srTexts(uid, summary, labels.keyboard),
    ),
  );
}
