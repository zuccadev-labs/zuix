// Puertos de un nodo: lado y posición de cada uno (repartidos a lo largo del lado, la misma fracción que usa la hoja
// con `--z-port-t`), punto de anclaje absoluto de una arista y validación de una conexión (sentido, tipos, límites,
// duplicadas y ciclos). Puro, sin documento.

import type { Side } from "./edge-path";
import { type Graph, type GraphEdge, type GraphNode, type NodePort, wouldCreateCycle } from "./graph";
import type { Point, Rect } from "./viewport";

export const portSide = (p: Pick<NodePort, "kind" | "side">): Side => p.side ?? (p.kind === "target" ? "left" : "right");

/** Fracción (0–1) a lo largo del lado de cada puerto: `(i + 1) / (n + 1)` entre los del mismo lado. */
export function portFractions(ports: readonly NodePort[]): Map<string, number> {
  const bySide = new Map<Side, NodePort[]>();
  for (const p of ports) bySide.set(portSide(p), [...(bySide.get(portSide(p)) ?? []), p]);
  const out = new Map<string, number>();
  for (const list of bySide.values())
    list.forEach((p, i) => {
      out.set(p.id, (i + 1) / (list.length + 1));
    });
  return out;
}

/** Punto de un lado de `rect` a la fracción `t`. */
export function sidePoint(rect: Rect, side: Side, t: number): Point {
  if (side === "left") return { x: rect.x, y: rect.y + rect.height * t };
  if (side === "right") return { x: rect.x + rect.width, y: rect.y + rect.height * t };
  if (side === "top") return { x: rect.x + rect.width * t, y: rect.y };
  return { x: rect.x + rect.width * t, y: rect.y + rect.height };
}

export interface Anchor {
  point: Point;
  side: Side;
}

/**
 * Anclaje de una arista en un nodo: el puerto indicado o, sin él, el primero del sentido que toca (salida para el
 * origen, entrada para el destino); sin puertos, el centro del lado por defecto.
 */
export function anchorOf(node: GraphNode, rect: Rect, portId: string | undefined, kind: "source" | "target"): Anchor {
  const ports = node.ports ?? [];
  const port = (portId ? ports.find((p) => p.id === portId) : undefined) ?? ports.find((p) => p.kind === kind);
  if (!port) {
    const side: Side = kind === "source" ? "right" : "left";
    return { side, point: sidePoint(rect, side, 0.5) };
  }
  const side = portSide(port);
  return { side, point: sidePoint(rect, side, portFractions(ports).get(port.id) ?? 0.5) };
}

/** Tipos de un puerto (`"json text"` → dos). Vacío o `any` acepta cualquiera. */
const typesOf = (p: NodePort) => (p.type ?? "").split(/\s+/).filter(Boolean);
export function typesMatch(a: NodePort, b: NodePort): boolean {
  const ta = typesOf(a);
  const tb = typesOf(b);
  if (!ta.length || !tb.length || ta.includes("any") || tb.includes("any")) return true;
  return ta.some((t) => tb.includes(t));
}

export interface PortRef {
  node: string;
  port?: string;
}

export type ConnectionProblem = "same-node" | "direction" | "type" | "limit" | "duplicate" | "cycle" | "missing";

export interface ConnectOptions {
  /** Permite ciclos. Por defecto sí (un flujo con bucle es válido); con `false` se rechazan. */
  allowCycles?: boolean;
  /** Arista que se está reconectando: no cuenta para límites ni duplicadas. */
  ignoreEdge?: string;
}

/**
 * Por qué no se puede conectar `from` con `to`, o `null` si se puede. `from` puede ser un puerto de entrada: la
 * conexión se normaliza (origen = salida) antes de comprobar.
 */
export function connectionProblem(graph: Graph, from: PortRef, to: PortRef, o: ConnectOptions = {}): ConnectionProblem | null {
  const a = graph.nodes.find((n) => n.id === from.node);
  const b = graph.nodes.find((n) => n.id === to.node);
  if (!a || !b) return "missing";
  if (a.id === b.id) return "same-node";
  const pa = from.port ? a.ports?.find((p) => p.id === from.port) : undefined;
  const pb = to.port ? b.ports?.find((p) => p.id === to.port) : undefined;
  if ((from.port && !pa) || (to.port && !pb)) return "missing";
  const ka = pa?.kind ?? "source";
  const kb = pb?.kind ?? "target";
  if (ka === kb) return "direction";
  if (pa && pb && !typesMatch(pa, pb)) return "type";
  const edge = normalizeConnection(from, ka, to);
  const others = graph.edges.filter((e) => e.id !== o.ignoreEdge);
  if (
    others.some(
      (e) =>
        e.source === edge.source &&
        e.target === edge.target &&
        (e.sourcePort ?? "") === (edge.sourcePort ?? "") &&
        (e.targetPort ?? "") === (edge.targetPort ?? ""),
    )
  )
    return "duplicate";
  const count = (node: string, port: string | undefined, end: "source" | "target") =>
    others.filter((e) => (end === "source" ? e.source === node && e.sourcePort === port : e.target === node && e.targetPort === port))
      .length;
  if (pa?.max !== undefined && count(a.id, pa.id, ka) >= pa.max) return "limit";
  if (pb?.max !== undefined && count(b.id, pb.id, kb) >= pb.max) return "limit";
  if (o.allowCycles === false && wouldCreateCycle(edge.source, edge.target, others)) return "cycle";
  return null;
}

/** La conexión con el origen en la salida, sea cual sea el puerto desde el que se empezó. */
export function normalizeConnection(from: PortRef, fromKind: "source" | "target", to: PortRef): Omit<GraphEdge, "id"> {
  return fromKind === "source"
    ? { source: from.node, sourcePort: from.port, target: to.node, targetPort: to.port }
    : { source: to.node, sourcePort: to.port, target: from.node, targetPort: from.port };
}

/** Puertos de otros nodos a los que se puede conectar desde `from`, en orden del modelo. */
export function compatiblePorts(graph: Graph, from: PortRef, o: ConnectOptions = {}): PortRef[] {
  const out: PortRef[] = [];
  for (const n of graph.nodes)
    for (const p of n.ports ?? []) {
      const to = { node: n.id, port: p.id };
      if (!connectionProblem(graph, from, to, o)) out.push(to);
    }
  return out;
}
