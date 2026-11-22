// Gauge: geometría del arco (semicírculo, 240° o círculo completo), zonas con tono y aguja, sobre la aritmética del
// anillo de core/circular. El árbol (core/vnode) lo pintan igual el binding de React y el modo DOM: un `role="meter"`
// con `aria-valuetext` («72 %, Warning») y el SVG decorativo. La zona se dice con texto, no solo con color, y cada
// zona lleva además un trazo distinto (continuo, discontinuo o punteado).

import { arcPath, pointAt } from "./circular";
import { formatValue } from "./metric";
import { fill, h, type VEl } from "./vnode";
import { list, num, type Widget } from "./widget";

export type GaugeTone = "success" | "warning" | "danger" | "info" | "accent" | "neutral";
export type GaugeArc = 180 | 240 | 360;

export interface GaugeZone {
  /** Valor hasta el que llega la zona (desde el final de la anterior, o `min`). */
  to: number;
  tone: GaugeTone;
  /** Nombre de la zona: se dice con el valor («72 %, Warning»). */
  label?: string;
}

export interface GaugeLabels {
  /** «{value}, {zone}» */
  valueText: string;
}

export const GAUGE_LABELS: GaugeLabels = { valueText: "{value}, {zone}" };

export interface GaugeProps {
  value: number;
  min?: number;
  max?: number;
  /** Nombre del indicador (obligatorio para el lector). */
  label: string;
  /** Texto bajo la cifra (unidad, periodo). */
  hint?: string;
  zones?: readonly GaugeZone[];
  arc?: GaugeArc;
  /** Aguja además del arco de valor. */
  needle?: boolean;
  size?: "sm" | "md" | "lg";
  valueFormat?: Intl.NumberFormatOptions;
  locale?: string;
  labels?: Partial<GaugeLabels>;
}

const TONES: readonly GaugeTone[] = ["success", "warning", "danger", "info", "accent", "neutral"];
const toneOf = (v: unknown): GaugeTone => (TONES.includes(v as GaugeTone) ? (v as GaugeTone) : "accent");

/** Ángulo de inicio y barrido de cada arco (0 arriba, en el sentido de las agujas). */
export function gaugeSweep(arc: number | undefined): { start: number; sweep: number } {
  if (arc === 360) return { start: 0, sweep: 360 };
  if (arc === 240) return { start: 240, sweep: 240 };
  return { start: 270, sweep: 180 };
}

/** Fracción 0…1 del valor en el rango (acotada). */
export function gaugeFraction(value: number, min: number, max: number): number {
  if (!(max > min) || !Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

export interface ZoneSpan {
  from: number;
  to: number;
  tone: GaugeTone;
  label?: string;
  index: number;
}

/** Zonas ordenadas y acotadas al rango, contiguas desde `min`. Lo que quede tras la última es una zona neutra. */
export function gaugeZones(zones: readonly GaugeZone[] | undefined, min: number, max: number): ZoneSpan[] {
  const sorted = [...(zones ?? [])].filter((z) => Number.isFinite(z.to)).sort((a, b) => a.to - b.to);
  const out: ZoneSpan[] = [];
  let from = min;
  for (const z of sorted) {
    const to = Math.min(max, Math.max(min, z.to));
    if (to <= from) continue;
    out.push({ from, to, tone: toneOf(z.tone), label: z.label, index: out.length });
    from = to;
  }
  if (out.length && from < max) out.push({ from, to: max, tone: "neutral", index: out.length });
  return out;
}

/** Zona que contiene el valor (el borde superior es de la zona: 60 cae en «hasta 60»). */
export function zoneAt(spans: readonly ZoneSpan[], value: number): ZoneSpan | null {
  if (!spans.length) return null;
  for (const s of spans) if (value <= s.to) return s;
  return spans[spans.length - 1]!;
}

const R = 40;
const SIZE = 100;

/** Caja de dibujo (viewBox) que recorta el hueco de un arco abierto. */
export function gaugeViewBox(arc: number | undefined): string {
  if (arc === 360) return "0 0 100 100";
  if (arc === 240) return "0 0 100 82";
  return "0 0 100 58";
}

/** Punta y base de la aguja para una fracción. */
export function needlePoints(fraction: number, arc?: number): { tip: { x: number; y: number }; base: { x: number; y: number } } {
  const { start, sweep } = gaugeSweep(arc);
  const angle = start + fraction * sweep;
  return { tip: pointAt(angle, R - 6, SIZE), base: pointAt(0, 0, SIZE) };
}

interface Config extends Required<Pick<GaugeProps, "value" | "min" | "max" | "label" | "arc" | "needle" | "size">> {
  hint?: string;
  zones: ZoneSpan[];
  rawZones: readonly GaugeZone[];
  valueFormat?: Intl.NumberFormatOptions;
  locale?: string;
  labels: GaugeLabels;
}

function configure(p: GaugeProps): Config {
  const min = Number.isFinite(p.min) ? p.min! : 0;
  const max = Number.isFinite(p.max) && p.max! > min ? p.max! : min + 100;
  const arc: GaugeArc = p.arc === 240 || p.arc === 360 ? p.arc : 180;
  return {
    value: Number.isFinite(p.value) ? p.value : min,
    min,
    max,
    label: p.label ?? "",
    hint: p.hint,
    arc,
    needle: Boolean(p.needle),
    size: p.size === "sm" || p.size === "lg" ? p.size : "md",
    zones: gaugeZones(p.zones, min, max),
    rawZones: p.zones ?? [],
    valueFormat: p.valueFormat,
    locale: p.locale,
    labels: { ...GAUGE_LABELS, ...p.labels },
  };
}

/** Árbol del Gauge (raíz `div.z-gauge`). */
export function gaugeTree(p: GaugeProps): VEl {
  const c = configure(p);
  const { start, sweep } = gaugeSweep(c.arc);
  const fraction = gaugeFraction(c.value, c.min, c.max);
  const zone = zoneAt(c.zones, c.value);
  const shown = formatValue(c.value, c.locale, c.valueFormat);
  const valueText = zone?.label ? fill(c.labels.valueText, { value: shown, zone: zone.label }) : shown;
  const tone = zone?.tone ?? "accent";
  const kids: VEl[] = [h("path", { key: "track", class: "z-gauge__track", d: arcPath(start, sweep, R, SIZE) })];
  if (c.zones.length) {
    for (const z of c.zones) {
      const a = start + gaugeFraction(z.from, c.min, c.max) * sweep;
      const b = start + gaugeFraction(z.to, c.min, c.max) * sweep;
      // Las zonas van en un anillo fino por fuera del de valor; un hueco de 1,5° entre ellas las separa sin color.
      const gap = c.zones.length > 1 ? 0.75 : 0;
      kids.push(
        h("path", {
          key: `z${z.index}`,
          class: "z-gauge__zone",
          "data-tone": z.tone,
          "data-pattern": z.index % 3,
          d: arcPath(
            a + (z.index ? gap : 0),
            Math.max(0, b - a - (z.index ? gap : 0) - (z.index < c.zones.length - 1 ? gap : 0)),
            R + 7,
            SIZE,
          ),
        }),
      );
    }
  }
  if (fraction > 0)
    kids.push(h("path", { key: "value", class: "z-gauge__value", "data-tone": tone, d: arcPath(start, fraction * sweep, R, SIZE) }));
  if (c.needle) {
    const { tip, base } = needlePoints(fraction, c.arc);
    kids.push(h("line", { key: "needle", class: "z-gauge__needle", x1: base.x, y1: base.y, x2: tip.x, y2: tip.y }));
    kids.push(h("circle", { key: "hub", class: "z-gauge__hub", cx: base.x, cy: base.y, r: 3 }));
  }
  const zones = c.rawZones.map((z) => `${z.to}:${z.tone}${z.label ? `:${z.label}` : ""}`).join("|");
  return h(
    "div",
    {
      class: "z-gauge",
      role: "meter",
      "aria-label": c.label,
      "aria-valuenow": c.value,
      "aria-valuemin": c.min,
      "aria-valuemax": c.max,
      "aria-valuetext": valueText,
      "data-arc": c.arc,
      "data-size": c.size,
      "data-tone": tone,
      "data-value": c.value,
      "data-min": c.min,
      "data-max": c.max,
      "data-label": c.label,
      "data-hint": c.hint,
      "data-needle": c.needle ? "" : undefined,
      "data-zones": zones || undefined,
      "data-locale": c.locale,
    },
    h("svg", { class: "z-gauge__svg", viewBox: gaugeViewBox(c.arc), "aria-hidden": "true", focusable: "false" }, ...kids),
    h(
      "span",
      { class: "z-gauge__readout", "aria-hidden": "true" },
      h("span", { class: "z-gauge__number" }, shown),
      zone?.label ? h("span", { class: "z-gauge__zone-label", "data-tone": tone }, zone.label) : null,
      c.hint ? h("span", { class: "z-gauge__hint" }, c.hint) : null,
    ),
  );
}

/** Zonas de `data-zones="60:success:Healthy|85:warning:Warning|100:danger:Critical"`. */
export function parseZones(text: string | undefined): GaugeZone[] {
  return (text ?? "")
    .split("|")
    .map((part) => part.split(":"))
    .filter((bits) => bits.length >= 2 && Number.isFinite(Number(bits[0])))
    .map(([to, tone, ...label]) => ({ to: Number(to), tone: toneOf(tone), label: label.length ? label.join(":") : undefined }));
}

/** Modo DOM: `<div class="z-gauge" data-value="72" data-label="CPU" data-zones="…">` se pinta con el mismo árbol. */
export const gaugeWidget: Widget<GaugeProps, GaugeProps, null> = {
  root: "z-gauge",
  configure: (p) => p,
  initial: () => null,
  tree: (p) => gaugeTree(p),
  attach: () => () => {},
  after: () => {},
  fromDom(el, json) {
    const d = el.dataset;
    return {
      value: num(d.value, 0),
      min: d.min !== undefined ? num(d.min, 0) : undefined,
      max: d.max !== undefined ? num(d.max, 100) : undefined,
      label: d.label ?? el.getAttribute("aria-label") ?? "",
      hint: d.hint,
      arc: (Number(d.arc) as GaugeArc) || undefined,
      needle: d.needle !== undefined && d.needle !== "false",
      size: list(d.size)[0] as GaugeProps["size"],
      zones: Array.isArray(json.zones) ? (json.zones as GaugeZone[]) : parseZones(d.zones),
      valueFormat: json.valueFormat as Intl.NumberFormatOptions | undefined,
      locale: d.locale,
      labels: json.labels as Partial<GaugeLabels> | undefined,
    };
  },
};
