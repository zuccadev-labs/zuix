// Piezas de un diagrama de infraestructura sin documento: el contorno de una nube, la leyenda que se deduce del
// propio grafo (estilos de línea por categoría, grosores por valor, colores de zona y símbolos) y su descripción
// para lectores de pantalla. Puro.

import { dashArray, edgeColor, type EdgeColor, type EdgeDash, edgeWidth, type EdgeWidthScale, parseRate, SPEED_SCALE } from "./edge-style";
import type { Graph, GraphEdge } from "./graph";
import { h, icon, type VEl } from "./vnode";

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Contorno de una nube en una caja de `width` × `height`: base recta con las esquinas redondeadas y lóbulos arriba.
 * Devuelve el atributo `d` (en el sistema de la caja, con 1 px de holgura para el trazo).
 */
export function cloudPath(width: number, height: number): string {
  const w = Math.max(40, width);
  const h = Math.max(28, height);
  // Dibujo de referencia en 100 × 60; se escala por eje (los radios se vuelven elípticos).
  const sx = (w - 2) / 100;
  const sy = (h - 2) / 60;
  const px = (x: number) => r1(1 + x * sx);
  const py = (y: number) => r1(1 + y * sy);
  const arc = (r: number, x: number, y: number, large = 0) => `A ${r1(r * sx)} ${r1(r * sy)} 0 ${large} 1 ${px(x)} ${py(y)}`;
  return [`M ${px(16)} ${py(59)}`, arc(15, 10, 31, 1), arc(14, 30, 16), arc(20, 66, 12, 1), arc(13, 88, 30), arc(15, 84, 59, 1), "Z"].join(
    " ",
  );
}

export type LegendEntry =
  | {
      type: "line";
      key: string;
      label: string;
      dash: EdgeDash;
      double: boolean;
      color: EdgeColor;
      width: number;
      /** Patrón de trazo ya calculado (`stroke-dasharray`). */
      dashArray: string | null;
    }
  | { type: "width"; key: string; label: string; width: number }
  | { type: "zone"; key: string; label: string; color: EdgeColor }
  | { type: "symbol"; key: string; label: string; symbol: string };

export interface LegendOptions {
  /** Texto de cada categoría de arista (`kind`): `{ trunk: "802.1Q trunk" }`. Sin él, la propia categoría. */
  kinds?: Record<string, string>;
  /** Escala de grosores del lienzo. Por defecto la de velocidades. */
  scale?: EdgeWidthScale;
  /** Fila de grosores por valor (`weight`). Por defecto sí, si hay más de uno. */
  widths?: boolean;
  /** Zonas (nodos `zone`). Por defecto sí. */
  zones?: boolean;
  /** Símbolos que la leyenda explica además del grafo (marcas de VLAN, una etiqueta «LAN»…). */
  symbols?: { key: string; label: string; symbol: string }[];
}

/** Orden de los grosores: caudal descendente si se lee como caudal, si no por grosor. */
function byWeight(a: { weight: string | number; width: number }, b: { weight: string | number; width: number }): number {
  const ra = parseRate(a.weight);
  const rb = parseRate(b.weight);
  if (ra !== null && rb !== null) return rb - ra;
  return b.width - a.width || String(a.weight).localeCompare(String(b.weight));
}

/**
 * Leyenda de un grafo: una fila por categoría de arista (`kind`; las aristas sin categoría no entran), una por
 * cada grosor distinto, una por zona y los símbolos pedidos. En el orden en que aparecen en el modelo.
 */
export function legendFromGraph(graph: Graph, o: LegendOptions = {}): LegendEntry[] {
  const scale = o.scale ?? SPEED_SCALE;
  const out: LegendEntry[] = [];
  const kinds = new Map<string, GraphEdge>();
  for (const e of graph.edges) if (e.kind && !kinds.has(e.kind)) kinds.set(e.kind, e);
  for (const [kind, e] of kinds) {
    // La muestra de la categoría usa un grosor medio: el grosor tiene su propia fila.
    const width = e.double ? Math.max(4, edgeWidth(e, scale)) : 2;
    out.push({
      type: "line",
      key: `kind:${kind}`,
      label: o.kinds?.[kind] ?? kind,
      dash: e.dash ?? "solid",
      double: !!e.double,
      color: edgeColor(e.color, e.tone),
      width,
      dashArray: dashArray(e.dash, width),
    });
  }
  if (o.widths !== false) {
    const weights = new Map<string, { weight: string | number; width: number }>();
    for (const e of graph.edges)
      if (e.weight !== undefined && e.weight !== "" && !weights.has(String(e.weight)))
        weights.set(String(e.weight), { weight: e.weight, width: edgeWidth({ weight: e.weight }, scale) });
    const list = [...weights.values()].sort(byWeight);
    if (list.length > 1 || (list.length === 1 && o.widths === true))
      for (const w of list) out.push({ type: "width", key: `width:${w.weight}`, label: String(w.weight), width: w.width });
  }
  if (o.zones !== false)
    for (const n of graph.nodes)
      if (n.type === "zone")
        out.push({
          type: "zone",
          key: `zone:${n.id}`,
          label: String(n.data?.label ?? n.id),
          color: edgeColor(n.data?.color as string | undefined),
        });
  for (const s of o.symbols ?? []) out.push({ type: "symbol", key: `symbol:${s.key}`, label: s.label, symbol: s.symbol });
  return out;
}

/** Texto de una fila de la leyenda para lectores de pantalla («Dashed line: KVM console»). */
export interface LegendLabels {
  solid: string;
  dashed: string;
  dotted: string;
  double: string;
  width: string;
  zone: string;
}
export const LEGEND_LABELS: LegendLabels = {
  solid: "Solid line",
  dashed: "Dashed line",
  dotted: "Dotted line",
  double: "Double line",
  width: "Line width",
  zone: "Zone",
};

/** Descripción de una fila («Dashed line: KVM console»). */
export function describeLegendEntry(e: LegendEntry, labels: LegendLabels = LEGEND_LABELS): string {
  if (e.type === "line") return `${e.double ? labels.double : labels[e.dash]}: ${e.label}`;
  if (e.type === "width") return `${labels.width}: ${e.label}`;
  if (e.type === "zone") return `${labels.zone}: ${e.label}`;
  return e.label;
}

/** Valor de una variable de color (`--z-zone-color`, `--z-folder-color`) para un color de nodo, o `undefined`. */
export function colorVar(color: string | undefined): string | undefined {
  const c = edgeColor(color);
  return c.value ?? (c.tone ? `var(--z-${c.tone})` : undefined);
}

/** Proporción de dibujo de la nube (la caja del trazado; se estira con `preserveAspectRatio="none"`). */
export const CLOUD_BOX = { width: 102, height: 62 } as const;
export const CLOUD_PATH = cloudPath(CLOUD_BOX.width, CLOUD_BOX.height);

export interface FolderTabProps {
  title: string;
  /** Lo que sigue al punto («switch», «ISP router»). */
  kind?: string;
  icon?: string;
  /** Etiqueta del título: `h2`–`h6` o `span` (dentro de un lienzo). Por defecto `h3`. */
  as?: "h2" | "h3" | "h4" | "h5" | "h6" | "span";
  id?: string;
}

/** Pestaña de una tarjeta de carpeta («MikroTik · switch»). */
export function folderTabTree(p: FolderTabProps): VEl {
  return h(
    "div",
    { class: "z-folder-card__tab" },
    p.icon ? h("span", { class: "z-folder-card__icon", "aria-hidden": "true" }, icon(p.icon, 16)) : null,
    h(p.as ?? "h3", { class: "z-folder-card__title", id: p.id }, p.title),
    p.kind ? h("span", { class: "z-folder-card__kind" }, p.kind) : null,
  );
}

/** Forma de la nube (SVG decorativo que llena el nodo). */
export const cloudShapeTree = (): VEl =>
  h(
    "svg",
    {
      class: "z-node__shape",
      viewBox: `0 0 ${CLOUD_BOX.width} ${CLOUD_BOX.height}`,
      preserveAspectRatio: "none",
      "aria-hidden": "true",
      focusable: "false",
    },
    h("path", { d: CLOUD_PATH, "vector-effect": "non-scaling-stroke" }),
  );

export interface DiagramLegendProps {
  entries: LegendEntry[];
  /** Título visible. Sin él, la leyenda se nombra con `labels.legend`. */
  title?: string;
  /** Nivel del título. Por defecto 3. */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  /** Columnas: `1` (por defecto) o `2`. */
  columns?: 1 | 2;
  labels?: Partial<DiagramLegendLabels>;
}

export interface DiagramLegendLabels extends LegendLabels {
  /** Nombre de la leyenda sin título. */
  legend: string;
  /** Fila de grosores («line width = speed»). */
  widths: string;
}
export const DIAGRAM_LEGEND_LABELS: DiagramLegendLabels = { ...LEGEND_LABELS, legend: "Legend", widths: "Line width" };

const SWATCH_W = 44;
const SWATCH_H = 14;

/** Muestra de línea: la misma arista del lienzo (`.z-edge`), así la leyenda se pinta con las mismas reglas. */
function lineSwatch(e: { dash: EdgeDash; double: boolean; color: EdgeColor; width: number; dashArray: string | null }, w = SWATCH_W): VEl {
  const y = SWATCH_H / 2;
  const d = `M 3 ${y} L ${w - 3} ${y}`;
  const style: Record<string, string> = {};
  if (e.width !== 2) style["--z-edge-width"] = `${e.width}px`;
  if (e.color.value) style["--z-edge-color"] = e.color.value;
  if (e.dashArray) style["--z-edge-dash"] = e.dashArray;
  return h(
    "svg",
    {
      class: "z-diagram-legend__swatch",
      viewBox: `0 0 ${w} ${SWATCH_H}`,
      width: w,
      height: SWATCH_H,
      "aria-hidden": "true",
      focusable: "false",
    },
    h(
      "g",
      {
        class: "z-edge",
        "data-tone": e.color.tone,
        "data-color": e.color.value ? "" : undefined,
        "data-dash": e.dashArray ? e.dash : undefined,
        "data-double": e.double ? "" : undefined,
        s: Object.keys(style).length ? style : undefined,
      },
      h("path", { class: "z-edge__path", d }),
      e.double ? h("path", { class: "z-edge__core", d }) : null,
    ),
  );
}

/** Árbol de la leyenda (contrato HTML). */
export function diagramLegendTree(p: DiagramLegendProps): VEl {
  const labels = { ...DIAGRAM_LEGEND_LABELS, ...p.labels };
  const widths = p.entries.filter((e): e is Extract<LegendEntry, { type: "width" }> => e.type === "width");
  const rows: VEl[] = [];
  let widthsDone = false;
  for (const e of p.entries) {
    if (e.type === "width") {
      if (widthsDone) continue;
      widthsDone = true;
      rows.push(
        h(
          "li",
          { key: "widths", class: "z-diagram-legend__item", "data-type": "width" },
          h("span", { class: "z-diagram-legend__label" }, labels.widths),
          h(
            "span",
            { class: "z-diagram-legend__widths" },
            ...widths.map((w) =>
              h(
                "span",
                { key: w.key, class: "z-diagram-legend__width" },
                lineSwatch({ dash: "solid", double: false, color: { tone: "accent" }, width: w.width, dashArray: null }, 28),
                h("span", { class: "z-diagram-legend__value" }, w.label),
              ),
            ),
          ),
        ),
      );
      continue;
    }
    const prefix = e.type === "line" ? (e.double ? labels.double : labels[e.dash]) : e.type === "zone" ? labels.zone : "";
    const sr = prefix ? h("span", { class: "z-sr-only" }, `${prefix}: `) : null;
    let swatch: VEl;
    if (e.type === "line") swatch = lineSwatch(e);
    else if (e.type === "zone")
      swatch = h("span", {
        class: "z-diagram-legend__zone",
        "aria-hidden": "true",
        s: e.color.value || e.color.tone ? { "--z-zone-color": e.color.value ?? `var(--z-${e.color.tone})` } : undefined,
      });
    else if (e.symbol === "vlan")
      swatch = h(
        "span",
        { class: "z-diagram-legend__symbol z-port__vlans", "aria-hidden": "true" },
        h("span", { class: "z-port__vlan", "data-untagged": "", s: { "--z-vlan-color": "var(--z-chart-1)" } }),
        h("span", { class: "z-port__vlan", s: { "--z-vlan-color": "var(--z-chart-2)" } }),
        h("span", { class: "z-port__vlan", s: { "--z-vlan-color": "var(--z-chart-4)" } }),
      );
    else if (e.symbol.startsWith("chip:"))
      swatch = h("span", { class: "z-diagram-legend__chip", "aria-hidden": "true" }, e.symbol.slice(5));
    else if (e.symbol.startsWith("text:"))
      swatch = h("span", { class: "z-diagram-legend__text", "aria-hidden": "true" }, e.symbol.slice(5));
    else if (e.symbol === "share") swatch = h("span", { class: "z-diagram-legend__share", "aria-hidden": "true" });
    else swatch = h("span", { class: "z-diagram-legend__symbol", "aria-hidden": "true" }, icon(e.symbol, 16));
    rows.push(
      h(
        "li",
        { key: e.key, class: "z-diagram-legend__item", "data-type": e.type },
        h("span", { class: "z-diagram-legend__key" }, swatch),
        h("span", { class: "z-diagram-legend__label" }, sr, e.label),
      ),
    );
  }
  const level = `h${p.headingLevel ?? 3}`;
  return h(
    "section",
    { class: "z-diagram-legend", "aria-label": p.title ? undefined : labels.legend, "data-columns": p.columns === 2 ? "2" : undefined },
    p.title ? h(level, { class: "z-diagram-legend__title" }, p.title) : null,
    h("ul", { class: "z-diagram-legend__list", role: "list" }, ...rows),
  );
}
