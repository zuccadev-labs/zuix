// Minigráfico (sparkline): una serie sin ejes en línea, área o barras, con el último valor marcado. Es una imagen con
// nombre («Visits: from 120 to 340, low 98, high 340»), sin interacción: el valor exacto va en el texto que la
// acompaña. Un solo árbol (core/vnode) para React (sin estado: vale en un Server Component) y para el modo DOM.
import { localize } from "./locale";

import { areaPath, bandScale, extent, linePath, numberFormat, type Curve, type Point, r3 } from "./chart";
import { fill, h, type VEl } from "./vnode";
import type { Widget } from "./widget";

export interface SparklineLabels {
  /** «{label}: from {first} to {last}, low {min}, high {max}». */
  summary: string;
  noData: string;
}

export const SPARKLINE_LABELS: SparklineLabels = {
  summary: "{label}: from {first} to {last}, low {min}, high {max}",
  noData: "No data",
};

export interface SparklineProps {
  values?: ReadonlyArray<number | null>;
  type?: "line" | "area" | "bar";
  /** Color de serie 1–8 (`--z-chart-N`). */
  color?: number;
  /** Nombre de lo que se mide (entra en el nombre accesible). */
  label?: string;
  /** Nombre accesible completo (sustituye al resumen calculado). */
  ariaLabel?: string;
  curve?: Curve;
  /** Marca el último valor (línea y área). */
  showEnd?: boolean;
  /** Incluye el 0 en la escala (por defecto, en barras). */
  zero?: boolean;
  valueFormat?: Intl.NumberFormatOptions;
  locale?: string;
  labels?: Partial<SparklineLabels>;
}

const clean = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? n : null;
};

/** Árbol del minigráfico (raíz `span.z-sparkline`). */
export function sparklineTree(p: SparklineProps): VEl {
  const values = (p.values ?? []).map(clean);
  const type = p.type === "area" || p.type === "bar" ? p.type : "line";
  const color = Math.min(8, Math.max(1, Math.round(p.color ?? 1)));
  const labels = { ...localize("sparkline", SPARKLINE_LABELS), ...p.labels };
  const zero = p.zero ?? type === "bar";
  const span = extent(values);
  const f = numberFormat(p.locale, p.valueFormat ?? {});
  const known = values.filter((v): v is number => v !== null);
  const name =
    p.ariaLabel ??
    (span && known.length
      ? fill(labels.summary, {
          label: p.label ?? "",
          first: f.format(known[0]!),
          last: f.format(known[known.length - 1]!),
          min: f.format(span[0]),
          max: f.format(span[1]),
        }).replace(/^: /, "")
      : labels.noData);
  let lo = span ? span[0] : 0;
  let hi = span ? span[1] : 1;
  if (zero) {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
  }
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  // Un pequeño margen arriba y abajo para que el trazo de 1,5 px no se corte en los extremos.
  const pad = type === "bar" ? 0 : (hi - lo) * 0.08;
  const y = (v: number) => (v - (lo - pad)) / (hi + pad - (lo - pad));
  const n = values.length;
  const xs = values.map((_, i) => (n === 1 ? 0.5 : i / (n - 1)));
  const kids: VEl[] = [];
  let end: VEl | null = null;
  if (type === "bar") {
    const band = bandScale(n, 0.25, 0.05);
    const base = y(Math.max(lo, Math.min(0, hi)));
    kids.push(
      ...values.flatMap((v, i) => {
        if (v === null) return [];
        const a = Math.min(base, y(v));
        const b = Math.max(base, y(v));
        return [
          h("rect", {
            key: `b${i}`,
            class: "z-sparkline__bar",
            x: r3(band.start(i) * 100),
            width: r3(band.bandwidth * 100),
            y: r3((1 - b) * 100),
            height: r3(Math.max(0.5, (b - a) * 100)),
            "data-last": i === n - 1 ? "" : undefined,
          }),
        ];
      }),
    );
  } else {
    const pts: Point[] = values.map((v, i) => (v === null ? null : [r3(xs[i]! * 100), r3((1 - y(v)) * 100)]));
    if (type === "area") {
      const floor = y(zero ? 0 : lo - pad);
      kids.push(
        h("path", {
          key: "a",
          class: "z-sparkline__area",
          d: areaPath(
            pts,
            values.map((_, i) => [r3(xs[i]! * 100), r3((1 - floor) * 100)] as const),
            p.curve ?? "linear",
          ),
        }),
      );
    }
    kids.push(h("path", { key: "l", class: "z-sparkline__line", d: linePath(pts, p.curve ?? "linear") }));
    const last = values.length - 1;
    if (p.showEnd !== false && last >= 0 && values[last] !== null)
      end = h("span", { class: "z-sparkline__end", "aria-hidden": "true", s: { "--x": r3(xs[last]!), "--y": r3(y(values[last]!)) } });
  }
  return h(
    "span",
    {
      class: "z-sparkline",
      role: "img",
      "aria-label": name,
      "data-type": type,
      "data-color": color,
      // La configuración viaja en el marcado: el modo DOM vuelve a pintar el mismo minigráfico desde el HTML del
      // servidor (o del contrato) sin datos aparte.
      "data-values": values.map((v) => (v === null ? "" : v)).join(","),
      "data-label": p.label,
      "data-aria-label": p.ariaLabel,
      "data-curve": p.curve,
      "data-end": p.showEnd === false ? "false" : undefined,
      "data-zero": p.zero === undefined ? undefined : String(p.zero),
      "data-locale": p.locale,
    },
    h(
      "svg",
      { class: "z-sparkline__svg", viewBox: "0 0 100 100", preserveAspectRatio: "none", "aria-hidden": "true", focusable: "false" },
      ...kids,
    ),
    end,
  );
}

/** Modo DOM: `<span class="z-sparkline" data-values="3,5,4,8" data-label="Visits">` se pinta con el mismo árbol. */
export const sparklineWidget: Widget<SparklineProps, SparklineProps, null> = {
  root: "z-sparkline",
  configure: (p) => p,
  initial: () => null,
  tree: (config) => sparklineTree(config),
  attach: () => () => {},
  after: () => {},
  fromDom(el, json) {
    const d = el.dataset;
    return {
      values: Array.isArray(json.values)
        ? (json.values as number[])
        : (d.values ?? "")
            .split(",")
            .map((v) => (v.trim() === "" ? null : Number(v)))
            .filter((v, _i, all) => all.length > 1 || v !== null),
      type: (d.type as SparklineProps["type"]) ?? undefined,
      color: d.color !== undefined ? Number(d.color) : undefined,
      label: d.label,
      ariaLabel: d.ariaLabel,
      curve: (d.curve as Curve) ?? undefined,
      showEnd: d.end !== "false",
      zero: d.zero === undefined ? undefined : d.zero !== "false",
      valueFormat: json.valueFormat as Intl.NumberFormatOptions | undefined,
      locale: d.locale,
      labels: json.labels as Partial<SparklineLabels> | undefined,
    };
  },
};
