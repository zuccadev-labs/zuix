// Modelo de datos de un lienzo de nodos `{ nodes, edges }`, serializable (JSON), y lo que se calcula de él sin
// documento: índice, posición absoluta (los hijos de un grupo van relativos a él), cajas, adyacencia, ciclos, orden
// topológico, nodos y aristas visibles y la descripción textual del grafo y de cada nodo.

import type { EdgeType, Side } from "./edge-path";
import { intersects, type Point, type Rect, type Size } from "./viewport";

export type NodeStatus = "idle" | "running" | "success" | "error";
export type PortKind = "source" | "target";

export interface NodePort {
  id: string;
  /** `target` recibe (entrada), `source` envía (salida). */
  kind: PortKind;
  /** Lado del nodo. Por defecto, entradas a la izquierda y salidas a la derecha. */
  side?: Side;
  /** Tipo de dato: solo conectan puertos del mismo tipo (o sin tipo, o `any`). Varios separados por espacios. */
  type?: string;
  label?: string;
  /** Máximo de conexiones del puerto. Sin límite por defecto. */
  max?: number;
  /**
   * El puerto lo dibuja el cuerpo del nodo (un elemento con `data-port-anchor` y `data-port` igual a su id, como los
   * conectores de un PortPanel): no se pinta el asa por defecto y la arista sale del centro de ese elemento.
   */
  anchor?: boolean;
}

export interface NodeData {
  label?: string;
  /** Nombre de icono de zicon. */
  icon?: string;
  /** Texto corto bajo el título. */
  description?: string;
  status?: NodeStatus;
  /** Color del icono de la cabecera. */
  tone?: "accent" | "success" | "warning" | "danger" | "info";
  /** Color de una zona o de un nodo de diagrama: tono, token (`chart-3`) o color libre. */
  color?: string;
  [key: string]: unknown;
}

export interface GraphNode<D extends NodeData = NodeData> {
  id: string;
  /** Posición de la esquina superior izquierda; relativa al grupo si tiene `parentId`. */
  position: Point;
  /** Tamaño fijo (redimensionado). Sin él, el que mida el nodo. */
  size?: Size;
  /** Grupo que lo contiene. */
  parentId?: string;
  /**
   * `group` pinta un grupo/subflujo y `zone` una zona (grupo con borde discontinuo, etiqueta y color: una DMZ, una
   * VLAN); `cloud` una nube y `folder` una tarjeta con pestaña de carpeta. Cualquier otro valor lo interpreta quien pinta.
   */
  type?: string;
  data: D;
  ports?: NodePort[];
  draggable?: boolean;
  selectable?: boolean;
}

export interface GraphEdge {
  id: string;
  source: string;
  sourcePort?: string;
  target: string;
  targetPort?: string;
  type?: EdgeType;
  animated?: boolean;
  label?: string;
  markerEnd?: "arrow" | "none";
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
  /** Grosor en px. Gana a `weight`. */
  width?: number;
  /** Valor que fija el grosor según la escala del lienzo (`edgeScale`): por ejemplo la velocidad, `"10G"`. */
  weight?: string | number;
  /** Tipo de línea. Por defecto `solid`. */
  dash?: "solid" | "dashed" | "dotted";
  /** Línea doble con núcleo (un troncal). */
  double?: boolean;
  /** Color: tono (`accent`), token (`chart-3`) o color libre (`#58a6ff`). Gana a `tone`. */
  color?: string;
  /** Etiqueta junto al origen («10G» al lado del puerto). */
  sourceLabel?: string;
  /** Etiqueta junto al destino. */
  targetLabel?: string;
  /** Categoría de la arista para la leyenda (`trunk`, `wan`, `console`…). */
  kind?: string;
}

export interface Graph<D extends NodeData = NodeData> {
  nodes: GraphNode<D>[];
  edges: GraphEdge[];
}

export const DEFAULT_NODE_SIZE: Size = { width: 200, height: 76 };
/** Un grupo o una zona: contiene nodos (`parentId`), se pinta debajo y se mueve con ellos. */
export const isGroup = (n: Pick<GraphNode, "type">) => n.type === "group" || n.type === "zone";
export const nodeLabel = (n: GraphNode | undefined) => (n ? String(n.data?.label ?? n.id) : "");

/** Índice por id. */
export function indexNodes<D extends NodeData>(nodes: readonly GraphNode<D>[]): Map<string, GraphNode<D>> {
  return new Map(nodes.map((n) => [n.id, n]));
}

/** Posición absoluta (suma la cadena de grupos; un ciclo de `parentId` se corta). */
export function absolutePosition(id: string, index: Map<string, GraphNode>): Point {
  let x = 0;
  let y = 0;
  const seen = new Set<string>();
  let cur = index.get(id);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    x += cur.position.x;
    y += cur.position.y;
    cur = cur.parentId ? index.get(cur.parentId) : undefined;
  }
  return { x, y };
}

/** Tamaño de un nodo: el fijo, el medido o el de por defecto. */
export const nodeSize = (n: GraphNode, measured?: ReadonlyMap<string, Size>): Size =>
  n.size ?? measured?.get(n.id) ?? (isGroup(n) ? { width: 360, height: 240 } : DEFAULT_NODE_SIZE);

/** Caja absoluta de cada nodo. */
export function nodeRects(nodes: readonly GraphNode[], measured?: ReadonlyMap<string, Size>): Map<string, Rect> {
  const index = indexNodes(nodes);
  const out = new Map<string, Rect>();
  for (const n of nodes) out.set(n.id, { ...absolutePosition(n.id, index), ...nodeSize(n, measured) });
  return out;
}

/** Ids de los ancestros (grupos) de un nodo, del más cercano al más lejano. */
export function ancestors(id: string, index: Map<string, GraphNode>): string[] {
  const out: string[] = [];
  let cur = index.get(id)?.parentId;
  while (cur && !out.includes(cur) && cur !== id) {
    out.push(cur);
    cur = index.get(cur)?.parentId;
  }
  return out;
}

/** Ids de todos los descendientes de un grupo. */
export function descendants(id: string, nodes: readonly GraphNode[]): string[] {
  const kids = new Map<string, string[]>();
  for (const n of nodes) if (n.parentId) kids.set(n.parentId, [...(kids.get(n.parentId) ?? []), n.id]);
  const out: string[] = [];
  const stack = [...(kids.get(id) ?? [])];
  while (stack.length) {
    const cur = stack.pop()!;
    if (out.includes(cur) || cur === id) continue;
    out.push(cur);
    stack.push(...(kids.get(cur) ?? []));
  }
  return out;
}

/** Orden de pintado: un grupo antes que sus hijos (y los grupos debajo de los nodos sueltos). */
export function paintOrder(nodes: readonly GraphNode[]): GraphNode[] {
  const index = indexNodes(nodes);
  const depth = (n: GraphNode) => ancestors(n.id, index).length;
  return [...nodes]
    .map((n, i) => ({ n, i, d: depth(n), g: isGroup(n) ? 0 : 1 }))
    .sort((a, b) => a.d - b.d || a.g - b.g || a.i - b.i)
    .map((e) => e.n);
}

export interface Adjacency {
  outgoing: Map<string, GraphEdge[]>;
  incoming: Map<string, GraphEdge[]>;
}

export function adjacency(edges: readonly GraphEdge[]): Adjacency {
  const outgoing = new Map<string, GraphEdge[]>();
  const incoming = new Map<string, GraphEdge[]>();
  for (const e of edges) {
    if (!outgoing.has(e.source)) outgoing.set(e.source, []);
    if (!incoming.has(e.target)) incoming.set(e.target, []);
    outgoing.get(e.source)!.push(e);
    incoming.get(e.target)!.push(e);
  }
  return { outgoing, incoming };
}

/** Verdadero si se llega de `from` a `to` siguiendo aristas. */
export function reaches(from: string, to: string, edges: readonly GraphEdge[]): boolean {
  const { outgoing } = adjacency(edges);
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === to) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const e of outgoing.get(cur) ?? []) stack.push(e.target);
  }
  return false;
}

/** Verdadero si añadir `source → target` cierra un ciclo. */
export const wouldCreateCycle = (source: string, target: string, edges: readonly GraphEdge[]) =>
  source === target || reaches(target, source, edges);

/** Verdadero si el grafo tiene algún ciclo. */
export function hasCycle(ids: readonly string[], edges: readonly GraphEdge[]): boolean {
  return topologicalOrder(ids, edges).length < new Set(ids).size;
}

/**
 * Orden topológico (Kahn) de `ids`, estable respecto al orden recibido. Los nodos de un ciclo no aparecen: si la
 * longitud no coincide, hay ciclo.
 */
export function topologicalOrder(ids: readonly string[], edges: readonly GraphEdge[]): string[] {
  const set = new Set(ids);
  const indeg = new Map<string, number>([...set].map((id) => [id, 0]));
  const out = new Map<string, string[]>();
  for (const e of edges) {
    if (!set.has(e.source) || !set.has(e.target)) continue;
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
    out.set(e.source, [...(out.get(e.source) ?? []), e.target]);
  }
  const order: string[] = [];
  const queue = [...set].filter((id) => indeg.get(id) === 0);
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const t of out.get(id) ?? []) {
      indeg.set(t, indeg.get(t)! - 1);
      if (indeg.get(t) === 0) queue.push(t);
    }
  }
  return order;
}

/** Ids de los nodos cuya caja corta `area` (lo que hay que pintar). */
export function visibleNodes(rects: ReadonlyMap<string, Rect>, area: Rect): Set<string> {
  const out = new Set<string>();
  for (const [id, r] of rects) if (intersects(r, area)) out.add(id);
  return out;
}

// Textos.

export interface GraphLabels {
  /** «{count} nodes, {edges} connections». */
  graphSummary: string;
  /** «{inputs} inputs, {outputs} outputs». */
  nodePorts: string;
  /** «connected to {list}». */
  nodeTargets: string;
  /** «receives from {list}». */
  nodeSources: string;
  /** «not connected». */
  nodeAlone: string;
  /** Estados. */
  status: Record<NodeStatus, string>;
  /** «group with {count} nodes». */
  groupSummary: string;
}

export const GRAPH_LABELS: GraphLabels = {
  graphSummary: "{count} nodes, {edges} connections",
  nodePorts: "{inputs} inputs, {outputs} outputs",
  nodeTargets: "connected to {list}",
  nodeSources: "receives from {list}",
  nodeAlone: "not connected",
  status: { idle: "", running: "running", success: "succeeded", error: "error" },
  groupSummary: "group with {count} nodes",
};

const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));

/** Lista legible («A, B and C»; en el idioma de `locale`, inglés por defecto como los textos). */
const listFormats = new Map<string, Intl.ListFormat | null>();
export function listText(items: string[], locale = "en"): string {
  let f = listFormats.get(locale);
  if (f === undefined) {
    try {
      f = new Intl.ListFormat(locale, { type: "conjunction" });
    } catch {
      f = null;
    }
    listFormats.set(locale, f);
  }
  return f ? f.format(items) : items.join(", ");
}

/** Descripción de un nodo: estado, puertos y conexiones («2 inputs, 1 output; connected to Filter and Save»). */
export function describeNode(
  graph: Graph,
  id: string,
  labels: GraphLabels = GRAPH_LABELS,
  locale?: string,
  adj = adjacency(graph.edges),
  index: Map<string, GraphNode> = indexNodes(graph.nodes),
): string {
  const node = index.get(id);
  if (!node) return "";
  const parts: string[] = [];
  const status = node.data?.status ? labels.status[node.data.status] : "";
  if (status) parts.push(status);
  if (isGroup(node)) {
    parts.push(fill(labels.groupSummary, { count: graph.nodes.filter((n) => n.parentId === id).length }));
    return parts.join("; ");
  }
  const ports = node.ports ?? [];
  if (ports.length)
    parts.push(
      fill(labels.nodePorts, {
        inputs: ports.filter((p) => p.kind === "target").length,
        outputs: ports.filter((p) => p.kind === "source").length,
      }),
    );
  const targets = [...new Set((adj.outgoing.get(id) ?? []).map((e) => nodeLabel(index.get(e.target))))];
  const sources = [...new Set((adj.incoming.get(id) ?? []).map((e) => nodeLabel(index.get(e.source))))];
  if (targets.length) parts.push(fill(labels.nodeTargets, { list: listText(targets, locale) }));
  if (sources.length) parts.push(fill(labels.nodeSources, { list: listText(sources, locale) }));
  if (!targets.length && !sources.length) parts.push(labels.nodeAlone);
  return parts.join("; ");
}

/** Resumen del grafo («12 nodes, 14 connections»). */
export const describeGraph = (graph: Graph, labels: GraphLabels = GRAPH_LABELS) =>
  fill(labels.graphSummary, { count: graph.nodes.length, edges: graph.edges.length });

/** Grafo como JSON estable (para copiar, guardar o comparar). */
export const serializeGraph = (graph: Graph): string => JSON.stringify({ nodes: graph.nodes, edges: graph.edges });

/** Lee un grafo de JSON; lo que no tenga forma de nodo o de arista se descarta. */
export function parseGraph(text: string): Graph | null {
  try {
    const raw = JSON.parse(text) as { nodes?: unknown; edges?: unknown };
    if (!raw || !Array.isArray(raw.nodes)) return null;
    const nodes = (raw.nodes as GraphNode[]).filter(
      (n) => n && typeof n.id === "string" && n.position && Number.isFinite(n.position.x) && Number.isFinite(n.position.y),
    );
    const ids = new Set(nodes.map((n) => n.id));
    const edges = (Array.isArray(raw.edges) ? (raw.edges as GraphEdge[]) : []).filter(
      (e) => e && typeof e.id === "string" && ids.has(e.source) && ids.has(e.target),
    );
    return { nodes: nodes.map((n) => ({ ...n, data: n.data ?? {} })), edges };
  } catch {
    return null;
  }
}
