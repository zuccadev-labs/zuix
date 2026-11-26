// Estilo de una arista de diagrama: grosor por valor (la velocidad de un enlace, un caudal) con escala configurable,
// trazo continuo, discontinuo o punteado, línea doble con núcleo (troncal), color por token o color libre y
// posición de las etiquetas de los extremos. Todo es opcional: una arista sin estos campos se pinta como siempre.
// Puro, sin documento.

import type { Point } from "./viewport";

export type EdgeDash = "solid" | "dashed" | "dotted";
export const EDGE_DASHES: readonly EdgeDash[] = ["solid", "dashed", "dotted"];
export const EDGE_TONES = ["neutral", "accent", "success", "warning", "danger", "info"] as const;
export type EdgeTone = (typeof EDGE_TONES)[number];

/** Escala de grosores: valor (`"10G"`, `"1G"`, `"high"`) → grosor en px. */
export type EdgeWidthScale = Readonly<Record<string, number>>;

/** Velocidades de enlace habituales. Lo que no esté aquí y se lea como caudal se interpola en escala logarítmica. */
export const SPEED_SCALE: EdgeWidthScale = {
  "10M": 1,
  "100M": 1.25,
  "1G": 2,
  "2.5G": 3,
  "5G": 3.75,
  "10G": 5.5,
  "25G": 7,
  "40G": 8,
  "100G": 10,
};

/** Grosor por defecto de una arista (el de la hoja). */
export const DEFAULT_EDGE_WIDTH = 2;
const MIN_WIDTH = 0.75;
const MAX_WIDTH = 16;

const UNITS: Record<string, number> = { k: 1e3, m: 1e6, g: 1e9, t: 1e12 };

/**
 * Caudal en bit/s de un texto como `"10G"`, `"2.5 Gbit/s"`, `"600 Mbit/s"`, `"100M"` o `"1 Gbps"`; `null` si no lo es.
 * Un número suelto se lee como bit/s.
 */
export function parseRate(value: string | number | undefined | null): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== "string") return null;
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*([kmgt])?(?:b(?:it)?(?:\/s|ps)?|bps)?\s*$/i.exec(value);
  if (!m) return null;
  const n = Number.parseFloat(m[1]!.replace(",", "."));
  const mult = m[2] ? UNITS[m[2].toLowerCase()]! : 1;
  const out = n * mult;
  return out > 0 ? out : null;
}

const clampWidth = (w: number) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w));

/**
 * Grosor para un valor según la escala. Busca primero la clave exacta (sin distinguir mayúsculas ni espacios); si el
 * valor se lee como caudal y la escala tiene caudales, interpola en escala logarítmica entre los dos más cercanos (y
 * extrapola con la pendiente del extremo). Un número sin escala que lo nombre es el grosor mismo.
 */
export function scaleWidth(value: string | number | undefined, scale: EdgeWidthScale = SPEED_SCALE): number | null {
  if (value === undefined || value === null || value === "") return null;
  const key = String(value).replace(/\s+/g, "").toLowerCase();
  for (const [k, w] of Object.entries(scale)) if (k.replace(/\s+/g, "").toLowerCase() === key) return clampWidth(w);
  const rate = parseRate(value);
  const points = Object.entries(scale)
    .map(([k, w]) => [parseRate(k), w] as const)
    .filter((p): p is readonly [number, number] => p[0] !== null)
    .sort((a, b) => a[0] - b[0]);
  if (rate !== null && points.length >= 2 && typeof value === "string") {
    const lx = Math.log10(rate);
    let i = points.findIndex((p) => p[0] >= rate);
    if (i <= 0) i = i === 0 ? 1 : points.length - 1;
    const [x0, y0] = points[i - 1]!;
    const [x1, y1] = points[i]!;
    const t = (lx - Math.log10(x0)) / (Math.log10(x1) - Math.log10(x0));
    return clampWidth(Math.round((y0 + (y1 - y0) * t) * 100) / 100);
  }
  if (typeof value === "number" && Number.isFinite(value)) return clampWidth(value);
  return null;
}

export interface EdgeStyleInput {
  width?: number;
  weight?: string | number;
  dash?: EdgeDash;
  double?: boolean;
  color?: string;
  tone?: string;
}

/** Grosor de una arista: `width` explícito, o `weight` según la escala, o el de por defecto. */
export function edgeWidth(edge: EdgeStyleInput, scale?: EdgeWidthScale): number {
  if (typeof edge.width === "number" && Number.isFinite(edge.width)) return clampWidth(edge.width);
  return scaleWidth(edge.weight, scale) ?? DEFAULT_EDGE_WIDTH;
}

/** Patrón de trazo (`stroke-dasharray`) para un tipo de línea y un grosor; `null` para el continuo. */
export function dashArray(dash: EdgeDash | undefined, width: number): string | null {
  const w = Math.max(1, width);
  if (dash === "dashed") return `${r2(Math.max(5, w * 3))} ${r2(Math.max(4, w * 2.2))}`;
  // Punteado: trazos de longitud cero con remate redondo (un punto del grosor de la línea).
  if (dash === "dotted") return `0 ${r2(Math.max(4, w * 2.4))}`;
  return null;
}
const r2 = (n: number) => Math.round(n * 100) / 100;

const TOKEN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const LITERAL = /^(?:#[0-9a-fA-F]{3,8}|(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\([\d\s.,%/+\-a-zA-Z]*\))$/;

export interface EdgeColor {
  /** Tono de la suite (se pinta con su token). */
  tone?: EdgeTone;
  /** Valor de `--z-edge-color`: `var(--z-<token>)` o un color libre. */
  value?: string;
}

/**
 * Color de una arista: un tono de la suite (`accent`, `success`…), el nombre de un token (`chart-3`, `info`) o un color
 * literal (`#58a6ff`, `oklch(…)`). Lo que no es ninguna de las tres cosas se descarta; nunca se escribe tal cual en un
 * estilo algo con `;`, `url(` o llaves.
 */
export function edgeColor(color: string | undefined, tone?: string): EdgeColor {
  const c = typeof color === "string" ? color.trim() : "";
  if (c) {
    if ((EDGE_TONES as readonly string[]).includes(c)) return c === "neutral" ? {} : { tone: c as EdgeTone };
    if (TOKEN.test(c) && c.length <= 48) return { value: `var(--z-${c})` };
    if (c.startsWith("--") && TOKEN.test(c.slice(2))) return { value: `var(${c})` };
    if (LITERAL.test(c) && c.length <= 64) return { value: c };
    return {};
  }
  if (tone && tone !== "neutral" && (EDGE_TONES as readonly string[]).includes(tone)) return { tone: tone as EdgeTone };
  return {};
}

/** Clave estable del estilo de una arista (leyenda, marcadores, caché). */
export function edgeStyleKey(edge: EdgeStyleInput, scale?: EdgeWidthScale): string {
  const c = edgeColor(edge.color, edge.tone);
  return `${edge.dash ?? "solid"}|${edge.double ? 1 : 0}|${c.tone ?? c.value ?? ""}|${edgeWidth(edge, scale)}`;
}

/**
 * Punto a `distance` del extremo de una polilínea, desplazado `offset` en perpendicular (a la izquierda del sentido
 * de avance): donde va la etiqueta de un extremo («10G» junto al puerto). Con una polilínea más corta, su mitad.
 */
export function pointAlong(points: readonly Point[], from: "start" | "end", distance: number, offset = 0): Point {
  const pts = from === "start" ? points : [...points].reverse();
  if (!pts.length) return { x: 0, y: 0 };
  let left = Math.max(0, distance);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (seg <= 0) continue;
    if (seg >= left || i === pts.length - 1) {
      const t = Math.min(1, left / seg);
      const ux = (b.x - a.x) / seg;
      const uy = (b.y - a.y) / seg;
      return { x: a.x + (b.x - a.x) * t - uy * offset, y: a.y + (b.y - a.y) * t + ux * offset };
    }
    left -= seg;
  }
  return pts[0]!;
}
