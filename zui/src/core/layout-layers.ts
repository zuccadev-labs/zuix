// Disposición automática sencilla de un grafo por capas (Sugiyama reducido): se rompen los ciclos invirtiendo las
// aristas de retroceso, cada nodo va a la capa de su camino más largo desde una fuente, el orden dentro de cada capa
// se mejora con barridos de baricentro y las capas se colocan en columnas (o filas) con huecos fijos. No busca el
// mínimo de cruces: para grafos grandes o rutas complejas, el consumidor trae su motor. Puro, sin documento.

import type { GraphEdge } from "./graph";
import type { Point, Size } from "./viewport";

export interface LayoutOptions {
  /** `LR` (capas en columnas, de izquierda a derecha) o `TB` (en filas, de arriba abajo). Por defecto `LR`. */
  direction?: "LR" | "TB";
  /** Hueco entre capas. Por defecto 96. */
  layerGap?: number;
  /** Hueco entre nodos de la misma capa. Por defecto 40. */
  nodeGap?: number;
  /** Barridos de baricentro. Por defecto 4. */
  sweeps?: number;
  /** Origen de la disposición. */
  origin?: Point;
}

export interface LayoutResult {
  positions: Map<string, Point>;
  /** Capa de cada nodo (desde 0). */
  layers: Map<string, number>;
  /** Ids por capa, en orden. */
  order: string[][];
}

/** Aristas que hay que invertir para que el grafo no tenga ciclos (las de retroceso de un DFS en orden estable). */
export function feedbackEdges(ids: readonly string[], edges: readonly GraphEdge[]): Set<string> {
  const out = new Map<string, GraphEdge[]>();
  for (const e of edges) out.set(e.source, [...(out.get(e.source) ?? []), e]);
  const known = new Set(ids);
  const state = new Map<string, 1 | 2>();
  const back = new Set<string>();
  for (const root of ids) {
    if (state.has(root)) continue;
    const stack: { id: string; i: number }[] = [{ id: root, i: 0 }];
    state.set(root, 1);
    while (stack.length) {
      const top = stack[stack.length - 1]!;
      const list = out.get(top.id) ?? [];
      if (top.i >= list.length) {
        state.set(top.id, 2);
        stack.pop();
        continue;
      }
      const e = list[top.i++]!;
      const s = state.get(e.target);
      if (s === 1) back.add(e.id);
      else if (s === undefined && known.has(e.target)) {
        state.set(e.target, 1);
        stack.push({ id: e.target, i: 0 });
      }
    }
  }
  return back;
}

export function layeredLayout(
  ids: readonly string[],
  edges: readonly GraphEdge[],
  sizes: ReadonlyMap<string, Size>,
  o: LayoutOptions = {},
): LayoutResult {
  const set = new Set(ids);
  const inside = edges.filter((e) => set.has(e.source) && set.has(e.target) && e.source !== e.target);
  const back = feedbackEdges(ids, inside);
  const dag = inside.map((e) => (back.has(e.id) ? { ...e, source: e.target, target: e.source } : e));
  const preds = new Map<string, string[]>(ids.map((id) => [id, []]));
  const succs = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const e of dag) {
    preds.get(e.target)!.push(e.source);
    succs.get(e.source)!.push(e.target);
  }
  // Capa = camino más largo desde una fuente (orden topológico de Kahn sobre el DAG).
  const indeg = new Map(ids.map((id) => [id, preds.get(id)!.length]));
  const queue = ids.filter((id) => indeg.get(id) === 0);
  const layer = new Map<string, number>(ids.map((id) => [id, 0]));
  while (queue.length) {
    const id = queue.shift()!;
    for (const t of succs.get(id)!) {
      layer.set(t, Math.max(layer.get(t)!, layer.get(id)! + 1));
      indeg.set(t, indeg.get(t)! - 1);
      if (indeg.get(t) === 0) queue.push(t);
    }
  }
  const count = Math.max(0, ...layer.values()) + 1;
  const order: string[][] = Array.from({ length: ids.length ? count : 0 }, () => []);
  for (const id of ids) order[layer.get(id)!]!.push(id);
  // Barridos de baricentro: hacia delante con los predecesores y hacia atrás con los sucesores.
  const pos = new Map<string, number>();
  const index = () => {
    for (const row of order)
      row.forEach((id, i) => {
        pos.set(id, i);
      });
  };
  index();
  const sweeps = Math.max(0, o.sweeps ?? 4);
  for (let s = 0; s < sweeps; s++) {
    const down = s % 2 === 0;
    const rows = down ? order.slice(1) : order.slice(0, -1).reverse();
    for (const row of rows) {
      const bary = new Map<string, number>();
      for (const id of row) {
        const ref = (down ? preds : succs).get(id)!;
        bary.set(id, ref.length ? ref.reduce((a, r) => a + pos.get(r)!, 0) / ref.length : pos.get(id)!);
      }
      row.sort((a, b) => bary.get(a)! - bary.get(b)! || pos.get(a)! - pos.get(b)!);
      row.forEach((id, i) => {
        pos.set(id, i);
      });
    }
  }
  // Coordenadas: cada capa ocupa lo que su nodo más ancho (o alto) y se centra en el eje perpendicular.
  const lr = (o.direction ?? "LR") === "LR";
  const layerGap = o.layerGap ?? 96;
  const nodeGap = o.nodeGap ?? 40;
  const origin = o.origin ?? { x: 0, y: 0 };
  const sizeOf = (id: string) => sizes.get(id) ?? { width: 200, height: 76 };
  const along = (id: string) => (lr ? sizeOf(id).width : sizeOf(id).height);
  const across = (id: string) => (lr ? sizeOf(id).height : sizeOf(id).width);
  const extents = order.map((row) => row.reduce((a, id, i) => a + across(id) + (i ? nodeGap : 0), 0));
  const widest = Math.max(0, ...extents);
  const positions = new Map<string, Point>();
  let cursor = 0;
  order.forEach((row, li) => {
    const thick = Math.max(0, ...row.map(along));
    let offset = (widest - extents[li]!) / 2;
    for (const id of row) {
      const a = cursor + (thick - along(id)) / 2;
      positions.set(id, lr ? { x: origin.x + a, y: origin.y + offset } : { x: origin.x + offset, y: origin.y + a });
      offset += across(id) + nodeGap;
    }
    cursor += thick + layerGap;
  });
  return { positions, layers: layer, order };
}

/** Número de cruces entre dos capas consecutivas (para medir la disposición en las pruebas). */
export function crossings(order: string[][], edges: readonly GraphEdge[]): number {
  const where = new Map<string, [number, number]>();
  order.forEach((row, l) => {
    row.forEach((id, i) => {
      where.set(id, [l, i]);
    });
  });
  const spans = edges
    .map((e) => [where.get(e.source), where.get(e.target)] as const)
    .filter((p): p is readonly [[number, number], [number, number]] => !!p[0] && !!p[1] && Math.abs(p[0][0] - p[1][0]) === 1)
    .map(([a, b]) => (a[0] < b[0] ? { l: a[0], u: a[1], v: b[1] } : { l: b[0], u: b[1], v: a[1] }));
  let n = 0;
  for (let i = 0; i < spans.length; i++)
    for (let j = i + 1; j < spans.length; j++) {
      const a = spans[i]!;
      const b = spans[j]!;
      if (a.l === b.l && (a.u - b.u) * (a.v - b.v) < 0) n++;
    }
  return n;
}
