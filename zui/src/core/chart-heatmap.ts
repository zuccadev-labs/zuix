// Mapa de calor (HeatmapChart) como árbol de core/chart-widget: una rejilla de celdas (`role="grid"` con cabeceras de
// fila y columna) coloreada por niveles de una escala secuencial o divergente, con leyenda de la escala, el valor
// en el nombre de cada celda (y escrito con `showValues`) y flechas entre celdas como en una rejilla de APG. Los
// niveles se distinguen por luminosidad (también en escala de grises); con colores forzados se escribe el valor.
// Sin documento al importar.

import { divergingLevel, extent, numberFormat, sequentialLevel, sequentialThresholds } from "./chart";
import { type ChartConfig, type ChartState, head, rootAttrs, srTexts, staticLegend, tableOf, value } from "./chart-parts";
import { fill, h, on, type VEl, type VNode } from "./vnode";

/** Niveles de la escala secuencial (`--z-heatmap-0…4`) y tramos por lado de la divergente. */
export const HEAT_LEVELS = 5;
export const HEAT_STEPS = 4;

export interface HeatModel {
  rows: string[];
  cols: string[];
  /** Valor de cada celda por filas (`null` si falta). */
  values: Array<number | null>;
  /** Fila de `data` de cada celda (−1 si no hay). */
  source: number[];
  lo: number;
  hi: number;
  mid: number;
  level: (v: number) => number;
}

export function heatModel(config: ChartConfig): HeatModel {
  const rows: string[] = [];
  const cols: string[] = [];
  for (const row of config.data) {
    const r = String(row[config.yKey] ?? "");
    const c = String(row[config.xKey] ?? "");
    if (!rows.includes(r)) rows.push(r);
    if (!cols.includes(c)) cols.push(c);
  }
  const values = new Array<number | null>(rows.length * cols.length).fill(null);
  const source = new Array<number>(rows.length * cols.length).fill(-1);
  config.data.forEach((row, i) => {
    const at = rows.indexOf(String(row[config.yKey] ?? "")) * cols.length + cols.indexOf(String(row[config.xKey] ?? ""));
    values[at] = value(row[config.valueKey]);
    source[at] = i;
  });
  const span = config.domain ?? extent(values) ?? [0, 1];
  const mid = config.midpoint;
  let [lo, hi] = span;
  if (config.scale === "diverging" && !config.domain) {
    // Simétrica alrededor del punto medio: la misma distancia pesa lo mismo a cada lado.
    const reach = Math.max(Math.abs(hi - mid), Math.abs(mid - lo));
    lo = mid - reach;
    hi = mid + reach;
  }
  const level =
    config.scale === "diverging"
      ? (v: number) => divergingLevel(v, lo, mid, hi, HEAT_STEPS)
      : (v: number) => sequentialLevel(v, lo, hi, HEAT_LEVELS);
  return { rows, cols, values, source, lo, hi, mid, level };
}

export function heatmapTree(config: ChartConfig, state: ChartState, uid: string): VEl {
  const { labels, locale } = config;
  const m = heatModel(config);
  const nr = m.rows.length;
  const nc = m.cols.length;
  const total = nr * nc;
  const valueFmt = numberFormat(locale, config.valueFormat);
  const fmtValue = (v: number | null) => (v === null ? labels.missing : valueFmt.format(v));
  const active = state.active !== null && state.active >= 0 && state.active < total ? state.active : null;
  const focusIndex = active ?? (total ? 0 : null);
  const cellName = (i: number) =>
    fill(labels.cell, { row: m.rows[Math.floor(i / nc)] ?? "", column: m.cols[i % nc] ?? "", value: fmtValue(m.values[i] ?? null) });
  const every = Math.max(1, Math.ceil(nc / 12));

  const header = h(
    "div",
    { key: "head", role: "row", class: "z-chart__mrow", "data-head": "" },
    h("span", { key: "corner", role: "columnheader", class: "z-chart__mcorner" }, h("span", { class: "z-sr-only" }, config.yLabel)),
    ...m.cols.map((c, j) =>
      h(
        "span",
        { key: `c${j}`, role: "columnheader", class: "z-chart__mcol", "data-minor": on(j % every !== 0 || (nc > 12 && j % 2 === 1)) },
        h("span", { class: "z-chart__mlabel" }, c),
      ),
    ),
  );
  const body = m.rows.map((r, ri) =>
    h(
      "div",
      { key: `r${ri}`, role: "row", class: "z-chart__mrow" },
      h("span", { role: "rowheader", class: "z-chart__mrowhead" }, r),
      ...m.cols.map((_, ci) => {
        const i = ri * nc + ci;
        const v = m.values[i] ?? null;
        const isActive = state.tip && i === active;
        let tip: VNode = null;
        if (isActive && config.tooltip)
          tip = h(
            "span",
            {
              key: "tip",
              class: "z-chart__tip",
              "aria-hidden": "true",
              "data-axis": "cell",
              "data-side": ci / Math.max(1, nc - 1) > 0.6 ? "start" : "end",
              "data-below": on(ri < 2),
            },
            h("span", { class: "z-chart__tip-title" }, `${r} · ${m.cols[ci] ?? ""}`),
            h(
              "span",
              { class: "z-chart__tip-row" },
              h("span", { class: "z-chart__tip-key", "data-level": v === null ? undefined : m.level(v) }),
              h("b", null, fmtValue(v)),
              h("span", null, config.series[0]?.label || config.valueKey),
            ),
          );
        return h(
          "span",
          {
            key: `c${ci}`,
            role: "gridcell",
            class: "z-chart__cell",
            "data-index": i,
            "data-level": v === null ? undefined : m.level(v),
            "data-empty": on(v === null),
            "data-active": on(isActive),
            tabindex: i === focusIndex ? 0 : -1,
            "aria-label": cellName(i),
          },
          h(
            "span",
            { class: config.showValues ? "z-chart__cell-value" : "z-chart__cell-value z-sr-only", "aria-hidden": "true" },
            v === null ? "" : valueFmt.format(v),
          ),
          tip,
        );
      }),
    ),
  );
  const matrix = h(
    "div",
    {
      key: "matrix",
      class: "z-chart__matrix",
      role: "grid",
      "aria-label": config.title || labels.types.heatmap,
      "aria-describedby": `${uid}-summary ${uid}-hint`,
      "aria-rowcount": nr + 1,
      "aria-colcount": nc + 1,
      "data-rows": nr,
      "data-cols": nc,
      "data-show-values": on(config.showValues),
      s: { "--z-chart-cols": nc },
    },
    header,
    ...body,
  );

  // Leyenda de la escala: un tramo por nivel con el valor desde el que empieza.
  const compact = numberFormat(locale, { ...config.valueFormat, notation: "compact", maximumFractionDigits: 1 });
  const items: Array<{ key: string; label: string; mark: string; level?: number }> = [];
  const range = (a: number, b: number) => `${compact.format(a)} – ${compact.format(b)}`;
  if (config.scale === "diverging") {
    const wn = (m.mid - m.lo) / HEAT_STEPS;
    const wp = (m.hi - m.mid) / HEAT_STEPS;
    for (let k = -HEAT_STEPS; k <= HEAT_STEPS; k++) {
      const label =
        k < 0 ? range(m.mid + k * wn, m.mid + (k + 1) * wn) : k > 0 ? range(m.mid + (k - 1) * wp, m.mid + k * wp) : compact.format(m.mid);
      items.push({ key: `l${k}`, label, mark: "level", level: k });
    }
  } else {
    const th = sequentialThresholds(m.lo, m.hi, HEAT_LEVELS);
    const w = (m.hi - m.lo) / HEAT_LEVELS;
    th.forEach((t, k) => {
      items.push({ key: `l${k}`, label: range(t, t + w), mark: "level", level: k });
    });
  }
  if (m.values.some((v) => v === null)) items.push({ key: "missing", label: labels.missing, mark: "empty" });

  const summary =
    config.summary ||
    (total
      ? (() => {
          let min = -1;
          let max = -1;
          m.values.forEach((v, i) => {
            if (v === null) return;
            if (min < 0 || v < (m.values[min] as number)) min = i;
            if (max < 0 || v > (m.values[max] as number)) max = i;
          });
          const where = (i: number) => `${m.rows[Math.floor(i / nc)]}, ${m.cols[i % nc]}`;
          return [
            `${labels.types.heatmap}: ${nr} × ${nc}.`,
            min >= 0
              ? fill(labels.range, {
                  series: config.series[0]?.label || config.valueKey,
                  min: `${fmtValue(m.values[min] ?? null)} (${where(min)})`,
                  max: `${fmtValue(m.values[max] ?? null)} (${where(max)})`,
                })
              : "",
          ]
            .filter(Boolean)
            .join(" ");
        })()
      : labels.noData);

  const table = tableOf(
    config,
    uid,
    config.yLabel,
    m.cols,
    m.rows.map((r, ri) => ({ key: `r${ri}`, head: r, cells: m.cols.map((_, ci) => fmtValue(m.values[ri * nc + ci] ?? null)) })),
  );
  return h(
    "div",
    { ...rootAttrs(config, state), "data-scale": config.scale },
    h(
      "figure",
      { class: "z-chart__figure" },
      head(config, state, uid),
      staticLegend(config, items, labels.scale),
      state.view === "table"
        ? table
        : h(
            "div",
            { key: "frame", class: "z-chart__frame", "data-heatmap": "" },
            total ? matrix : h("div", { key: "plot", class: "z-chart__plot" }, h("span", { class: "z-chart__empty" }, labels.noData)),
          ),
      ...srTexts(uid, summary, labels.keyboardGrid),
    ),
  );
}
