// Enrutado ortogonal que esquiva los nodos: cada arista sale y entra en perpendicular a su puerto y busca un camino de
// tramos horizontales y verticales que no atraviese otros nodos (con un margen). Primero prueba las formas sencillas
// (la escalonada de siempre y sus variantes con el tramo central desplazado a los pasillos entre nodos); si ninguna
// queda libre, busca con A* sobre la rejilla de Hanan local (las coordenadas de los bordes de los obstáculos
// cercanos), penalizando los giros. Después reparte en carriles paralelos los tramos de aristas distintas que
// comparten pasillo. Determinista: el mismo grafo da siempre las mismas rutas. Puro, sin documento.

import { type EdgeEnds, type EdgeRoute, orthogonalPoints, polylineMidpoint, roundedPath, type Side, simplifyPolyline } from "./edge-path";
import type { Point, Rect } from "./viewport";

export interface OrthogonalRequest {
  id: string;
  ends: EdgeEnds;
  /** Nodos de origen y destino: no cuentan como obstáculo para esta arista. */
  source?: string;
  target?: string;
  /** Grosor de la arista (separa más los carriles de las gruesas). */
  width?: number;
}

export interface OrthogonalOptions {
  /** Margen alrededor de cada obstáculo. Por defecto 12. */
  margin?: number;
  /** Tramo recto al salir y al entrar en un puerto. Por defecto 20. */
  offset?: number;
  /** Radio de las esquinas. Por defecto 10. */
  radius?: number;
  /** Separación entre carriles paralelos. Por defecto 6 (más el grosor de las aristas). */
  spacing?: number;
  /** Repartir en carriles los tramos compartidos. Por defecto sí. */
  nudge?: boolean;
  /** Coste de cada giro frente a la longitud (px). Por defecto 40. */
  bendCost?: number;
  /** Tope de coordenadas por eje de la rejilla local del A*. Por defecto 96. */
  maxGrid?: number;
}

const NORMAL: Record<Side, Point> = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 } };

/** Índice espacial de rectángulos por celdas (consultas de tramos en tiempo casi constante). */
class RectIndex {
  private cells = new Map<string, number[]>();
  constructor(
    readonly rects: readonly (Rect & { id: string })[],
    private cell = 160,
  ) {
    rects.forEach((r, i) => {
      for (const k of this.keys(r)) {
        const list = this.cells.get(k);
        if (list) list.push(i);
        else this.cells.set(k, [i]);
      }
    });
  }
  private *keys(r: Rect) {
    const c = this.cell;
    for (let x = Math.floor(r.x / c); x <= Math.floor((r.x + r.width) / c); x++)
      for (let y = Math.floor(r.y / c); y <= Math.floor((r.y + r.height) / c); y++) yield `${x},${y}`;
  }
  /** Índices de los rectángulos que pueden tocar `r`. */
  near(r: Rect): number[] {
    const out = new Set<number>();
    for (const k of this.keys(r)) for (const i of this.cells.get(k) ?? []) out.add(i);
    return [...out].sort((a, b) => a - b);
  }
}

/** Verdadero si el tramo `a`→`b` (horizontal o vertical) entra en el interior de `r`. */
function segmentHits(a: Point, b: Point, r: Rect): boolean {
  const x0 = Math.min(a.x, b.x);
  const x1 = Math.max(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const y1 = Math.max(a.y, b.y);
  return x1 > r.x + 0.5 && x0 < r.x + r.width - 0.5 && y1 > r.y + 0.5 && y0 < r.y + r.height - 0.5;
}

const segBox = (a: Point, b: Point): Rect => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  width: Math.abs(a.x - b.x),
  height: Math.abs(a.y - b.y),
});

function blocked(points: readonly Point[], index: RectIndex, skip: ReadonlySet<string>): boolean {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    for (const k of index.near(segBox(a, b))) {
      const r = index.rects[k]!;
      if (!skip.has(r.id) && segmentHits(a, b, r)) return true;
    }
  }
  return false;
}

/** Longitud más penalización por giros. */
function cost(points: readonly Point[], bend: number): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) len += Math.abs(points[i]!.x - points[i - 1]!.x) + Math.abs(points[i]!.y - points[i - 1]!.y);
  return len + Math.max(0, points.length - 2) * bend;
}

const horizontal = (s: Side) => s === "left" || s === "right";

/** Coordenadas de los pasillos (bordes de obstáculos con margen) entre `lo` y `hi`, más cercanas primero a `mid`. */
function lanes(values: number[], lo: number, hi: number, mid: number, limit = 12): number[] {
  const out = [...new Set(values.filter((v) => v >= lo && v <= hi).map((v) => Math.round(v)))];
  return out.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid) || a - b).slice(0, limit);
}

/** Formas sencillas: la escalonada estándar y sus variantes con el tramo central en otro pasillo. */
function candidates(ends: EdgeEnds, offset: number, near: readonly Rect[], margin: number): Point[][] {
  const { source: s, target: t, sourceSide, targetSide } = ends;
  const n1 = NORMAL[sourceSide];
  const n2 = NORMAL[targetSide];
  const a = { x: s.x + n1.x * offset, y: s.y + n1.y * offset };
  const b = { x: t.x + n2.x * offset, y: t.y + n2.y * offset };
  const out: Point[][] = [orthogonalPoints(ends, offset)];
  const xs = near.flatMap((r) => [r.x - margin / 2, r.x + r.width + margin / 2]);
  const ys = near.flatMap((r) => [r.y - margin / 2, r.y + r.height + margin / 2]);
  const lo = (u: number, v: number) => Math.min(u, v) - 400;
  const hi = (u: number, v: number) => Math.max(u, v) + 400;
  // Tramo central vertical (x variable) y horizontal (y variable), con dos o tres giros.
  for (const mx of lanes(xs, lo(a.x, b.x), hi(a.x, b.x), (a.x + b.x) / 2))
    out.push(simplifyPolyline([s, a, { x: mx, y: a.y }, { x: mx, y: b.y }, b, t]));
  for (const my of lanes(ys, lo(a.y, b.y), hi(a.y, b.y), (a.y + b.y) / 2))
    out.push(simplifyPolyline([s, a, { x: a.x, y: my }, { x: b.x, y: my }, b, t]));
  // Rodeos en U: salir, ir a un pasillo y volver (para puertos que miran hacia fuera del destino).
  if (horizontal(sourceSide) === horizontal(targetSide)) {
    for (const mx of lanes(xs, lo(a.x, b.x), hi(a.x, b.x), (a.x + b.x) / 2, 6))
      for (const my of lanes(ys, lo(a.y, b.y), hi(a.y, b.y), (a.y + b.y) / 2, 6))
        out.push(simplifyPolyline([s, a, { x: a.x, y: my }, { x: mx, y: my }, { x: mx, y: b.y }, b, t]));
  }
  return out;
}

interface Heap {
  push(item: [number, number]): void;
  pop(): [number, number] | undefined;
  readonly size: number;
}
/** Montículo binario de mínimos por coste (y por índice para desempatar: resultado determinista). */
function heap(): Heap {
  const a: [number, number][] = [];
  const less = (i: number, j: number) => a[i]![0] < a[j]![0] || (a[i]![0] === a[j]![0] && a[i]![1] < a[j]![1]);
  return {
    get size() {
      return a.length;
    },
    push(item) {
      a.push(item);
      let i = a.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (!less(i, p)) break;
        [a[i], a[p]] = [a[p]!, a[i]!];
        i = p;
      }
    },
    pop() {
      if (!a.length) return undefined;
      const top = a[0]!;
      const last = a.pop()!;
      if (a.length) {
        a[0] = last;
        let i = 0;
        for (;;) {
          const l = i * 2 + 1;
          const r = l + 1;
          let m = i;
          if (l < a.length && less(l, m)) m = l;
          if (r < a.length && less(r, m)) m = r;
          if (m === i) break;
          [a[i], a[m]] = [a[m]!, a[i]!];
          i = m;
        }
      }
      return top;
    },
  };
}

/** A* sobre la rejilla de Hanan local entre los extremos de los tramos de salida y entrada. */
function gridRoute(
  ends: EdgeEnds,
  offset: number,
  index: RectIndex,
  skip: ReadonlySet<string>,
  margin: number,
  bend: number,
  maxGrid: number,
): Point[] | null {
  const { source: s, target: t, sourceSide, targetSide } = ends;
  const n1 = NORMAL[sourceSide];
  const n2 = NORMAL[targetSide];
  const a = { x: s.x + n1.x * offset, y: s.y + n1.y * offset };
  const b = { x: t.x + n2.x * offset, y: t.y + n2.y * offset };
  const pad = 240;
  const area = {
    x: Math.min(a.x, b.x) - pad,
    y: Math.min(a.y, b.y) - pad,
    width: Math.abs(a.x - b.x) + pad * 2,
    height: Math.abs(a.y - b.y) + pad * 2,
  };
  const obstacles = index
    .near(area)
    .map((k) => index.rects[k]!)
    .filter((r) => !skip.has(r.id));
  const pick = (values: number[], ends2: number[], mid: number): number[] => {
    const all = [...new Set([...values.map(Math.round), ...ends2.map((v) => Math.round(v * 100) / 100)])].sort((p, q) => p - q);
    if (all.length <= maxGrid) return all;
    const keep = new Set(ends2.map((v) => Math.round(v * 100) / 100));
    const rest = all.filter((v) => !keep.has(v)).sort((p, q) => Math.abs(p - mid) - Math.abs(q - mid) || p - q);
    return [...keep, ...rest.slice(0, maxGrid - keep.size)].sort((p, q) => p - q);
  };
  const xs = pick(
    obstacles.flatMap((r) => [r.x - margin / 2, r.x + r.width + margin / 2]),
    [a.x, b.x],
    (a.x + b.x) / 2,
  );
  const ys = pick(
    obstacles.flatMap((r) => [r.y - margin / 2, r.y + r.height + margin / 2]),
    [a.y, b.y],
    (a.y + b.y) / 2,
  );
  const nx = xs.length;
  const ny = ys.length;
  const ix = (v: number) => xs.indexOf(Math.round(v * 100) / 100);
  const iy = (v: number) => ys.indexOf(Math.round(v * 100) / 100);
  const sx = ix(a.x);
  const sy = iy(a.y);
  const tx = ix(b.x);
  const ty = iy(b.y);
  if (sx < 0 || sy < 0 || tx < 0 || ty < 0) return null;
  const local = new RectIndex(obstacles.map((r) => ({ ...r })));
  const free = (p: Point, q: Point) => {
    for (const k of local.near(segBox(p, q))) if (segmentHits(p, q, local.rects[k]!)) return false;
    return true;
  };
  // Estado = celda × dirección de llegada (0 h, 1 v, 2 ninguna).
  const N = nx * ny * 3;
  const dist = new Float64Array(N).fill(Infinity);
  const prev = new Int32Array(N).fill(-1);
  const key = (x: number, y: number, d: number) => (y * nx + x) * 3 + d;
  const h = (x: number, y: number) => Math.abs(xs[x]! - xs[tx]!) + Math.abs(ys[y]! - ys[ty]!);
  const startDir = horizontal(sourceSide) ? 0 : 1;
  const endDir = horizontal(targetSide) ? 0 : 1;
  const open = heap();
  const k0 = key(sx, sy, startDir);
  dist[k0] = 0;
  open.push([h(sx, sy), k0]);
  let found = -1;
  let guard = 0;
  while (open.size && guard++ < 200_000) {
    const [, k] = open.pop()!;
    const d = k % 3;
    const cellIdx = (k - d) / 3;
    const x = cellIdx % nx;
    const y = (cellIdx - x) / nx;
    if (x === tx && y === ty) {
      found = k;
      break;
    }
    const base = dist[k]!;
    const steps: [number, number, number][] = [
      [x + 1, y, 0],
      [x - 1, y, 0],
      [x, y + 1, 1],
      [x, y - 1, 1],
    ];
    for (const [qx, qy, qd] of steps) {
      if (qx < 0 || qy < 0 || qx >= nx || qy >= ny) continue;
      const p = { x: xs[x]!, y: ys[y]! };
      const q = { x: xs[qx]!, y: ys[qy]! };
      if (!free(p, q)) continue;
      let c = base + Math.abs(q.x - p.x) + Math.abs(q.y - p.y);
      if (d !== 2 && d !== qd) c += bend;
      if (qx === tx && qy === ty && qd !== endDir) c += bend;
      const nk = key(qx, qy, qd);
      if (c < dist[nk]! - 1e-9) {
        dist[nk] = c;
        prev[nk] = k;
        open.push([c + h(qx, qy), nk]);
      }
    }
  }
  if (found < 0) return null;
  const path: Point[] = [];
  for (let k = found; k >= 0; k = prev[k]!) {
    const d = k % 3;
    const cellIdx = (k - d) / 3;
    const x = cellIdx % nx;
    const y = (cellIdx - x) / nx;
    path.push({ x: xs[x]!, y: ys[y]! });
  }
  path.reverse();
  return simplifyPolyline([s, a, ...path, b, t]);
}

/** Ruta ortogonal de una arista entre obstáculos (sin repartir carriles). */
function routeAround(
  req: OrthogonalRequest,
  index: RectIndex,
  o: Required<Omit<OrthogonalOptions, "nudge" | "spacing" | "radius">>,
): Point[] {
  const skip = new Set([req.source, req.target].filter((x): x is string => !!x));
  const pad = o.margin;
  const area = {
    x: Math.min(req.ends.source.x, req.ends.target.x) - 400,
    y: Math.min(req.ends.source.y, req.ends.target.y) - 400,
    width: Math.abs(req.ends.source.x - req.ends.target.x) + 800,
    height: Math.abs(req.ends.source.y - req.ends.target.y) + 800,
  };
  const near = index
    .near(area)
    .map((k) => index.rects[k]!)
    .filter((r) => !skip.has(r.id));
  let best: Point[] | null = null;
  let bestCost = Infinity;
  for (const c of candidates(req.ends, o.offset, near, pad)) {
    const k = cost(c, o.bendCost);
    if (k < bestCost && !blocked(c, index, skip)) {
      best = c;
      bestCost = k;
    }
  }
  if (best) return best;
  return gridRoute(req.ends, o.offset, index, skip, pad, o.bendCost, o.maxGrid) ?? orthogonalPoints(req.ends, o.offset);
}

interface Seg {
  edge: number;
  /** Índice del primer vértice del tramo. */
  i: number;
  vertical: boolean;
  coord: number;
  lo: number;
  hi: number;
  width: number;
}

/**
 * Reparte en carriles los tramos interiores (no los de salida ni entrada) de aristas distintas que van por el mismo
 * pasillo y se solapan: cada grupo se abre en abanico alrededor de su coordenada, en orden estable.
 */
export function nudgeParallel(routes: Point[][], widths: readonly number[], spacing = 6): Point[][] {
  const out = routes.map((r) => r.map((p) => ({ ...p })));
  const segs: Seg[] = [];
  out.forEach((pts, edge) => {
    for (let i = 1; i < pts.length - 2; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      const vertical = Math.abs(a.x - b.x) < 0.01;
      if (!vertical && Math.abs(a.y - b.y) >= 0.01) continue;
      const coord = vertical ? a.x : a.y;
      const lo = vertical ? Math.min(a.y, b.y) : Math.min(a.x, b.x);
      const hi = vertical ? Math.max(a.y, b.y) : Math.max(a.x, b.x);
      if (hi - lo < 1) continue;
      segs.push({ edge, i, vertical, coord: Math.round(coord), lo, hi, width: widths[edge] ?? 2 });
    }
  });
  const groups = new Map<string, Seg[]>();
  for (const s of segs) {
    const k = `${s.vertical ? "v" : "h"}${s.coord}`;
    const list = groups.get(k);
    if (list) list.push(s);
    else groups.set(k, [s]);
  }
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    list.sort((p, q) => p.lo - q.lo || p.edge - q.edge || p.i - q.i);
    // Racimos de tramos que se solapan (intervalos conectados).
    const clusters: Seg[][] = [];
    let cur: Seg[] = [];
    let end = -Infinity;
    for (const s of list) {
      if (cur.length && s.lo >= end - 0.5) {
        clusters.push(cur);
        cur = [];
        end = -Infinity;
      }
      cur.push(s);
      end = Math.max(end, s.hi);
    }
    if (cur.length) clusters.push(cur);
    for (const cluster of clusters) {
      const edges = [...new Set(cluster.map((s) => s.edge))].sort((p, q) => p - q);
      if (edges.length < 2) continue;
      const gap = spacing + Math.max(...cluster.map((s) => s.width));
      edges.forEach((edge, lane) => {
        const delta = (lane - (edges.length - 1) / 2) * gap;
        for (const s of cluster) {
          if (s.edge !== edge) continue;
          const pts = out[edge]!;
          const a = pts[s.i]!;
          const b = pts[s.i + 1]!;
          if (s.vertical) {
            a.x = s.coord + delta;
            b.x = s.coord + delta;
          } else {
            a.y = s.coord + delta;
            b.y = s.coord + delta;
          }
        }
      });
    }
  }
  return out;
}

export interface OrthogonalResult {
  routes: Map<string, EdgeRoute>;
  /** Aristas que no encontraron camino libre (se pintan con la escalonada simple). */
  fallbacks: string[];
}

/**
 * Rutas ortogonales de un conjunto de aristas entre obstáculos (los nodos, con su id para no chocar con los propios).
 * Devuelve la ruta SVG con esquinas redondeadas de cada una.
 */
export function routeOrthogonal(
  requests: readonly OrthogonalRequest[],
  obstacles: readonly (Rect & { id: string })[],
  options: OrthogonalOptions = {},
): OrthogonalResult {
  const margin = options.margin ?? 12;
  const o = {
    margin,
    offset: options.offset ?? 20,
    bendCost: options.bendCost ?? 40,
    maxGrid: options.maxGrid ?? 96,
  };
  const grown = obstacles.map((r) => ({
    id: r.id,
    x: r.x - margin,
    y: r.y - margin,
    width: r.width + margin * 2,
    height: r.height + margin * 2,
  }));
  const index = new RectIndex(grown);
  const fallbacks: string[] = [];
  const raw = requests.map((req) => {
    const pts = routeAround(req, index, o);
    return pts;
  });
  // Una ruta que aún cruza un obstáculo es un repliegue: se anota.
  requests.forEach((req, i) => {
    const skip = new Set([req.source, req.target].filter((x): x is string => !!x));
    if (blocked(raw[i]!, index, skip)) fallbacks.push(req.id);
  });
  const widths = requests.map((r) => r.width ?? 2);
  const pts = options.nudge === false ? raw : nudgeParallel(raw, widths, options.spacing ?? 6);
  const radius = Math.max(0, options.radius ?? 10);
  const routes = new Map<string, EdgeRoute>();
  requests.forEach((req, i) => {
    const points = simplifyPolyline(pts[i]!);
    const { length, mid } = polylineMidpoint(points);
    routes.set(req.id, { d: roundedPath(points, radius), label: mid, length, points });
  });
  return { routes, fallbacks };
}
