// Lienzo de nodos sin framework: un `.z-node-canvas[data-z-node-canvas]` dentro de `[data-z-dom]` con sus nodos
// (`.z-node[data-id][data-x][data-y]` y `.z-node-group`) como hijos y las aristas en un
// `<script type="application/json" class="z-node-canvas__edges">` (o el grafo entero en `script[data-graph]`). La
// interacción es la misma que la del binding de React (core/node-canvas); aquí se leen los nodos del marcado, se
// mueven a sus capas y se ponen y quitan del documento según se vean. Los nodos nuevos (pegar, duplicar) se clonan del
// original; los que llegan solo en el modelo se pintan con el árbol por defecto (core/node-view). El texto de la
// aplicación entra siempre como texto. Avisos: `z:graphchange`, `z:viewportchange`, `z:selectionchange`, `z:connect`.

import { registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { arrowsPointingIn } from "@zuccadev-labs/zuix-zicon/icons/arrows-pointing-in";
import { arrowUturnUpLeft } from "@zuccadev-labs/zuix-zicon/icons/arrow-uturn-up-left";
import { arrowUturnUpRight } from "@zuccadev-labs/zuix-zicon/icons/arrow-uturn-up-right";
import { lockClosed } from "@zuccadev-labs/zuix-zicon/icons/lock-closed";
import { lockOpen } from "@zuccadev-labs/zuix-zicon/icons/lock-open";
import { magnifyingGlassMinus } from "@zuccadev-labs/zuix-zicon/icons/magnifying-glass-minus";
import { magnifyingGlassPlus } from "@zuccadev-labs/zuix-zicon/icons/magnifying-glass-plus";
import { squares2x2 } from "@zuccadev-labs/zuix-zicon/icons/squares-2x2";
import {
  absolutePosition,
  type Graph,
  type GraphEdge,
  type GraphNode,
  indexNodes,
  isGroup,
  type NodePort,
  type NodeStatus,
  parseGraph,
} from "../core/graph";
import { bindNodeCanvas, type NodeCanvasHandle } from "../core/node-canvas";
import { controlsTree, listViewTree, mergeNodeLabels, minimapTree, type NodeCanvasLabels, nodeTree } from "../core/node-view";
import { setToolbarStop } from "../core/toolbar";
import type { Viewport } from "../core/viewport";
import { yes } from "../core/widget";
import { emit, inDom } from "./forms-popup";
import { byRef, type DomPart } from "./shared";
import { patchChildren } from "./vtree";

registerIcons([
  arrowsPointingIn,
  arrowUturnUpLeft,
  arrowUturnUpRight,
  lockClosed,
  lockOpen,
  magnifyingGlassMinus,
  magnifyingGlassPlus,
  squares2x2,
]);

interface Mounted {
  handle: NodeCanvasHandle;
  /** Elemento de cada nodo, esté o no en el documento. */
  els: Map<string, HTMLElement>;
  labels: NodeCanvasLabels;
}
const mounted = new Map<HTMLElement, Mounted>();

const num = (v: string | undefined) => (v !== undefined && v !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined);

function readJSON(el: HTMLElement, selector: string): unknown {
  const script = el.querySelector<HTMLScriptElement>(selector);
  if (!script?.textContent) return undefined;
  try {
    return JSON.parse(script.textContent) as unknown;
  } catch {
    return undefined;
  }
}

/** Un nodo del marcado → nodo del modelo. */
function readNode(el: HTMLElement): GraphNode | null {
  const id = el.dataset.id;
  if (!id) return null;
  const group = el.classList.contains("z-node-group") || el.dataset.type === "group" || el.dataset.type === "zone";
  const label = el.querySelector(".z-node__title, .z-node-group__title")?.textContent?.trim() || el.getAttribute("aria-label") || id;
  const ports: NodePort[] = [...el.querySelectorAll<HTMLElement>(".z-node-port")].map((p) => ({
    id: p.dataset.port ?? "",
    kind: p.dataset.kind === "target" ? "target" : "source",
    side: (p.dataset.side as NodePort["side"]) || undefined,
    type: p.dataset.type || undefined,
    label: p.querySelector(".z-node-port__label")?.textContent?.trim() || undefined,
    max: num(p.dataset.max),
  }));
  // Conectores que dibuja el cuerpo (PortPanel): puertos `anchor`, de salida salvo que digan otra cosa.
  for (const a of el.querySelectorAll<HTMLElement>("[data-port-anchor][data-port]")) {
    if (ports.some((p) => p.id === a.dataset.port)) continue;
    ports.push({
      id: a.dataset.port ?? "",
      kind: a.dataset.kind === "target" ? "target" : "source",
      side: (a.dataset.side as NodePort["side"]) || "bottom",
      anchor: true,
    });
  }
  const w = num(el.dataset.width);
  const h = num(el.dataset.height);
  const node: GraphNode = {
    id,
    position: { x: num(el.dataset.x) ?? 0, y: num(el.dataset.y) ?? 0 },
    data: { label, status: (el.dataset.status as NodeStatus) || undefined },
  };
  if (group) node.type = el.dataset.type === "zone" ? "zone" : "group";
  else if (el.dataset.type) node.type = el.dataset.type;
  if (el.dataset.parent) node.parentId = el.dataset.parent;
  if (w && h) node.size = { width: w, height: h };
  if (ports.length) node.ports = ports;
  if (el.dataset.draggable === "false") node.draggable = false;
  return node;
}

/** Elemento de un nodo que solo existe en el modelo: el árbol por defecto. */
function createNodeElement(doc: Document, node: GraphNode, graph: Graph, labels: NodeCanvasLabels): HTMLElement {
  const holder = doc.createElement("div");
  const p = absolutePosition(node.id, indexNodes(graph.nodes));
  patchChildren(holder, [nodeTree(node, p.x, p.y, labels)]);
  return holder.firstElementChild as HTMLElement;
}

function mount(root: HTMLElement): Mounted {
  const known = mounted.get(root);
  if (known) return known;
  const doc = root.ownerDocument;
  const props = (readJSON(root, ':scope > script[type="application/json"][data-props]') ?? {}) as {
    labels?: Partial<NodeCanvasLabels>;
    viewport?: Viewport;
  };
  const labels = mergeNodeLabels(props.labels);
  const full = readJSON(root, ':scope > script[type="application/json"][data-graph]');
  let graph: Graph = { nodes: [], edges: [] };
  const els = new Map<string, HTMLElement>();
  const markup = [...root.querySelectorAll<HTMLElement>(".z-node[data-id], .z-node-group[data-id]")].filter(
    (el) => el.closest(".z-node-canvas") === root,
  );
  if (full) graph = parseGraph(JSON.stringify(full)) ?? graph;
  else {
    graph.nodes = markup.map(readNode).filter((n): n is GraphNode => !!n);
    const edges =
      readJSON(root, ':scope > script[type="application/json"].z-node-canvas__edges') ??
      (root.dataset.edges ? safeParse(root.dataset.edges) : []);
    graph = parseGraph(JSON.stringify({ nodes: graph.nodes, edges: Array.isArray(edges) ? (edges as GraphEdge[]) : [] })) ?? graph;
  }
  for (const el of markup) if (el.dataset.id) els.set(el.dataset.id, el);
  for (const el of markup) el.remove();
  // Cromo que falte: controles y minimapa (se quitan con data-controls="false" y data-minimap="false").
  if (root.dataset.controls !== "false" && !root.querySelector(".z-node-controls")) {
    const holder = doc.createElement("div");
    patchChildren(holder, [controlsTree(labels, { showLayout: yes(root.dataset.layoutButton) })]);
    root.append(...holder.childNodes);
  }
  if (root.dataset.minimap !== "false" && !root.querySelector(".z-node-minimap")) {
    const holder = doc.createElement("div");
    patchChildren(holder, [minimapTree(labels)]);
    root.append(...holder.childNodes);
  }
  const bar = root.querySelector<HTMLElement>('.z-node-controls[role="toolbar"]');
  if (bar) setToolbarStop(bar);
  const snapAttr = root.dataset.snap;
  const entry = { els, labels } as Mounted;
  const layers = () => ({
    groups: root.querySelector<HTMLElement>(".z-node-canvas__groups")!,
    nodes: root.querySelector<HTMLElement>(".z-node-canvas__nodes")!,
  });
  const elementFor = (node: GraphNode, from?: string): HTMLElement => {
    let el = els.get(node.id);
    if (el) return el;
    const source = from ? els.get(from) : undefined;
    if (source) {
      el = source.cloneNode(true) as HTMLElement;
      el.dataset.id = node.id;
      for (const k of ["zTabindex"]) delete el.dataset[k];
      el.removeAttribute("aria-describedby");
      el.removeAttribute("data-selected");
    } else el = createNodeElement(doc, node, entry.handle?.graph ?? graph, labels);
    els.set(node.id, el);
    return el;
  };
  const sync = (ids: ReadonlySet<string>) => {
    const { groups, nodes } = layers();
    const g = entry.handle?.graph ?? graph;
    const index = indexNodes(g.nodes);
    for (const [id, el] of els) {
      if (!index.has(id)) {
        el.remove();
        els.delete(id);
      } else if (!ids.has(id)) el.remove();
    }
    for (const id of ids) {
      const node = index.get(id);
      if (!node) continue;
      const el = elementFor(node);
      const layer = isGroup(node) ? groups : nodes;
      if (el.parentElement !== layer) layer.append(el);
    }
  };
  const handle = bindNodeCanvas(root, {
    graph,
    viewport: props.viewport,
    minZoom: num(root.dataset.minZoom),
    maxZoom: num(root.dataset.maxZoom),
    snap: snapAttr === "false" ? false : (num(snapAttr) ?? 16),
    readOnly: yes(root.dataset.readonly),
    edgeType: (root.dataset.edgeType as GraphEdge["type"]) || undefined,
    cull: root.dataset.cull !== "false",
    allowCycles: root.dataset.allowCycles !== "false",
    fitOnMount: root.dataset.fit !== "false",
    labels: props.labels,
    onVisible: (ids) => sync(ids),
    onGraphChange: (next, change) => {
      if (change.from) {
        const index = indexNodes(next.nodes);
        for (const [id, from] of Object.entries(change.from)) {
          const node = index.get(id);
          if (node) elementFor(node, from);
        }
      }
      sync(handle.visible);
      for (const list of lists(root)) paintList(list, next, labels, yes(root.dataset.readonly));
      emit(root, "graphchange", { graph: next, change });
    },
    onViewportChange: (viewport) => emit(root, "viewportchange", { viewport }),
    onSelectionChange: (selection) => emit(root, "selectionchange", selection),
    onConnect: (edge) => emit(root, "connect", { edge }),
    onLockChange: (locked) => emit(root, "lockchange", { locked }),
  });
  entry.handle = handle;
  mounted.set(root, entry);
  sync(handle.visible);
  handle.refresh();
  for (const list of lists(root)) paintList(list, handle.graph, labels, yes(root.dataset.readonly));
  return entry;
}

const safeParse = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return [];
  }
};

/** Vistas en lista ligadas a un lienzo: `.z-node-list[data-for="#id"]`. */
const lists = (root: HTMLElement) =>
  [...root.ownerDocument.querySelectorAll<HTMLElement>(".z-node-list[data-for]")].filter(
    (l) => byRef(l.dataset.for, l.ownerDocument) === root,
  );

function paintList(list: HTMLElement, graph: Graph, labels: NodeCanvasLabels, readOnly: boolean): void {
  patchChildren(list, listViewTree(graph, labels, readOnly).c ?? []);
}

function onListClick(event: Event): void {
  const button = (event.target as Element).closest?.<HTMLElement>(".z-node-list[data-for] [data-node-action]");
  const list = button?.closest<HTMLElement>(".z-node-list[data-for]");
  if (!button || !list) return;
  const root = byRef(list.dataset.for, list.ownerDocument);
  const entry = root instanceof HTMLElement ? mounted.get(root) : undefined;
  if (!entry) return;
  if (button.dataset.nodeAction === "show" && button.dataset.node) entry.handle.focusNode(button.dataset.node);
  if (button.dataset.nodeAction === "remove-edge" && button.dataset.edge) entry.handle.removeEdge(button.dataset.edge);
}

/** API de un lienzo montado (o `null` si `el` no lo es): encajar, zoom, deshacer, ordenar, foco, modelo. */
export function nodeCanvas(el: HTMLElement): NodeCanvasHandle | null {
  return mounted.get(el)?.handle ?? null;
}

/** Cambia el modelo de un lienzo montado (los nodos que solo están en el modelo se pintan con el árbol por defecto). */
export function setNodeGraph(el: HTMLElement, graph: Graph): void {
  const entry = mounted.get(el);
  if (!entry) return;
  entry.handle.setGraph(graph);
  for (const list of lists(el)) paintList(list, graph, entry.labels, yes(el.dataset.readonly));
}

/** Desmonta un lienzo (listeners y observadores). */
export function destroyNodeCanvas(el: HTMLElement): void {
  const entry = mounted.get(el);
  if (!entry) return;
  entry.handle.dispose();
  mounted.delete(el);
}

export const nodesPart: DomPart = {
  rank: 46,
  setup(on) {
    on(document, "click", onListClick);
  },
  hydrate(root) {
    const found = [...root.querySelectorAll<HTMLElement>(".z-node-canvas[data-z-node-canvas]")];
    if (root instanceof HTMLElement && root.matches(".z-node-canvas[data-z-node-canvas]")) found.unshift(root);
    for (const el of found) if (inDom(el) && !mounted.has(el)) mount(el);
    for (const [el, entry] of mounted) {
      if (!el.isConnected) destroyNodeCanvas(el);
      else
        for (const list of lists(el))
          if (!list.firstElementChild) paintList(list, entry.handle.graph, entry.labels, yes(el.dataset.readonly));
    }
  },
  teardown() {
    for (const el of [...mounted.keys()]) destroyNodeCanvas(el);
  },
};
