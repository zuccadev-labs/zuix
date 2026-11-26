// Barra por categorías (CategoryBar, al estilo de Tremor): una barra partida en tramos proporcionales a sus valores, con
// marcador opcional sobre la misma escala, rótulos acumulados en los límites y leyenda. Cada tramo es enfocable con su
// nombre («Good: 30 (30%)»): una parada de Tab, flechas entre tramos y tooltip al pasar o enfocar. Un solo árbol
// (core/vnode) para React y para el modo DOM. Sin documento al importar.
import { localize } from "./locale";

import { numberFormat, r3, segmentLayout } from "./chart";
import { fill, h, on, type VEl, type VNode } from "./vnode";
import { num, type Widget, type WidgetHost } from "./widget";

export interface CategoryBarLabels {
  /** «{label}: {value} ({percent})». */
  segment: string;
  /** «Marker: {value}». */
  marker: string;
  /** Nombre del grupo de tramos si no hay `label`. */
  bar: string;
  legend: string;
  keyboard: string;
  noData: string;
}

export const CATEGORY_BAR_LABELS: CategoryBarLabels = {
  segment: "{label}: {value} ({percent})",
  marker: "Marker: {value}",
  bar: "Category bar",
  legend: "Categories",
  keyboard: "Use the arrow keys to move between segments.",
  noData: "No data",
};

export interface CategoryBarMarker {
  value: number;
  /** Texto del marcador en el tooltip y el nombre accesible (por defecto, el valor). */
  label?: string;
}

export interface CategoryBarProps {
  /** Ancho de cada tramo (se reparten sobre su suma). */
  values?: ReadonlyArray<number>;
  /** Nombre de cada tramo. */
  categories?: ReadonlyArray<string>;
  /** Color de serie 1–8 de cada tramo (por defecto, su posición). */
  colors?: ReadonlyArray<number>;
  marker?: CategoryBarMarker;
  /** Rótulos acumulados en los límites de los tramos (0, 40, 70, 100). */
  showLabels?: boolean;
  /** Leyenda con el nombre y el valor de cada tramo. */
  legend?: boolean;
  tooltip?: boolean;
  /** Trama por tramo además del color. */
  patterns?: boolean;
  /** Nombre del conjunto (título accesible del grupo de tramos). */
  label?: string;
  valueFormat?: Intl.NumberFormatOptions;
  locale?: string;
  labels?: Partial<CategoryBarLabels>;
}

export interface CategoryBarConfig {
  values: number[];
  categories: string[];
  colors: number[];
  marker?: CategoryBarMarker;
  showLabels: boolean;
  legend: boolean;
  tooltip: boolean;
  patterns: boolean;
  label: string;
  valueFormat: Intl.NumberFormatOptions;
  locale?: string;
  labels: CategoryBarLabels;
}

export interface CategoryBarState {
  active: number | null;
  tip: boolean;
}

const clampColor = (c: number) => ((((Math.round(c) - 1) % 8) + 8) % 8) + 1;

export const categoryBarWidget: Widget<CategoryBarProps, CategoryBarConfig, CategoryBarState> = {
  root: "z-category-bar",
  configure(p) {
    const values = (Array.isArray(p.values) ? p.values : []).map((v) => (Number.isFinite(v) ? Number(v) : 0));
    return {
      values,
      categories: values.map((_, i) => String(p.categories?.[i] ?? "")),
      colors: values.map((_, i) => clampColor(p.colors?.[i] ?? i + 1)),
      marker: p.marker && Number.isFinite(p.marker.value) ? p.marker : undefined,
      showLabels: Boolean(p.showLabels),
      legend: Boolean(p.legend),
      tooltip: p.tooltip !== false,
      patterns: Boolean(p.patterns),
      label: p.label ?? "",
      valueFormat: p.valueFormat ?? {},
      locale: p.locale,
      labels: { ...localize("categoryBar", CATEGORY_BAR_LABELS), ...p.labels },
    };
  },
  initial: () => ({ active: null, tip: false }),
  tree: categoryBarTree,
  attach: attachCategoryBar,
  after(root, _host, focus) {
    if (!focus) return;
    const target = root.querySelector<HTMLElement>('[data-index][tabindex="0"]');
    if (target && target !== root.ownerDocument.activeElement) target.focus({ preventScroll: true });
  },
  fromDom(el, json) {
    const d = el.dataset;
    return {
      values: Array.isArray(json.values) ? (json.values as number[]) : undefined,
      categories: Array.isArray(json.categories) ? (json.categories as string[]) : undefined,
      colors: Array.isArray(json.colors) ? (json.colors as number[]) : undefined,
      marker:
        (json.marker as CategoryBarMarker | undefined) ??
        (d.marker !== undefined ? { value: num(d.marker, Number.NaN), label: d.markerLabel } : undefined),
      showLabels: d.showLabels !== undefined && d.showLabels !== "false",
      legend: d.legend !== undefined && d.legend !== "false",
      tooltip: d.tooltip !== "false",
      patterns: d.patterns !== undefined && d.patterns !== "false",
      label: d.label,
      valueFormat: json.valueFormat as Intl.NumberFormatOptions | undefined,
      locale: d.locale,
      labels: json.labels as Partial<CategoryBarLabels> | undefined,
    };
  },
};

export function categoryBarTree(config: CategoryBarConfig, state: CategoryBarState, uid: string): VEl {
  const { labels } = config;
  const { segments, total } = segmentLayout(config.values);
  const f = numberFormat(config.locale, config.valueFormat);
  const pct = numberFormat(config.locale, { style: "percent", maximumFractionDigits: 1 });
  const shown = segments.filter((s) => s.value > 0);
  const active = state.active !== null && shown.some((s) => s.index === state.active) ? state.active : null;
  const focusIndex = active ?? shown[0]?.index ?? null;
  const name = (i: number) =>
    fill(labels.segment, {
      label: config.categories[i] || String(i + 1),
      value: f.format(config.values[i] ?? 0),
      percent: pct.format(total ? (config.values[i] ?? 0) / total : 0),
    });
  const markerAt = config.marker && total > 0 ? Math.min(1, Math.max(0, config.marker.value / total)) : null;
  const markerText = config.marker ? (config.marker.label ?? f.format(config.marker.value)) : "";
  const segNodes = shown.map((s) => {
    const isActive = state.tip && s.index === active;
    const center = (s.start + s.end) / 2;
    let tip: VNode = null;
    if (isActive && config.tooltip)
      tip = h(
        "span",
        {
          key: "tip",
          class: "z-category-bar__tip",
          "aria-hidden": "true",
          "data-side": center > 0.6 ? "start" : center < 0.4 ? "end" : undefined,
        },
        h("b", null, f.format(s.value)),
        h("span", null, `${config.categories[s.index] || String(s.index + 1)} · ${pct.format(total ? s.value / total : 0)}`),
      );
    return h(
      "span",
      {
        key: `s${s.index}`,
        class: "z-category-bar__segment",
        role: "img",
        "data-index": s.index,
        "data-color": config.colors[s.index],
        "data-pattern": s.index % 4,
        "data-active": on(isActive),
        tabindex: s.index === focusIndex ? 0 : -1,
        "aria-label": name(s.index),
        s: { "--a": r3(s.start), "--b": r3(s.end) },
      },
      tip,
    );
  });
  const summaryId = `${uid}-summary`;
  const summary = shown.length
    ? `${shown.map((s) => name(s.index)).join(", ")}.${config.marker ? ` ${fill(labels.marker, { value: markerText })}.` : ""}`
    : labels.noData;
  // Rótulos acumulados; uno a menos de un 12 % del anterior cede (el del final siempre se ve).
  const ticks: number[] = [];
  if (config.showLabels && total > 0)
    for (const t of [0, ...segments.filter((s) => s.value > 0).map((s) => s.cumulative)]) {
      const last = ticks[ticks.length - 1];
      if (last !== undefined && (t - last) / total < 0.12) {
        if (t === total && ticks.length > 1) ticks[ticks.length - 1] = t;
        continue;
      }
      ticks.push(t);
    }
  return h(
    "div",
    {
      class: "z-category-bar",
      "data-patterns": on(config.patterns),
      "data-active": on(state.tip && active !== null),
    },
    h(
      "div",
      {
        key: "track",
        class: "z-category-bar__track",
        role: "group",
        "aria-label": config.label || labels.bar,
        "aria-describedby": `${summaryId} ${uid}-hint`,
      },
      ...segNodes,
      shown.length ? null : h("span", { key: "empty", class: "z-category-bar__empty" }, labels.noData),
      markerAt !== null
        ? h("span", { key: "marker", class: "z-category-bar__marker", "aria-hidden": "true", s: { "--at": r3(markerAt) } })
        : null,
    ),
    ticks.length
      ? h(
          "div",
          { key: "ticks", class: "z-category-bar__ticks", "aria-hidden": "true" },
          ...ticks.map((t, i) =>
            h(
              "span",
              {
                key: `t${i}`,
                class: "z-category-bar__tick",
                "data-edge": i === 0 ? "start" : i === ticks.length - 1 ? "end" : undefined,
                s: { "--at": r3(t / total) },
              },
              f.format(t),
            ),
          ),
        )
      : null,
    config.legend && shown.length
      ? h(
          "ul",
          { key: "legend", class: "z-category-bar__legend", "aria-label": labels.legend },
          ...shown.map((s) =>
            h(
              "li",
              { key: `k${s.index}`, class: "z-category-bar__key" },
              h("span", {
                class: "z-category-bar__swatch",
                "data-color": config.colors[s.index],
                "data-pattern": s.index % 4,
                "aria-hidden": "true",
              }),
              h("span", null, config.categories[s.index] || String(s.index + 1)),
              h("span", { class: "z-category-bar__key-value" }, f.format(s.value)),
            ),
          ),
        )
      : null,
    h("p", { key: "summary", class: "z-sr-only", id: summaryId }, summary),
    h("p", { key: "hint", class: "z-sr-only", id: `${uid}-hint` }, labels.keyboard),
  );
}

function attachCategoryBar(root: HTMLElement, host: WidgetHost<CategoryBarConfig, CategoryBarState>): () => void {
  const abort = new AbortController();
  const signal = abort.signal;
  const order = () => [...root.querySelectorAll<HTMLElement>(".z-category-bar__segment")].map((el) => Number(el.dataset.index));
  const rtl = () => root.closest("[dir]")?.getAttribute("dir") === "rtl";
  const select = (i: number, focus: boolean) => {
    const s = host.state();
    if (s.active !== i || !s.tip) host.update({ active: i, tip: true }, focus);
  };
  const indexOf = (target: EventTarget | null) => {
    const el = (target as Element | null)?.closest?.<HTMLElement>(".z-category-bar__segment");
    return el && root.contains(el) ? Number(el.dataset.index) : null;
  };
  root.addEventListener(
    "keydown",
    (event) => {
      const i = indexOf(event.target);
      if (i === null) return;
      const list = order();
      const at = list.indexOf(i);
      let key = event.key;
      if (rtl()) key = key === "ArrowLeft" ? "ArrowRight" : key === "ArrowRight" ? "ArrowLeft" : key;
      let next: number | null = null;
      if (key === "ArrowRight" || key === "ArrowDown") next = list[Math.min(list.length - 1, at + 1)]!;
      else if (key === "ArrowLeft" || key === "ArrowUp") next = list[Math.max(0, at - 1)]!;
      else if (key === "Home") next = list[0]!;
      else if (key === "End") next = list[list.length - 1]!;
      else if (key === "Escape") {
        if (host.state().tip) {
          event.preventDefault();
          host.update({ tip: false });
        }
        return;
      } else return;
      event.preventDefault();
      host.update({ active: next, tip: true }, true);
    },
    { signal },
  );
  root.addEventListener(
    "focusin",
    (event) => {
      const i = indexOf(event.target);
      if (i !== null) select(i, false);
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
      const i = indexOf(event.target);
      if (i !== null) select(i, false);
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
  root.addEventListener(
    "click",
    (event) => {
      const i = indexOf(event.target);
      if (i !== null) select(i, true);
    },
    { signal },
  );
  return () => abort.abort();
}
