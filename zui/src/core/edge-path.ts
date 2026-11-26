// Rutas SVG de las aristas de un lienzo de nodos: recta, curva bézier (puntos de control según el lado del puerto),
// escalonada (ortogonal) y escalonada suave (ortogonal con radio en las esquinas). Devuelven el atributo `d`, el
// punto medio para la etiqueta y la longitud aproximada. `orthogonal` es la escalonada suave que además esquiva los
// nodos: la calcula el lienzo con todas las aristas a la vez (core/orthogonal-route); suelta, aquí, sale como
// `smoothstep`. Puro, sin documento.

import type { Point } from "./viewport";

export type Side = "left" | "right" | "top" | "bottom";
export type EdgeType = "straight" | "bezier" | "step" | "smoothstep" | "orthogonal";
export const EDGE_TYPES: readonly EdgeType[] = ["straight", "bezier", "step", "smoothstep", "orthogonal"];

export interface EdgeEnds {
  source: Point;
  sourceSide: Side;
  target: Point;
  targetSide: Side;
}

export interface EdgeRoute {
  d: string;
  /** Punto medio de la ruta (etiqueta). */
  label: Point;
  /** Longitud aproximada en unidades del mundo. */
  length: number;
  /** Vértices de la polilínea (rectas y escalonadas) o puntos de control (bézier). */
  points: Point[];
}

export interface EdgeRouteOptions {
  /** Radio de las esquinas de `smoothstep`. Por defecto 10. */
  radius?: number;
  /** Tramo recto al salir y al entrar en un puerto (escalonadas). Por defecto 20. */
  offset?: number;
  /** Curvatura de la bézier (0–1). Por defecto 0.35. */
  curvature?: number;
}

const NORMAL: Record<Side, Point> = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 } };
const horizontalSide = (s: Side) => s === "left" || s === "right";
const r2 = (n: number) => Math.round(n * 100) / 100;
const pt = (p: Point) => `${r2(p.x)} ${r2(p.y)}`;
const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

/** Ruta de una arista del tipo pedido (un tipo desconocido se pinta como bézier). */
export function edgeRoute(type: EdgeType | string | undefined, ends: EdgeEnds, o: EdgeRouteOptions = {}): EdgeRoute {
  if (type === "straight") return straight(ends);
  if (type === "step") return orthogonal(ends, 0, o.offset ?? 20);
  if (type === "smoothstep" || type === "orthogonal") return orthogonal(ends, Math.max(0, o.radius ?? 10), o.offset ?? 20);
  return bezier(ends, o.curvature ?? 0.35);
}

function straight({ source: s, target: t }: EdgeEnds): EdgeRoute {
  return { d: `M ${pt(s)} L ${pt(t)}`, label: { x: (s.x + t.x) / 2, y: (s.y + t.y) / 2 }, length: dist(s, t), points: [s, t] };
}

/** Distancia del punto de control: crece con la separación y, si el destino queda «detrás», también. */
function controlOffset(side: Side, from: Point, to: Point, curvature: number): number {
  const n = NORMAL[side];
  const along = (to.x - from.x) * n.x + (to.y - from.y) * n.y;
  const span = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
  return along >= 0 ? Math.max(24, span * curvature + along * 0.15) : Math.max(48, curvature * 25 * Math.sqrt(-along) + span * 0.2);
}

function bezier(ends: EdgeEnds, curvature: number): EdgeRoute {
  const { source: s, target: t } = ends;
  const k1 = controlOffset(ends.sourceSide, s, t, curvature);
  const k2 = controlOffset(ends.targetSide, t, s, curvature);
  const n1 = NORMAL[ends.sourceSide];
  const n2 = NORMAL[ends.targetSide];
  const c1 = { x: s.x + n1.x * k1, y: s.y + n1.y * k1 };
  const c2 = { x: t.x + n2.x * k2, y: t.y + n2.y * k2 };
  const at = (u: number): Point => {
    const v = 1 - u;
    return {
      x: v * v * v * s.x + 3 * v * v * u * c1.x + 3 * v * u * u * c2.x + u * u * u * t.x,
      y: v * v * v * s.y + 3 * v * v * u * c1.y + 3 * v * u * u * c2.y + u * u * u * t.y,
    };
  };
  let length = 0;
  let prev = s;
  for (let i = 1; i <= 16; i++) {
    const p = at(i / 16);
    length += dist(prev, p);
    prev = p;
  }
  return { d: `M ${pt(s)} C ${pt(c1)} ${pt(c2)} ${pt(t)}`, label: at(0.5), length, points: [s, c1, c2, t] };
}

/** Quita vértices repetidos y los que están en línea (vertical u horizontal) con sus vecinos. */
export function simplifyPolyline(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.x - p.x) < 0.01 && Math.abs(last.y - p.y) < 0.01) continue;
    out.push(p);
    while (out.length >= 3) {
      const [a, b, c] = out.slice(-3) as [Point, Point, Point];
      // Ruta ortogonal: tres vértices en la misma vertical o en la misma horizontal sobran el del medio.
      const sameX = Math.abs(a.x - b.x) < 0.01 && Math.abs(b.x - c.x) < 0.01;
      const sameY = Math.abs(a.y - b.y) < 0.01 && Math.abs(b.y - c.y) < 0.01;
      if (!sameX && !sameY) break;
      out.splice(out.length - 2, 1);
    }
  }
  return out;
}

/** Vértices de una ruta ortogonal entre dos puertos: sale y entra en perpendicular al lado, con un tramo `offset`. */
export function orthogonalPoints(ends: EdgeEnds, offset = 20): Point[] {
  const { source: s, target: t, sourceSide, targetSide } = ends;
  const n1 = NORMAL[sourceSide];
  const n2 = NORMAL[targetSide];
  const a = { x: s.x + n1.x * offset, y: s.y + n1.y * offset };
  const b = { x: t.x + n2.x * offset, y: t.y + n2.y * offset };
  const hs = horizontalSide(sourceSide);
  const ht = horizontalSide(targetSide);
  let middle: Point[];
  if (hs && ht) {
    // Hacia delante (el destino está en la dirección de salida y la entrada mira de vuelta): se cruza por la x media.
    const forward = (b.x - a.x) * n1.x >= 0 && (a.x - b.x) * n2.x >= 0;
    if (forward) {
      const mx = (a.x + b.x) / 2;
      middle = [
        { x: mx, y: a.y },
        { x: mx, y: b.y },
      ];
    } else {
      const my = (a.y + b.y) / 2;
      middle = [
        { x: a.x, y: my },
        { x: b.x, y: my },
      ];
    }
  } else if (!hs && !ht) {
    const forward = (b.y - a.y) * n1.y >= 0 && (a.y - b.y) * n2.y >= 0;
    if (forward) {
      const my = (a.y + b.y) / 2;
      middle = [
        { x: a.x, y: my },
        { x: b.x, y: my },
      ];
    } else {
      const mx = (a.x + b.x) / 2;
      middle = [
        { x: mx, y: a.y },
        { x: mx, y: b.y },
      ];
    }
  } else if (hs) {
    // Sale en horizontal y entra en vertical: una esquina en (b.x, a.y).
    middle = [{ x: b.x, y: a.y }];
  } else {
    middle = [{ x: a.x, y: b.y }];
  }
  return simplifyPolyline([s, a, ...middle, b, t]);
}

/** Longitud de una polilínea y su punto a mitad de recorrido. */
export function polylineMidpoint(points: Point[]): { length: number; mid: Point } {
  let length = 0;
  for (let i = 1; i < points.length; i++) length += dist(points[i - 1]!, points[i]!);
  let left = length / 2;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const seg = dist(a, b);
    if (seg >= left && seg > 0) return { length, mid: { x: a.x + ((b.x - a.x) * left) / seg, y: a.y + ((b.y - a.y) * left) / seg } };
    left -= seg;
  }
  return { length, mid: points[0] ?? { x: 0, y: 0 } };
}

/** Atributo `d` de una polilínea ortogonal con las esquinas redondeadas (radio limitado a la mitad de cada tramo). */
export function roundedPath(points: readonly Point[], radius: number): string {
  if (points.length < 2) return points.length ? `M ${pt(points[0]!)}` : "";
  let d = `M ${pt(points[0]!)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]!;
    const prev = points[i - 1]!;
    const next = points[i + 1]!;
    const r = Math.min(radius, dist(prev, p) / 2, dist(p, next) / 2);
    if (r <= 0.5) {
      d += ` L ${pt(p)}`;
      continue;
    }
    const inDir = { x: Math.sign(p.x - prev.x), y: Math.sign(p.y - prev.y) };
    const outDir = { x: Math.sign(next.x - p.x), y: Math.sign(next.y - p.y) };
    d += ` L ${pt({ x: p.x - inDir.x * r, y: p.y - inDir.y * r })} Q ${pt(p)} ${pt({ x: p.x + outDir.x * r, y: p.y + outDir.y * r })}`;
  }
  d += ` L ${pt(points[points.length - 1]!)}`;
  return d;
}

function orthogonal(ends: EdgeEnds, radius: number, offset: number): EdgeRoute {
  const points = orthogonalPoints(ends, offset);
  const { length, mid } = polylineMidpoint(points);
  if (points.length < 2) return { d: `M ${pt(ends.source)} L ${pt(ends.target)}`, label: mid, length, points };
  return { d: roundedPath(points, radius), label: mid, length, points };
}

/** Caja aproximada de una ruta (sus vértices o puntos de control): sirve para saber si se ve. */
export function routeBounds(route: EdgeRoute): { x: number; y: number; width: number; height: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of route.points) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return x0 === Infinity ? { x: 0, y: 0, width: 0, height: 0 } : { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}
