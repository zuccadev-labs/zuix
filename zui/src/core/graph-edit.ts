// Operaciones sobre el modelo `{ nodes, edges }` de un lienzo de nodos: mover (con imán), redimensionar, borrar
// (con sus aristas y los hijos de un grupo), conectar y reconectar, copiar, pegar y duplicar con ids nuevos, y
// agrupar y desagrupar. Cada una devuelve un grafo nuevo y deja el de entrada intacto. Puro, sin documento.

import {
  absolutePosition,
  ancestors,
  descendants,
  type Graph,
  type GraphEdge,
  type GraphNode,
  indexNodes,
  isGroup,
  nodeRects,
} from "./graph";
import { type Point, type Size, snapValue, unionRect } from "./viewport";

/** Id libre con prefijo (`node-4`), que no esté en `taken`. */
export function freshId(prefix: string, taken: ReadonlySet<string>): string {
  let i = taken.size + 1;
  while (taken.has(`${prefix}-${i}`)) i++;
  return `${prefix}-${i}`;
}

/** Quita de `ids` los nodos cuyo grupo también está en la lista: al mover el grupo ya se mueven. */
export function topmost(ids: Iterable<string>, nodes: readonly GraphNode[]): string[] {
  const set = new Set(ids);
  const index = indexNodes(nodes);
  return [...set].filter((id) => index.has(id) && !ancestors(id, index).some((a) => set.has(a)));
}

/**
 * Posiciones de `ids` tras mover `dx`, `dy` desde `start` (las del principio del arrastre). Con imán, el nodo
 * `lead` cae en la cuadrícula y los demás lo siguen con el mismo desplazamiento (no se descuadra el conjunto).
 */
export function dragPositions(
  start: ReadonlyMap<string, Point>,
  dx: number,
  dy: number,
  snap: number | false | undefined,
  lead?: string,
): Map<string, Point> {
  const leadStart = (lead && start.get(lead)) || start.values().next().value;
  let ox = dx;
  let oy = dy;
  if (snap && leadStart) {
    ox = snapValue(leadStart.x + dx, snap) - leadStart.x;
    oy = snapValue(leadStart.y + dy, snap) - leadStart.y;
  }
  const out = new Map<string, Point>();
  for (const [id, p] of start) out.set(id, { x: p.x + ox, y: p.y + oy });
  return out;
}

/** Aplica posiciones (relativas a su grupo) a los nodos indicados. */
export function setPositions(graph: Graph, positions: ReadonlyMap<string, Point>): Graph {
  if (!positions.size) return graph;
  return { ...graph, nodes: graph.nodes.map((n) => (positions.has(n.id) ? { ...n, position: positions.get(n.id)! } : n)) };
}

/** Mueve nodos (sin duplicar el movimiento de los hijos de un grupo movido). */
export function moveNodes(graph: Graph, ids: Iterable<string>, dx: number, dy: number, snap?: number | false): Graph {
  const index = indexNodes(graph.nodes);
  const start = new Map(topmost(ids, graph.nodes).map((id) => [id, index.get(id)!.position]));
  return setPositions(graph, dragPositions(start, dx, dy, snap));
}

/** Tamaño fijo de un nodo, con mínimo y, si hay imán, ajustado a la cuadrícula. */
export function resizeNode(graph: Graph, id: string, size: Size, snap?: number | false, min: Size = { width: 120, height: 56 }): Graph {
  const width = Math.max(min.width, snapValue(size.width, snap));
  const height = Math.max(min.height, snapValue(size.height, snap));
  return { ...graph, nodes: graph.nodes.map((n) => (n.id === id ? { ...n, size: { width, height } } : n)) };
}

/** Borra nodos (y los hijos de los grupos borrados) y aristas, más las aristas que tocan a un nodo borrado. */
export function removeElements(graph: Graph, nodeIds: Iterable<string>, edgeIds: Iterable<string> = []): Graph {
  const gone = new Set(nodeIds);
  for (const id of [...gone]) for (const d of descendants(id, graph.nodes)) gone.add(d);
  const goneEdges = new Set(edgeIds);
  return {
    nodes: graph.nodes.filter((n) => !gone.has(n.id)),
    edges: graph.edges.filter((e) => !goneEdges.has(e.id) && !gone.has(e.source) && !gone.has(e.target)),
  };
}

/** Añade una arista (con id nuevo si no lo trae). */
export function addEdge(graph: Graph, edge: Omit<GraphEdge, "id"> & { id?: string }): { graph: Graph; edge: GraphEdge } {
  const id = edge.id ?? freshId("edge", new Set(graph.edges.map((e) => e.id)));
  const full = { ...edge, id } as GraphEdge;
  return { graph: { ...graph, edges: [...graph.edges, full] }, edge: full };
}

/** Cambia un extremo de una arista. */
export function reconnectEdge(graph: Graph, id: string, end: "source" | "target", to: { node: string; port?: string }): Graph {
  return {
    ...graph,
    edges: graph.edges.map((e) =>
      e.id !== id ? e : end === "source" ? { ...e, source: to.node, sourcePort: to.port } : { ...e, target: to.node, targetPort: to.port },
    ),
  };
}

/**
 * Fragmento copiable: los nodos elegidos (y los hijos de sus grupos), en posición absoluta si su grupo no va con
 * ellos, y las aristas entre ellos.
 */
export function copyFragment(graph: Graph, ids: Iterable<string>): Graph {
  const set = new Set(ids);
  for (const id of [...set]) for (const d of descendants(id, graph.nodes)) set.add(d);
  const index = indexNodes(graph.nodes);
  const nodes = graph.nodes
    .filter((n) => set.has(n.id))
    .map((n) => (n.parentId && !set.has(n.parentId) ? { ...n, parentId: undefined, position: absolutePosition(n.id, index) } : n))
    .map(({ parentId, ...rest }) => (parentId ? { ...rest, parentId } : rest));
  const edges = graph.edges.filter((e) => set.has(e.source) && set.has(e.target));
  return { nodes, edges };
}

/**
 * Pega un fragmento desplazado `offset` con ids nuevos (los padres y las aristas se reescriben). Devuelve el grafo y
 * los ids pegados (para seleccionarlos).
 */
export function pasteFragment(graph: Graph, fragment: Graph, offset: Point = { x: 32, y: 32 }): { graph: Graph; ids: string[] } {
  const taken = new Set(graph.nodes.map((n) => n.id));
  const takenEdges = new Set(graph.edges.map((e) => e.id));
  const map = new Map<string, string>();
  for (const n of fragment.nodes) {
    const base = n.id.replace(/-(copy|\d+)(-\d+)?$/, "");
    const id = freshId(`${base}-copy`, taken);
    taken.add(id);
    map.set(n.id, id);
  }
  const nodes = fragment.nodes.map((n) => {
    const inside = n.parentId !== undefined && map.has(n.parentId);
    const copy: GraphNode = {
      ...n,
      id: map.get(n.id)!,
      position: inside ? n.position : { x: n.position.x + offset.x, y: n.position.y + offset.y },
      data: { ...n.data },
    };
    if (inside) copy.parentId = map.get(n.parentId!)!;
    else delete copy.parentId;
    return copy;
  });
  const edges = fragment.edges
    .filter((e) => map.has(e.source) && map.has(e.target))
    .map((e) => {
      const id = freshId("edge", takenEdges);
      takenEdges.add(id);
      return { ...e, id, source: map.get(e.source)!, target: map.get(e.target)! };
    });
  return {
    graph: { nodes: [...graph.nodes, ...nodes], edges: [...graph.edges, ...edges] },
    ids: nodes.filter((n) => !n.parentId || !map.has(n.parentId)).map((n) => n.id),
  };
}

/** Duplica la selección al lado. */
export const duplicate = (graph: Graph, ids: Iterable<string>, offset?: Point) => pasteFragment(graph, copyFragment(graph, ids), offset);

/**
 * Agrupa los nodos elegidos (de nivel superior) en un grupo nuevo que los envuelve con `padding` y deja sus
 * posiciones relativas a él. Los grupos van antes que sus hijos en la lista (orden de pintado).
 */
export function groupNodes(
  graph: Graph,
  ids: Iterable<string>,
  o: { id?: string; label?: string; padding?: number; header?: number; measured?: ReadonlyMap<string, Size> } = {},
): { graph: Graph; id: string | null } {
  const index = indexNodes(graph.nodes);
  const chosen = topmost(ids, graph.nodes).filter((id) => !index.get(id)!.parentId);
  if (!chosen.length) return { graph, id: null };
  const rects = nodeRects(graph.nodes, o.measured);
  const box = unionRect(chosen.map((id) => rects.get(id)!))!;
  const pad = o.padding ?? 24;
  const header = o.header ?? 36;
  const id = o.id ?? freshId("group", new Set(graph.nodes.map((n) => n.id)));
  const origin = { x: box.x - pad, y: box.y - pad - header };
  const group: GraphNode = {
    id,
    type: "group",
    position: origin,
    size: { width: box.width + pad * 2, height: box.height + pad * 2 + header },
    data: { label: o.label ?? "Group" },
  };
  const set = new Set(chosen);
  const nodes = graph.nodes.map((n) =>
    set.has(n.id) ? { ...n, parentId: id, position: { x: n.position.x - origin.x, y: n.position.y - origin.y } } : n,
  );
  return { graph: { ...graph, nodes: [group, ...nodes] }, id };
}

/** Deshace un grupo: los hijos vuelven a posición absoluta (o relativa al grupo de arriba) y el grupo se quita. */
export function ungroup(graph: Graph, id: string): Graph {
  const index = indexNodes(graph.nodes);
  const group = index.get(id);
  if (!group || !isGroup(group)) return graph;
  const nodes = graph.nodes
    .filter((n) => n.id !== id)
    .map((n) => {
      if (n.parentId !== id) return n;
      const next: GraphNode = { ...n, position: { x: n.position.x + group.position.x, y: n.position.y + group.position.y } };
      if (group.parentId) next.parentId = group.parentId;
      else delete next.parentId;
      return next;
    });
  return { ...graph, nodes };
}
