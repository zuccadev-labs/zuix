// Radar (RadarChart) como árbol de core/chart-widget: un eje radial por fila de `data`, una serie por polígono con
// relleno translúcido, retícula poligonal o circular con escala configurable (`yMin`, `yMax`, `yTicks`) y una cuña
// enfocable por eje con los valores de todas las series. En SVG (viewBox 100 × 100 cuadrado) con rótulos en HTML
// colocados por fracciones. Sin documento al importar.
import { formatList } from "./locale";

import { extent, niceTicks, numberFormat, polarPoint, r3, radarPath, radarWedge } from "./chart";
import {
  type ChartConfig,
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
} from "./chart-parts";
import { fill, h, on, type VEl, type VNode } from "./vnode";

/** Radio de la retícula en el viewBox (deja sitio a los rótulos de los ejes). */
const R = 40;

export function radarTree(config: ChartConfig, state: ChartState, uid: string): VEl {
  const { labels, data, locale } = config;
  const n = data.length;
  const axes = data.map((row) => String(row[config.xKey] ?? ""));
  const all = config.series.map((s, i) => ({
    ...s,
    index: i,
    color: colorOf(s, i),
    pattern: i % 4,
    marker: markerOf(s, i),
    values: data.map((row) => value(row[s.key])),
  }));
  const visible = all.filter((s) => !state.hidden.includes(s.key));
  const span = extent(visible.flatMap((s) => s.values));
  const t = niceTicks(config.yMin ?? Math.min(0, span?.[0] ?? 0), config.yMax ?? span?.[1] ?? 1, config.yTicks, config.yMin === undefined);
  const lo = config.yMin ?? t.min;
  const hi = config.yMax ?? t.max;
  const f = (v: number) => Math.min(1, Math.max(0, (v - lo) / (hi - lo || 1)));
  const rings = t.ticks.filter((v) => v > lo + 1e-9 && v <= hi + 1e-9);
  const valueFmt = numberFormat(locale, config.valueFormat);
  const fmtValue = (v: number | null) => (v === null ? labels.missing : valueFmt.format(v));
  const active = state.active !== null && state.active >= 0 && state.active < n ? state.active : null;
  const focusIndex = active ?? (n ? 0 : null);
  const axisName = (i: number) =>
    fill(labels.point, {
      x: axes[i] ?? "",
      values: visible.map((s) => fill(labels.value, { series: s.label, value: fmtValue(s.values[i] ?? null) })).join(", "),
    });

  const ringPath = (fr: number) =>
    config.gridShape === "circle"
      ? `M${50 - R * fr} 50a${R * fr} ${R * fr} 0 1 0 ${2 * R * fr} 0a${R * fr} ${R * fr} 0 1 0 ${-2 * R * fr} 0`
      : radarPath(
          axes.map(() => fr),
          R,
        );
  const grid = config.grid && n >= 3 ? rings.map((v) => ringPath(f(v))).join("") : "";
  const spokes = axes
    .map((_, i) => {
      const [x, y] = polarPoint(i, n, 1, R);
      return `M50 50L${x} ${y}`;
    })
    .join("");
  const areas = visible.map((s) =>
    h("path", {
      key: `a:${s.key}`,
      class: "z-chart__radar",
      d: radarPath(
        s.values.map((v) => (v === null ? null : f(v))),
        R,
      ),
      "data-color": s.color,
      "data-pattern": s.pattern,
    }),
  );
  const wedges = axes.map((_, i) =>
    h("path", {
      key: `w${i}`,
      class: "z-chart__wedge",
      d: radarWedge(i, n, 49),
      role: "img",
      "data-index": i,
      "data-active": on(state.tip && i === active),
      tabindex: i === focusIndex ? 0 : -1,
      "aria-label": axisName(i),
    }),
  );
  const svg = h(
    "svg",
    { key: "svg", class: "z-chart__svg", viewBox: "0 0 100 100", focusable: "false" },
    grid ? h("path", { key: "grid", class: "z-chart__grid", d: grid }) : null,
    n ? h("path", { key: "spokes", class: "z-chart__spoke", d: spokes }) : null,
    active !== null && state.tip
      ? h("path", { key: "focus-spoke", class: "z-chart__spoke", "data-active": "", d: `M50 50L${polarPoint(active, n, 1, R).join(" ")}` })
      : null,
    h("g", { key: "marks", class: "z-chart__marks" }, ...areas),
    h("g", { key: "wedges", class: "z-chart__wedges" }, ...wedges),
  );

  // Vértices: todos con `markers` y siempre los del eje activo.
  const dots: VNode[] = [];
  for (const s of visible)
    s.values.forEach((v, i) => {
      if (v === null) return;
      const show = config.markers || (state.tip && i === active);
      if (!show) return;
      const [x, y] = polarPoint(i, n, f(v), R);
      dots.push(
        h("span", {
          key: `d:${s.key}:${i}`,
          class: "z-chart__dot",
          "data-color": s.color,
          "data-marker": config.markers ? s.marker : "circle",
          "data-active": on(state.tip && i === active),
          "aria-hidden": "true",
          s: { "--x": r3(x / 100), "--y": r3(1 - y / 100) },
        }),
      );
    });

  // Rótulos de los ejes por fuera de la retícula, anclados hacia fuera según su lado.
  const axisLabels = axes.map((text, i) => {
    const [x, y] = polarPoint(i, n, 1.08, R);
    return h(
      "span",
      {
        key: `l${i}`,
        class: "z-chart__radar-label",
        "data-inline": x < 47 ? "end" : x > 53 ? "start" : "center",
        "data-block": y < 40 ? "end" : y > 60 ? "start" : "center",
        "data-active": on(state.tip && i === active),
        s: { "--x": r3(x / 100), "--y": r3(1 - y / 100) },
      },
      text,
    );
  });
  // La escala va escrita bajo el radar y no sobre los anillos: un rótulo encima de la retícula pisa sus trazos.
  const step = rings.length > 1 ? rings[1]! - rings[0]! : hi - lo;
  const scaleNote = n
    ? h(
        "p",
        { key: "scale", class: "z-chart__scale-note" },
        fill(labels.radarScale, { min: valueFmt.format(lo), max: valueFmt.format(hi), step: valueFmt.format(step) }),
      )
    : null;

  let tip: VNode = null;
  if (config.tooltip && state.tip && active !== null && visible.length) {
    const [x, y] = polarPoint(active, n, 1, R);
    tip = h(
      "div",
      {
        key: "tip",
        class: "z-chart__tip",
        "aria-hidden": "true",
        "data-axis": "free",
        "data-side": tipSide(x / 100),
        s: { "--x": r3(x / 100), "--y": r3(1 - y / 100) },
      },
      h("span", { class: "z-chart__tip-title" }, axes[active] ?? ""),
      ...visible.map((s) =>
        h(
          "span",
          { key: s.key, class: "z-chart__tip-row" },
          h("span", { class: "z-chart__tip-key", "data-color": s.color, "data-pattern": s.pattern }),
          h("b", null, fmtValue(s.values[active] ?? null)),
          h("span", null, s.label),
        ),
      ),
    );
  }

  const plot = h(
    "div",
    {
      class: "z-chart__plot",
      role: "group",
      "aria-label": config.title || labels.types.radar,
      "aria-describedby": `${uid}-summary ${uid}-hint`,
    },
    svg,
    h("div", { key: "labels", class: "z-chart__radar-labels", "aria-hidden": "true" }, ...axisLabels),
    dots.length ? h("div", { key: "dots", class: "z-chart__dots" }, ...dots) : null,
    n ? null : h("span", { key: "empty", class: "z-chart__empty" }, labels.noData),
    tip,
  );

  const summary =
    config.summary ||
    (n && visible.length
      ? [
          fill(labels.summary, {
            type: labels.types.radar,
            count: visible.length,
            names: formatList(visible.map((s) => s.label)),
            points: n,
            first: axes[0] ?? "",
            last: axes[n - 1] ?? "",
          }),
          ...visible.map((s) => {
            const e = extent(s.values);
            return e ? fill(labels.range, { series: s.label, min: valueFmt.format(e[0]), max: valueFmt.format(e[1]) }) : "";
          }),
        ]
          .filter(Boolean)
          .join(" ")
      : labels.noData);
  const table = tableOf(
    config,
    uid,
    config.xLabel,
    visible.map((s) => s.label),
    axes.map((a, i) => ({ key: `r${i}`, head: a, cells: visible.map((s) => fmtValue(s.values[i] ?? null)) })),
  );
  const items = all.map((s) => ({ key: s.key, label: s.label, color: s.color, pattern: s.pattern, marker: s.marker }));
  return h(
    "div",
    { ...rootAttrs(config, state), "data-grid-shape": config.gridShape },
    h(
      "figure",
      { class: "z-chart__figure" },
      head(config, state, uid),
      legend(config, state, items, "rect"),
      state.view === "table" ? table : h("div", { key: "frame", class: "z-chart__frame", "data-radar": "" }, plot, scaleNote),
      ...srTexts(uid, summary, labels.keyboard),
    ),
  );
}
