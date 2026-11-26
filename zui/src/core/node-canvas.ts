// Lienzo de nodos conectado al documento: lo comparten el binding de React y el modo DOM, que pintan los nodos (HTML)
// dentro de `.z-node-canvas__nodes` y los grupos en `.z-node-canvas__groups`. Aquí viven la vista (zoom y
// desplazamiento con rueda, arrastre, pellizco y teclado), las aristas (capa SVG, solo las que se ven), el arrastre
// de nodos con imán, la caja de selección, conectar y reconectar con el puntero y con el teclado, redimensionar,
// copiar, pegar y duplicar, deshacer y rehacer, agrupar, la disposición automática, el minimapa, los controles y los
// anuncios (anunciador central). Los nodos que no se ven no se pintan: quien monta recibe la lista con `onVisible`.
// Nada de esto corre al importar: todo empieza en `bindNodeCanvas(root, options)`.

import { announce } from "./announcer";
import { edgeRoute, type EdgeRoute, type EdgeType, polylineMidpoint, roundedPath, routeBounds, type Side } from "./edge-path";
import { dashArray, edgeColor, edgeWidth, type EdgeWidthScale, pointAlong } from "./edge-style";
import { cloneForExport, cloneToSVG, type ExportOptions, svgToPNG } from "./export-image";
import { type OrthogonalOptions, routeOrthogonal } from "./orthogonal-route";
import {
  addEdge,
  copyFragment,
  dragPositions,
  duplicate,
  groupNodes,
  pasteFragment,
  reconnectEdge,
  removeElements,
  resizeNode,
  setPositions,
  topmost,
  ungroup,
} from "./graph-edit";
import {
  adjacency,
  type Adjacency,
  describeGraph,
  describeNode,
  type Graph,
  type GraphEdge,
  indexNodes,
  isGroup,
  nodeLabel,
  nodeRects,
  nodeSize,
  paintOrder,
  parseGraph,
  serializeGraph,
} from "./graph";
import { layeredLayout } from "./layout-layers";
import { minimapProjection, minimapView, viewportFromMinimap } from "./minimap";
import { mergeNodeLabels, type NodeCanvasLabels, nodeVars, portLabel } from "./node-view";
import { anchorOf, compatiblePorts, connectionProblem, normalizeConnection, type PortRef, portSide } from "./ports";
import { boxSelection } from "./selection";
import { arrowDirection, nextInDirection } from "./spatial";
import { createUndoStack } from "./undo";
import {
  clampZoom,
  containsRect,
  DEFAULT_VIEWPORT,
  expandRect,
  fitRect,
  intersects,
  MAX_ZOOM,
  MIN_ZOOM,
  panBy,
  pinchViewport,
  type Point,
  type Rect,
  rectFromPoints,
  revealRect,
  type Size,
  toWorld,
  unionRect,
  type Viewport,
  visibleRect,
  wheelFactor,
  ZOOM_STEP,
  zoomTo,
} from "./viewport";
import { pauseOffscreen } from "./visibility";

export type GraphChangeType =
  | "move"
  | "resize"
  | "remove"
  | "connect"
  | "reconnect"
  | "paste"
  | "duplicate"
  | "group"
  | "ungroup"
  | "layout"
  | "undo"
  | "redo"
  | "update";

export interface GraphChange {
  type: GraphChangeType;
  /** Nodos o aristas afectados. */
  ids?: string[];
  /** Fin de un gesto (soltar el arrastre): los pasos intermedios llegan con `done: false`. */
  done?: boolean;
  /** Pegar y duplicar: id nuevo → id copiado. */
  from?: Record<string, string>;
}

export interface CanvasSelection {
  nodes: string[];
  edges: string[];
}

export interface NodeCanvasOptions {
  graph: Graph;
  viewport?: Viewport;
  minZoom?: number;
  maxZoom?: number;
  /** Cuadrícula del imán en unidades del mundo, o `false`. Por defecto 16. */
  snap?: number | false;
  /** Solo lectura: se mira y se navega, no se edita. */
  readOnly?: boolean;
  /** Tipo de arista por defecto. */
  edgeType?: EdgeType;
  /** Sentido de la disposición automática del botón «Arrange nodes»: `LR` (por defecto) o `TB`. */
  layoutDirection?: "LR" | "TB";
  /** Ciclos permitidos al conectar. Por defecto sí. */
  allowCycles?: boolean;
  /** Validación propia, además de sentido, tipos y límites. */
  isValidConnection?: (edge: Omit<GraphEdge, "id">) => boolean;
  /**
   * Encuadra el grafo al montar (si no llega `viewport`) sin bajar del 80 %, donde el texto de los nodos aún se lee;
   * si a ese zoom no cabe, empieza por su principio y el resto se ve desplazando. Por defecto sí.
   */
  fitOnMount?: boolean;
  labels?: Partial<NodeCanvasLabels>;
  locale?: string;
  /** Margen (px de pantalla) alrededor de lo visible en el que ya se pintan nodos y aristas. Por defecto 240. */
  overscan?: number;
  /**
   * Pintar solo lo que se ve. Por defecto sí; con `false` se pintan todos los nodos y aristas (un diagrama pequeño que
   * se imprime o se exporta entero).
   */
  cull?: boolean;
  /** Escala de grosores de las aristas con `weight` (por defecto, velocidades de enlace: 10G, 2.5G, 1G, 100M…). */
  edgeScale?: EdgeWidthScale;
  /** Opciones del enrutado `orthogonal`: margen, radio, separación de carriles. */
  routing?: OrthogonalOptions;
  onGraphChange?: (graph: Graph, change: GraphChange) => void;
  onViewportChange?: (viewport: Viewport) => void;
  onSelectionChange?: (selection: CanvasSelection) => void;
  onConnect?: (edge: GraphEdge) => void;
  /** Ids de los nodos que hay que pintar (los visibles, el enfocado y los que se arrastran). */
  onVisible?: (ids: ReadonlySet<string>) => void;
  /** Bloqueo cambiado desde los controles. */
  onLockChange?: (locked: boolean) => void;
}

export interface NodeCanvasHandle {
  /** Modelo nuevo desde fuera (props controladas). No se guarda en el historial. */
  setGraph(graph: Graph): void;
  setViewport(viewport: Viewport): void;
  setOptions(options: Partial<Omit<NodeCanvasOptions, "graph" | "viewport">>): void;
  setSelection(selection: Partial<CanvasSelection>): void;
  /** Tras pintar nodos nuevos: los coloca y les da foco itinerante. */
  refresh(): void;
  fitView(padding?: number): void;
  zoomIn(): void;
  zoomOut(): void;
  zoomTo(zoom: number): void;
  undo(): void;
  redo(): void;
  layout(direction?: "LR" | "TB"): void;
  focusNode(id: string): void;
  /** Borra la selección (con anuncio y deshacer). */
  removeSelection(): void;
  removeEdge(id: string): void;
  /** SVG autocontenido del diagrama completo (todos los nodos y aristas, al 100 %), sin el cromo. */
  exportSVG(options?: ExportOptions): Promise<string>;
  /** PNG del diagrama completo. */
  exportPNG(options?: ExportOptions): Promise<Blob>;
  /** Tamaño de cada nodo: el fijo o el medido en el documento (para recolocar con las medidas reales). */
  readonly sizes: ReadonlyMap<string, Size>;
  readonly graph: Graph;
  readonly viewport: Viewport;
  readonly selection: CanvasSelection;
  readonly locked: boolean;
  readonly visible: ReadonlySet<string>;
  dispose(): void;
}

const SVG = "http://www.w3.org/2000/svg";
const TONES = ["neutral", "accent", "success", "warning", "danger", "info"] as const;
/** Lo que no arrastra el nodo al pulsarlo: los controles de su cuerpo. */
const CONTROL =
  'a[href], button:not(.z-node-port), input, select, textarea, label, summary, [contenteditable]:not([contenteditable="false"]), [role="switch"], [role="slider"], [role="combobox"], [role="listbox"], [role="checkbox"], [role="radio"], [data-node-nodrag]';
const FOCUSABLE = 'a[href], button, input, select, textarea, summary, [tabindex], [contenteditable]:not([contenteditable="false"])';
const EDITABLE = ':read-write, select, input[type="range"], [role="slider"], [role="combobox"], [role="spinbutton"]';
const THRESHOLD = 4;
/** Zoom más bajo al que se lee el texto de un nodo: el que se usa como suelo al encuadrar al montar. */
const READABLE_ZOOM = 0.8;
const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));
const px = (n: number) => `${Math.round(n * 100) / 100}px`;

type Gesture =
  | { kind: "pan"; pointer: number; start: Point; vp: Viewport; moved: boolean }
  | { kind: "pinch"; ids: [number, number]; vp: Viewport; distance: number; center: Point }
  | {
      kind: "drag";
      pointer: number;
      start: Point;
      origin: Map<string, Point>;
      lead: string;
      before: Graph;
      moved: boolean;
      clicked: string;
      additive: boolean;
      /** Mayús+clic sobre uno ya seleccionado: al soltar sin mover, se quita. */
      toggleOff: boolean;
    }
  | { kind: "box"; pointer: number; start: Point; now: Point; base: Set<string>; moved: boolean }
  | { kind: "connect"; pointer: number; from: PortRef; fromKind: "source" | "target"; start: Point; now: Point; moved: boolean }
  | { kind: "reconnect"; pointer: number; edge: string; end: "source" | "target"; now: Point }
  | { kind: "resize"; pointer: number; node: string; start: Point; size: Size; before: Graph; moved: boolean }
  | { kind: "minimap"; pointer: number };

interface Connecting {
  from: PortRef;
  fromKind: "source" | "target";
  candidates: PortRef[];
  index: number;
  keyboard: boolean;
}

interface EdgeEls {
  g: SVGGElement;
  hit: SVGPathElement;
  path: SVGPathElement;
  /** Núcleo de una línea doble. */
  core: SVGPathElement | null;
  label: HTMLElement | null;
  /** Etiquetas de los extremos. */
  ends: { source: HTMLElement | null; target: HTMLElement | null };
  key: string;
}

/** Busca (o crea) un hijo con la clase pedida. */
function part<K extends keyof HTMLElementTagNameMap>(
  parent: Element,
  cls: string,
  tag: K,
  before?: Element | null,
): HTMLElementTagNameMap[K] {
  const found = parent.querySelector<HTMLElementTagNameMap[K]>(`:scope > .${cls}`);
  if (found) return found;
  const el = parent.ownerDocument.createElement(tag);
  el.className = cls;
  parent.insertBefore(el, before ?? null);
  return el;
}

function svgEl<K extends keyof SVGElementTagNameMap>(doc: Document, tag: K, attrs: Record<string, string> = {}): SVGElementTagNameMap[K] {
  const el = doc.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

let seq = 0;

export function bindNodeCanvas(root: HTMLElement, initial: NodeCanvasOptions): NodeCanvasHandle {
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  const uid = root.id || `z-node-canvas-${++seq}`;
  if (!root.id) root.id = uid;
  let o: NodeCanvasOptions = { ...initial };
  let labels = mergeNodeLabels(o.labels);
  let graph: Graph = o.graph;
  let index = indexNodes(graph.nodes);
  let rects = new Map<string, Rect>();
  let adj: Adjacency = adjacency(graph.edges);
  const measured = new Map<string, Size>();
  /** Fracción medida de los puertos que dibuja el cuerpo del nodo (`anchor`), por nodo. */
  const portT = new Map<string, Map<string, number>>();
  /** Borde de arriba de los nodos con pestaña (carpetas): cuánto baja respecto a la caja, en unidades del mundo. */
  const insetTop = new Map<string, number>();
  /** Cambia con la geometría (modelo, medidas): las rutas ortogonales se recalculan con ella. */
  let geometry = 0;
  let vp: Viewport = o.viewport ?? DEFAULT_VIEWPORT;
  let selNodes = new Set<string>();
  let selEdges = new Set<string>();
  let current: string | null = null;
  let entered: string | null = null;
  let locked = false;
  let visible = new Set<string>();
  let gesture: Gesture | null = null;
  let connecting: Connecting | null = null;
  let chooser: HTMLElement | null = null;
  let suppressClick = false;
  let spaceDown = false;
  let pendingFocus: (() => HTMLElement | null) | null = null;
  let clipboard: Graph | null = null;
  let pastePending = false;
  let pasteCount = 0;
  let frame = 0;
  let dirty = { view: true, nodes: true, edges: true, minimap: true, chrome: true, cull: true };
  let emitPending: GraphChange | null = null;
  let disposed = false;
  const undo = createUndoStack<Graph>();
  const pointers = new Map<number, Point>();
  const nodeEls = new Map<string, HTMLElement>();
  const written = new WeakMap<HTMLElement, string>();
  const tamed = new WeakSet<HTMLElement>();
  const edgeEls = new Map<string, EdgeEls>();
  const routes = new Map<string, { key: string; route: EdgeRoute }>();
  const edgeBoxes = new Map<string, Rect>();
  let cullArea: Rect | null = null;
  let cullKey = "";
  let edgeBoxVersion = -1;
  const descriptions = new Map<string, { v: number; text: string }>();

  // Estructura: si falta alguna capa (marcado mínimo del modo DOM), se crea.
  const background = part(root, "z-node-canvas__background", "div", root.firstElementChild);
  background.setAttribute("aria-hidden", "true");
  const world = part(root, "z-node-canvas__world", "div", background.nextElementSibling);
  let edgeSvg = world.querySelector<SVGSVGElement>(":scope > svg.z-node-canvas__edges");
  if (!edgeSvg) {
    edgeSvg = svgEl(doc, "svg", { class: "z-node-canvas__edges", "aria-hidden": "true" });
    world.prepend(edgeSvg);
  }
  const edgeSvgEl = edgeSvg;
  const groupsLayer = part(world, "z-node-canvas__groups", "div", edgeSvgEl);
  const labelsLayer = part(world, "z-node-canvas__labels", "div");
  labelsLayer.setAttribute("aria-hidden", "true");
  const nodesLayer = part(world, "z-node-canvas__nodes", "div");
  // Extremos de la arista seleccionada: encima de los nodos, para poder cogerlos aunque caigan sobre un puerto.
  let overlay = world.querySelector<SVGSVGElement>(":scope > svg.z-node-canvas__overlay");
  if (!overlay) {
    overlay = svgEl(doc, "svg", { class: "z-node-canvas__overlay", "aria-hidden": "true" });
    world.append(overlay);
  }
  const overlayEl = overlay;
  const selectionBox = part(root, "z-node-canvas__selection", "div", world.nextElementSibling);
  selectionBox.hidden = true;
  const desc = part(root, "z-node-canvas__desc", "p");
  desc.classList.add("z-sr-only");
  desc.id ||= `${uid}-desc`;
  const descs = part(root, "z-node-canvas__descs", "div");
  descs.hidden = true;

  // Capa SVG: marcadores por tono, aristas y la arista en curso.
  let defs = edgeSvgEl.querySelector<SVGDefsElement>(":scope > defs");
  if (!defs) {
    defs = svgEl(doc, "defs");
    for (const tone of [...TONES, "selected"]) {
      const marker = svgEl(doc, "marker", {
        id: `${uid}-arrow-${tone}`,
        class: "z-node-canvas__marker",
        "data-tone": tone,
        viewBox: "0 0 12 12",
        // La punta queda a 5 px del final: no se esconde bajo el punto del puerto.
        refX: "15",
        refY: "6",
        markerWidth: "12",
        markerHeight: "12",
        markerUnits: "userSpaceOnUse",
        orient: "auto-start-reverse",
      });
      marker.append(svgEl(doc, "path", { d: "M 2 2 L 10 6 L 2 10 Z" }));
      defs.append(marker);
    }
    edgeSvgEl.prepend(defs);
  }
  const defsEl = defs;
  let edgeLayer = edgeSvgEl.querySelector<SVGGElement>(":scope > g.z-node-canvas__edge-layer");
  if (!edgeLayer) {
    edgeLayer = svgEl(doc, "g", { class: "z-node-canvas__edge-layer" });
    edgeSvgEl.append(edgeLayer);
  }
  const edgeLayerEl = edgeLayer;
  let draft = edgeSvgEl.querySelector<SVGPathElement>(":scope > path.z-node-canvas__draft");
  if (!draft) {
    draft = svgEl(doc, "path", { class: "z-node-canvas__draft" });
    edgeSvgEl.append(draft);
  }
  const draftEl = draft;
  draftEl.setAttribute("hidden", "");

  root.setAttribute("role", "group");
  root.setAttribute("aria-roledescription", labels.roleCanvas);
  if (!root.hasAttribute("aria-label") && !root.hasAttribute("aria-labelledby")) root.setAttribute("aria-label", labels.canvas);
  root.setAttribute("aria-describedby", desc.id);
  const stopPause = pauseOffscreen(root);

  const minimap = () => root.querySelector<HTMLElement>(".z-node-minimap");
  const controls = () => root.querySelector<HTMLElement>(".z-node-controls");
  const editable = () => !o.readOnly && !locked;
  // Tamaño del lienzo y del minimapa: se miden al montar y con ResizeObserver, nunca al pintar (leerlos tras escribir
  // estilos fuerza un cálculo de layout de toda la página en cada fotograma).
  let box: Size | null = null;
  let miniBox: Size | null = null;
  const size = (): Size => (box ??= { width: root.clientWidth || 1, height: root.clientHeight || 1 });
  // Caja del lienzo durante un gesto: se lee al empezar y no en cada movimiento.
  let gestureBox: DOMRect | null = null;
  const local = (e: { clientX: number; clientY: number }): Point => {
    const r = (gesture && gestureBox) || root.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const say = (text: string) => {
    if (text) announce(text, { source: root });
  };
  const nameOf = (id: string) => nodeLabel(index.get(id));
  const portName = (ref: PortRef) => {
    const p = index.get(ref.node)?.ports?.find((x) => x.id === ref.port);
    return p ? portLabel(p, labels) : nameOf(ref.node);
  };

  let version = 0;
  const recompute = () => {
    version++;
    geometry++;
    index = indexNodes(graph.nodes);
    rects = nodeRects(graph.nodes, measured);
    adj = adjacency(graph.edges);
  };
  recompute();

  const schedule = () => {
    if (frame || disposed) return;
    const raf = win?.requestAnimationFrame?.bind(win);
    if (raf) frame = raf(() => paint());
    else paint();
  };
  const invalidate = (parts: Partial<typeof dirty>) => {
    dirty = { ...dirty, ...parts };
    schedule();
  };
  const invalidateAll = () => invalidate({ view: true, nodes: true, edges: true, minimap: true, chrome: true, cull: true });

  // Cambios del modelo.
  const emitGraph = (change: GraphChange) => {
    o.onGraphChange?.(graph, change);
  };
  const pruneSelection = () => {
    const before = selNodes.size + selEdges.size;
    selNodes = new Set([...selNodes].filter((id) => index.has(id)));
    const edgeIds = new Set(graph.edges.map((e) => e.id));
    selEdges = new Set([...selEdges].filter((id) => edgeIds.has(id)));
    if (current && !index.has(current)) current = null;
    if (selNodes.size + selEdges.size !== before) emitSelection();
  };
  /** Aplica un modelo nuevo; con `record`, guarda el anterior para deshacer. Los pasos de un gesto se emiten por fotograma. */
  const commit = (next: Graph, change: GraphChange, record: { key?: string } | false = {}) => {
    if (record) undo.record(graph, record.key);
    graph = next;
    recompute();
    pruneSelection();
    if (change.done === false) {
      emitPending = change;
      invalidateAll();
      return;
    }
    emitPending = null;
    invalidateAll();
    emitGraph(change);
  };
  const emitSelection = () => o.onSelectionChange?.({ nodes: [...selNodes], edges: [...selEdges] });
  const setSelection = (nodes: Iterable<string>, edges: Iterable<string> = [], notify = true) => {
    const n = new Set([...nodes].filter((id) => index.has(id) && index.get(id)!.selectable !== false));
    const e = new Set(edges);
    const same =
      n.size === selNodes.size &&
      [...n].every((id) => selNodes.has(id)) &&
      e.size === selEdges.size &&
      [...e].every((id) => selEdges.has(id));
    selNodes = n;
    selEdges = e;
    if (!same) {
      version++;
      invalidate({ nodes: true, edges: true, minimap: true });
      if (notify) emitSelection();
    }
  };
  const setViewportInternal = (next: Viewport, notify = true) => {
    const z = clampZoom(next.zoom, o.minZoom ?? MIN_ZOOM, o.maxZoom ?? MAX_ZOOM);
    const v = { x: Number.isFinite(next.x) ? next.x : 0, y: Number.isFinite(next.y) ? next.y : 0, zoom: z };
    if (v.x === vp.x && v.y === vp.y && v.zoom === vp.zoom) return;
    vp = v;
    invalidate({ view: true, minimap: true, cull: true, chrome: true });
    if (notify) o.onViewportChange?.(vp);
  };

  // Pintado.
  const elementOf = (id: string) => {
    const known = nodeEls.get(id);
    if (known?.isConnected && known.parentElement && (known.parentElement === nodesLayer || known.parentElement === groupsLayer))
      return known;
    return null;
  };
  const collect = () => {
    nodeEls.clear();
    for (const layer of [groupsLayer, nodesLayer])
      for (const el of layer.querySelectorAll<HTMLElement>(":scope > [data-id]")) nodeEls.set(el.dataset.id!, el);
  };
  const resize =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver((entries) => {
          let changed = false;
          for (const entry of entries) {
            const el = entry.target as HTMLElement;
            const id = el.dataset.id;
            if (!id || !el.isConnected) continue;
            const w = el.offsetWidth;
            const h = el.offsetHeight;
            if (!w || !h) continue;
            const old = measured.get(id);
            if (!old || Math.abs(old.width - w) > 0.5 || Math.abs(old.height - h) > 0.5) {
              measured.set(id, { width: w, height: h });
              changed = true;
            }
            if (measurePorts(el, id)) changed = true;
          }
          if (changed) {
            version++;
            geometry++;
            rects = nodeRects(graph.nodes, measured);
            invalidate({ edges: true, minimap: true, cull: true, chrome: true });
          }
        });
  /** Mide dónde caen los conectores que dibuja el cuerpo de un nodo (`[data-port-anchor][data-port]`). */
  function measurePorts(el: HTMLElement, id: string): boolean {
    const anchors = el.querySelectorAll<HTMLElement>("[data-port-anchor][data-port]");
    const node = index.get(id);
    let insetChanged = false;
    const body = el.querySelector<HTMLElement>(":scope > .z-folder-card__body");
    if (body) {
      const inset = Math.round(body.offsetTop);
      if (insetTop.get(id) !== inset) {
        insetTop.set(id, inset);
        insetChanged = true;
      }
    }
    if (!node?.ports?.some((p) => p.anchor)) return portT.delete(id) || insetChanged;
    const box = el.getBoundingClientRect();
    if (!box.width || !box.height) return insetChanged;
    const next = new Map<string, number>();
    for (const a of anchors) {
      const port = node.ports.find((p) => p.id === a.dataset.port);
      if (!port?.anchor || a.closest("[data-id]") !== el) continue;
      const r = a.getBoundingClientRect();
      const side = portSide(port);
      const t =
        side === "top" || side === "bottom" ? (r.left + r.width / 2 - box.left) / box.width : (r.top + r.height / 2 - box.top) / box.height;
      next.set(port.id, Math.round(t * 10000) / 10000);
    }
    // Puertos `anchor` de arriba sin elemento en una tarjeta con pestaña: se reparten a la derecha de la pestaña, no
    // detrás de ella.
    const tab = el.querySelector<HTMLElement>(":scope > .z-folder-card__tab");
    if (tab) {
      const tr = tab.getBoundingClientRect();
      const start = (tr.right - box.left) / box.width + 0.04;
      const top = node.ports.filter((p) => p.anchor && portSide(p) === "top" && !next.has(p.id));
      if (start < 0.85)
        top.forEach((p, i) => {
          next.set(p.id, Math.round((start + ((1 - start) * (i + 1)) / (top.length + 1)) * 10000) / 10000);
        });
    }
    if (!next.size) return portT.delete(id) || insetChanged;
    const old = portT.get(id);
    const same = old && old.size === next.size && [...next].every(([k, v]) => Math.abs((old.get(k) ?? -1) - v) < 0.0005);
    if (same) return insetChanged;
    portT.set(id, next);
    return true;
  }
  const rootResize =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver((entries) => {
          for (const entry of entries) {
            const s = entry.contentBoxSize?.[0];
            const measuredSize = s
              ? { width: s.inlineSize, height: s.blockSize }
              : { width: entry.contentRect.width, height: entry.contentRect.height };
            if (entry.target === root) box = { width: measuredSize.width || 1, height: measuredSize.height || 1 };
            else miniBox = measuredSize.width && measuredSize.height ? measuredSize : null;
          }
          invalidate({ cull: true, minimap: true, edges: true });
        });
  rootResize?.observe(root);
  let miniObserved: Element | null = null;
  const observed = new WeakSet<HTMLElement>();

  /** Saca del orden de tabulación los controles de los nodos en los que no se ha entrado. */
  const tame = (el: HTMLElement, inside: boolean) => {
    for (const c of el.querySelectorAll<HTMLElement>(FOCUSABLE)) {
      if (inside) {
        if (c.dataset.zTabindex !== undefined) {
          if (c.dataset.zTabindex === "") c.removeAttribute("tabindex");
          else c.setAttribute("tabindex", c.dataset.zTabindex);
          delete c.dataset.zTabindex;
        }
      } else if (c.dataset.zTabindex === undefined && c.tabIndex !== -1) {
        c.dataset.zTabindex = c.getAttribute("tabindex") ?? "";
        c.tabIndex = -1;
      }
    }
  };

  const descriptionOf = (id: string) => {
    const known = descriptions.get(id);
    if (known?.v === version) return known.text;
    const base = describeNode(graph, id, labels, o.locale, adj, index);
    const text = selNodes.has(id) ? `${labels.selected}; ${base}` : base;
    descriptions.set(id, { v: version, text });
    return text;
  };

  const paintNodes = () => {
    collect();
    const stop = current ?? firstNode();
    const descSpans = new Map<string, HTMLElement>();
    for (const span of descs.children) descSpans.set((span as HTMLElement).dataset.for ?? "", span as HTMLElement);
    for (const [id, el] of nodeEls) {
      const n = index.get(id);
      if (!n) continue;
      const r = rects.get(id)!;
      const vars = nodeVars(r.x, r.y, n.size);
      const sig = `${vars["--z-node-x"]}|${vars["--z-node-y"]}|${vars["--z-node-w"] ?? ""}|${vars["--z-node-h"] ?? ""}|${selNodes.has(id)}|${stop === id}|${entered === id}`;
      if (!observed.has(el)) {
        observed.add(el);
        resize?.observe(el);
      }
      if (!tamed.has(el)) {
        tamed.add(el);
        tame(el, entered === id);
      }
      if (written.get(el) !== sig) {
        written.set(el, sig);
        for (const [k, v] of Object.entries(vars)) if (el.style.getPropertyValue(k) !== v) el.style.setProperty(k, v);
        if (!n.size) {
          el.style.removeProperty("--z-node-w");
          el.style.removeProperty("--z-node-h");
        }
        el.toggleAttribute("data-selected", selNodes.has(id));
        el.toggleAttribute("data-entered", entered === id);
        el.tabIndex = stop === id ? 0 : -1;
      }
      let span = descSpans.get(id);
      if (!span) {
        span = doc.createElement("span");
        span.dataset.for = id;
        span.id = `${uid}-d-${cssId(id)}`;
        descs.append(span);
      }
      const text = descriptionOf(id);
      if (span.textContent !== text) span.textContent = text;
      if (el.getAttribute("aria-describedby") !== span.id) el.setAttribute("aria-describedby", span.id);
      descSpans.delete(id);
    }
    for (const span of descSpans.values()) span.remove();
    root.tabIndex = graph.nodes.length ? -1 : 0;
    const candidates = new Set((connecting?.candidates ?? []).map((c) => `${c.node}\u0000${c.port ?? ""}`));
    for (const port of root.querySelectorAll<HTMLElement>(".z-node-port")) {
      const node = port.closest<HTMLElement>("[data-id]")?.dataset.id ?? "";
      const key = `${node}\u0000${port.dataset.port ?? ""}`;
      port.toggleAttribute("data-candidate", candidates.has(key));
      port.toggleAttribute(
        "data-origin",
        !!connecting && connecting.from.node === node && (connecting.from.port ?? "") === (port.dataset.port ?? ""),
      );
    }
  };

  const cssId = (id: string) => id.replace(/[^\w-]/g, "_");

  /** Extremos de una arista. Sin `inset`, en la caja del nodo (lo que ve el enrutado ortogonal). */
  const endsOf = (e: GraphEdge, inset = true) => {
    const a = index.get(e.source);
    const b = index.get(e.target);
    const ra = rects.get(e.source);
    const rb = rects.get(e.target);
    if (!a || !b || !ra || !rb) return null;
    const s = anchorOf(a, ra, e.sourcePort, "source", portT.get(e.source), inset ? insetTop.get(e.source) : 0);
    const t = anchorOf(b, rb, e.targetPort, "target", portT.get(e.target), inset ? insetTop.get(e.target) : 0);
    return { source: s.point, sourceSide: s.side, target: t.point, targetSide: t.side };
  };
  // Rutas ortogonales: se calculan todas a la vez (esquivan nodos y se reparten en carriles) cuando cambia la
  // geometría. Mientras se arrastra o redimensiona, la escalonada suave de siempre (barata); al soltar, la buena.
  let orthoKey = "";
  let orthoRoutes = new Map<string, EdgeRoute>();
  const orthogonalRoutes = () => {
    const quick = gesture?.kind === "drag" || gesture?.kind === "resize";
    const key = `${geometry}|${quick}|${JSON.stringify(o.routing ?? null)}|${o.edgeType}`;
    if (key === orthoKey) return orthoRoutes;
    orthoKey = key;
    const reqs = [];
    for (const e of graph.edges) {
      if ((e.type ?? o.edgeType ?? "bezier") !== "orthogonal") continue;
      const ends = endsOf(e, false);
      if (ends) reqs.push({ id: e.id, ends, source: e.source, target: e.target, width: edgeWidth(e, o.edgeScale) });
    }
    if (quick) {
      orthoRoutes = new Map(reqs.map((r) => [r.id, edgeRoute("smoothstep", r.ends, o.routing)]));
      return orthoRoutes;
    }
    const obstacles = graph.nodes.filter((n) => !isGroup(n) && rects.has(n.id)).map((n) => ({ id: n.id, ...rects.get(n.id)! }));
    orthoRoutes = routeOrthogonal(reqs, obstacles, o.routing).routes;
    // Las rutas se calculan contra la caja del nodo; en una tarjeta con pestaña, el tramo que entra por arriba se
    // alarga hasta el borde de la tarjeta (sigue siendo vertical).
    for (const r of reqs) {
      const route = orthoRoutes.get(r.id);
      const e = graph.edges.find((x) => x.id === r.id)!;
      const s = r.ends.sourceSide === "top" ? (insetTop.get(e.source) ?? 0) : 0;
      const t = r.ends.targetSide === "top" ? (insetTop.get(e.target) ?? 0) : 0;
      if (!route || (!s && !t)) continue;
      const points = route.points.map((p) => ({ ...p }));
      if (s) points[0]!.y += s;
      if (t) points[points.length - 1]!.y += t;
      const { length, mid } = polylineMidpoint(points);
      orthoRoutes.set(r.id, { d: roundedPath(points, o.routing?.radius ?? 10), label: mid, length, points });
    }
    return orthoRoutes;
  };

  const routeOf = (e: GraphEdge): EdgeRoute | null => {
    const ends = endsOf(e);
    if (!ends) return null;
    const type = e.type ?? o.edgeType ?? "bezier";
    if (type === "orthogonal") return orthogonalRoutes().get(e.id) ?? edgeRoute("smoothstep", ends, o.routing);
    const s = { point: ends.source, side: ends.sourceSide };
    const t = { point: ends.target, side: ends.targetSide };
    const key = `${type}|${s.point.x}|${s.point.y}|${s.side}|${t.point.x}|${t.point.y}|${t.side}`;
    const cached = routes.get(e.id);
    if (cached?.key === key) return cached.route;
    const route = edgeRoute(type, { source: s.point, sourceSide: s.side, target: t.point, targetSide: t.side });
    routes.set(e.id, { key, route });
    return route;
  };

  /** Marcadores de los colores libres: uno por color, creados al primer uso. */
  const customMarkers = new Map<string, string>();
  const markerFor = (e: GraphEdge) => {
    if ((e.markerEnd ?? (e.animated ? "arrow" : "arrow")) === "none") return null;
    if (selEdges.has(e.id)) return `url(#${uid}-arrow-selected)`;
    const c = edgeColor(e.color, e.tone);
    if (c.value) {
      let id = customMarkers.get(c.value);
      if (!id) {
        id = `${uid}-arrow-c${customMarkers.size}`;
        customMarkers.set(c.value, id);
        const marker = svgEl(doc, "marker", {
          id,
          class: "z-node-canvas__marker",
          "data-tone": "custom",
          viewBox: "0 0 12 12",
          refX: "15",
          refY: "6",
          markerWidth: "12",
          markerHeight: "12",
          markerUnits: "userSpaceOnUse",
          orient: "auto-start-reverse",
        });
        marker.style.setProperty("--z-marker-color", c.value);
        marker.append(svgEl(doc, "path", { d: "M 2 2 L 10 6 L 2 10 Z" }));
        defsEl.append(marker);
      }
      return `url(#${id})`;
    }
    return `url(#${uid}-arrow-${c.tone ?? "neutral"})`;
  };
  const endLabel = (els: EdgeEls, which: "source" | "target", text: string | undefined, route: EdgeRoute, selected: boolean, inset = 0) => {
    let el = els.ends[which];
    if (!text) {
      el?.remove();
      els.ends[which] = null;
      return;
    }
    if (!el) {
      el = doc.createElement("div");
      el.className = "z-edge__end-label";
      el.dataset.end = which;
      el.dataset.edge = els.g.dataset.id ?? "";
      labelsLayer.append(el);
      els.ends[which] = el;
    }
    if (el.textContent !== text) el.textContent = text;
    const pts = route.points;
    const from = which === "source" ? "start" : "end";
    // Fuera de la pestaña de una tarjeta: la etiqueta va por encima de su borde.
    const p = pointAlong(pts, from, 16 + inset);
    const a = which === "source" ? pts[0] : pts[pts.length - 1];
    const b = which === "source" ? pts[1] : pts[pts.length - 2];
    const vertical = !!a && !!b && Math.abs(a.x - b.x) < Math.abs(a.y - b.y);
    el.dataset.orient = vertical ? "v" : "h";
    el.toggleAttribute("data-selected", selected);
    el.style.setProperty("--z-edge-x", px(p.x));
    el.style.setProperty("--z-edge-y", px(p.y));
  };

  const paintEdges = () => {
    const area =
      o.cull === false
        ? { x: -1e9, y: -1e9, width: 2e9, height: 2e9 }
        : (cullArea ?? expandRect(visibleRect(vp, size()), (o.overscan ?? 240) / vp.zoom));
    const keep = new Set<string>();
    const reconnectEdgeId = gesture?.kind === "reconnect" ? gesture.edge : null;
    // Cajas de cada arista (sus dos nodos y un margen para la curva): se calculan una vez por cambio del modelo, no
    // en cada fotograma de desplazamiento.
    if (edgeBoxVersion !== version) {
      edgeBoxVersion = version;
      edgeBoxes.clear();
      for (const e of graph.edges) {
        const ra = rects.get(e.source);
        const rb = rects.get(e.target);
        if (ra && rb) edgeBoxes.set(e.id, expandRect(unionRect([ra, rb])!, 80));
      }
      const ids = new Set(graph.edges.map((e) => e.id));
      for (const id of [...routes.keys()]) if (!ids.has(id)) routes.delete(id);
    }
    for (const e of graph.edges) {
      const box = edgeBoxes.get(e.id);
      if (!box) continue;
      if (!intersects(box, area) && !selEdges.has(e.id)) continue;
      const route = routeOf(e);
      if (!route) continue;
      const rbox = routeBounds(route);
      if (!intersects(expandRect(rbox, 24), area) && !selEdges.has(e.id)) continue;
      keep.add(e.id);
      let els = edgeEls.get(e.id);
      if (!els) {
        const g = svgEl(doc, "g", { class: "z-edge" });
        const hit = svgEl(doc, "path", { class: "z-edge__hit" });
        const path = svgEl(doc, "path", { class: "z-edge__path" });
        g.append(hit, path);
        g.dataset.id = e.id;
        edgeLayerEl.append(g);
        els = { g, hit, path, core: null, label: null, ends: { source: null, target: null }, key: "" };
        edgeEls.set(e.id, els);
      }
      const selected = selEdges.has(e.id);
      const marker = markerFor(e);
      const width = edgeWidth(e, o.edgeScale);
      const color = edgeColor(e.color, e.tone);
      const dash = e.animated ? null : dashArray(e.dash, width);
      const key = `${route.d}|${e.type ?? o.edgeType ?? "bezier"}|${e.animated}|${color.tone ?? color.value}|${selected}|${marker}|${e.label}|${reconnectEdgeId === e.id}|${width}|${dash}|${e.double}|${e.sourceLabel}|${e.targetLabel}`;
      if (els.key === key) continue;
      els.key = key;
      const g = els.g;
      g.dataset.type = e.type ?? o.edgeType ?? "bezier";
      g.toggleAttribute("data-animated", !!e.animated);
      g.toggleAttribute("data-selected", selected);
      if (color.tone) g.dataset.tone = color.tone;
      else delete g.dataset.tone;
      if (color.value) {
        g.dataset.color = "";
        g.style.setProperty("--z-edge-color", color.value);
      } else {
        delete g.dataset.color;
        g.style.removeProperty("--z-edge-color");
      }
      if (width !== 2) g.style.setProperty("--z-edge-width", px(width));
      else g.style.removeProperty("--z-edge-width");
      if (dash) {
        g.dataset.dash = e.dash ?? "dashed";
        g.style.setProperty("--z-edge-dash", dash);
      } else {
        delete g.dataset.dash;
        g.style.removeProperty("--z-edge-dash");
      }
      g.toggleAttribute("data-double", !!e.double);
      if (e.double && !els.core) {
        els.core = svgEl(doc, "path", { class: "z-edge__core" });
        els.path.after(els.core);
      } else if (!e.double && els.core) {
        els.core.remove();
        els.core = null;
      }
      els.core?.setAttribute("d", route.d);
      g.toggleAttribute("data-reconnecting", reconnectEdgeId === e.id);
      els.hit.setAttribute("d", route.d);
      els.path.setAttribute("d", route.d);
      els.path.style.setProperty("--z-edge-length", String(Math.round(route.length)));
      if (marker) els.path.setAttribute("marker-end", marker);
      else els.path.removeAttribute("marker-end");
      // Extremos para reconectar: solo en la arista seleccionada (en la capa de encima).
      for (const end of [...overlayEl.querySelectorAll(`.z-edge__end[data-edge="${CSS.escape(e.id)}"]`)]) end.remove();
      if (selected && editable()) {
        const first = route.points[0]!;
        const last = route.points[route.points.length - 1]!;
        for (const [which, p] of [
          ["source", first],
          ["target", last],
        ] as const) {
          overlayEl.append(
            svgEl(doc, "circle", { class: "z-edge__end", "data-end": which, "data-edge": e.id, cx: String(p.x), cy: String(p.y), r: "7" }),
          );
        }
      }
      if (e.label) {
        if (!els.label) {
          els.label = doc.createElement("div");
          els.label.className = "z-edge__label";
          els.label.dataset.id = e.id;
          labelsLayer.append(els.label);
        }
        if (els.label.textContent !== e.label) els.label.textContent = e.label;
        els.label.toggleAttribute("data-selected", selected);
        els.label.style.setProperty("--z-edge-x", px(route.label.x));
        els.label.style.setProperty("--z-edge-y", px(route.label.y));
      } else if (els.label) {
        els.label.remove();
        els.label = null;
      }
      const ends = e.sourceLabel || e.targetLabel ? endsOf(e) : null;
      endLabel(els, "source", e.sourceLabel, route, selected, ends?.sourceSide === "top" ? (insetTop.get(e.source) ?? 0) : 0);
      endLabel(els, "target", e.targetLabel, route, selected, ends?.targetSide === "top" ? (insetTop.get(e.target) ?? 0) : 0);
    }
    for (const [id, els] of edgeEls)
      if (!keep.has(id)) {
        els.g.remove();
        els.label?.remove();
        els.ends.source?.remove();
        els.ends.target?.remove();
        edgeEls.delete(id);
      }
    for (const end of [...overlayEl.querySelectorAll<SVGElement>(".z-edge__end")])
      if (!keep.has(end.dataset.edge ?? "") || !selEdges.has(end.dataset.edge ?? "") || !editable()) end.remove();
    root.dataset.edgeCount = String(edgeEls.size);
  };

  const paintDraft = () => {
    const g = gesture;
    let from: { point: Point; side: Side } | null = null;
    let to: Point | null = null;
    if (g?.kind === "connect" && g.moved) {
      const n = index.get(g.from.node);
      const r = rects.get(g.from.node);
      if (n && r) from = anchorOf(n, r, g.from.port, g.fromKind);
      to = toWorld(vp, g.now);
    } else if (g?.kind === "reconnect") {
      const e = graph.edges.find((x) => x.id === g.edge);
      if (e) {
        const fixed = g.end === "target" ? e.source : e.target;
        const n = index.get(fixed);
        const r = rects.get(fixed);
        if (n && r) from = anchorOf(n, r, g.end === "target" ? e.sourcePort : e.targetPort, g.end === "target" ? "source" : "target");
        to = toWorld(vp, g.now);
      }
    }
    if (!from || !to) {
      draftEl.setAttribute("hidden", "");
      return;
    }
    const opposite: Record<Side, Side> = { left: "right", right: "left", top: "bottom", bottom: "top" };
    const route = edgeRoute(o.edgeType ?? "bezier", {
      source: from.point,
      sourceSide: from.side,
      target: to,
      targetSide: opposite[from.side],
    });
    draftEl.setAttribute("d", route.d);
    draftEl.removeAttribute("hidden");
  };

  /**
   * Decide qué se pinta. La zona pintada es lo visible más un margen; mientras lo visible siga dentro de ella (y el
   * modelo y la parada no cambien) no se recalcula nada: al desplazar solo se mueve la transformación. Devuelve si la
   * zona cambió.
   */
  const cull = (force: boolean): boolean => {
    const view = visibleRect(vp, size());
    const keep = [current ?? firstNode(), entered, ...(gesture?.kind === "drag" ? gesture.origin.keys() : [])];
    const key = `${version}|${keep.join(",")}`;
    if (!force && cullArea && key === cullKey && containsRect(cullArea, view)) return false;
    cullKey = key;
    const area = o.cull === false ? { x: -1e9, y: -1e9, width: 2e9, height: 2e9 } : expandRect(view, (o.overscan ?? 240) / vp.zoom);
    cullArea = area;
    const next = new Set<string>();
    for (const [id, r] of rects) if (intersects(r, area)) next.add(id);
    // Lo que no se puede dejar de pintar: el nodo con la parada de tabulación, los que se arrastran y sus grupos.
    for (const id of keep) if (id && index.has(id)) next.add(id);
    for (const id of [...next]) {
      let p = index.get(id)?.parentId;
      while (p && !next.has(p)) {
        next.add(p);
        p = index.get(p)?.parentId;
      }
    }
    const same = next.size === visible.size && [...next].every((id) => visible.has(id));
    if (same) return true;
    visible = next;
    root.dataset.visibleCount = String(visible.size);
    o.onVisible?.(visible);
    collect();
    return true;
  };

  const paintView = () => {
    // La vista va en la capa del mundo y el desplazamiento del fondo en el fondo, no en la raíz: así un fotograma de
    // desplazamiento no recalcula el estilo de todos los nodos (las variables se registran sin herencia en la hoja).
    const set = (el: HTMLElement, k: string, v: string) => {
      if (el.style.getPropertyValue(k) !== v) el.style.setProperty(k, v);
    };
    set(world, "--z-vp-x", px(vp.x));
    set(world, "--z-vp-y", px(vp.y));
    set(world, "--z-vp-zoom", String(Math.round(vp.zoom * 10000) / 10000));
    // Con poco zoom los puertos conservan su objetivo de 24 px en pantalla (WCAG 2.5.8). Esta variable sí se hereda,
    // pero solo cambia con el zoom, no al desplazar.
    set(world, "--z-port-scale", String(Math.ceil(Math.max(1, 1 / vp.zoom) * 1000) / 1000));
    // Paso de los puntos del fondo en pantalla: el de la cuadrícula, duplicado mientras quede por debajo de 12 px (con
    // poco zoom los puntos se juntarían en una trama sucia). El fondo se desplaza con una transformación (resto del
    // paso), no con background-position: al desplazar no se vuelve a pintar, solo se compone.
    const grid = typeof o.snap === "number" && o.snap > 0 ? o.snap : 16;
    let step = grid * vp.zoom;
    for (let i = 0; i < 8 && step < 12; i++) step *= 2;
    const mod = (v: number) => ((v % step) + step) % step;
    set(background, "--z-grid-step", px(step));
    set(background, "--z-grid-x", px(mod(vp.x)));
    set(background, "--z-grid-y", px(mod(vp.y)));
    root.dataset.zoom = String(Math.round(vp.zoom * 100));
  };

  const minimapRects = new Map<string, SVGRectElement>();
  let miniVersion = -1;
  const paintMinimap = () => {
    const nav = minimap();
    if (!nav) return;
    let svg = nav.querySelector<SVGSVGElement>("svg.z-node-minimap__svg");
    if (!svg) {
      svg = svgEl(doc, "svg", { class: "z-node-minimap__svg", "aria-hidden": "true" });
      nav.append(svg);
    }
    if (miniObserved !== nav) {
      if (miniObserved) rootResize?.unobserve(miniObserved);
      miniObserved = nav;
      rootResize?.observe(nav);
      miniBox = null;
    }
    miniBox ??= { width: nav.clientWidth || 200, height: nav.clientHeight || 140 };
    const w = miniBox.width || 200;
    const h = miniBox.height || 140;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    const content = unionRect(rects.values());
    const s = size();
    const proj = minimapProjection(content, visibleRect(vp, s), { width: w, height: h });
    let layer = svg.querySelector<SVGGElement>("g.z-node-minimap__nodes");
    if (!layer) {
      layer = svgEl(doc, "g", { class: "z-node-minimap__nodes" });
      svg.append(layer);
    }
    // Los nodos van en coordenadas del mundo dentro de un grupo transformado: al desplazar o hacer zoom solo cambia la
    // transformación (con cientos de nodos, reescribir cada rectángulo en cada fotograma se nota).
    layer.setAttribute(
      "transform",
      `translate(${(proj.offset.x - proj.origin.x * proj.scale).toFixed(2)} ${(proj.offset.y - proj.origin.y * proj.scale).toFixed(2)}) scale(${proj.scale.toFixed(5)})`,
    );
    if (miniVersion !== version) {
      miniVersion = version;
      const seen = new Set<string>();
      for (const n of paintOrder(graph.nodes)) {
        const r = rects.get(n.id);
        if (!r) continue;
        seen.add(n.id);
        let rect = minimapRects.get(n.id);
        if (!rect?.isConnected) {
          rect = svgEl(doc, "rect", { class: "z-node-minimap__node", rx: "6" });
          minimapRects.set(n.id, rect);
          layer.append(rect);
        }
        rect.setAttribute("x", String(Math.round(r.x)));
        rect.setAttribute("y", String(Math.round(r.y)));
        rect.setAttribute("width", String(Math.round(r.width)));
        rect.setAttribute("height", String(Math.round(r.height)));
        rect.toggleAttribute("data-selected", selNodes.has(n.id));
        rect.toggleAttribute("data-group", isGroup(n));
        if (n.data.status === "error") rect.dataset.status = "error";
        else delete rect.dataset.status;
      }
      for (const [id, rect] of minimapRects)
        if (!seen.has(id)) {
          rect.remove();
          minimapRects.delete(id);
        }
    }
    let mask = svg.querySelector<SVGPathElement>("path.z-node-minimap__mask");
    if (!mask) {
      mask = svgEl(doc, "path", { class: "z-node-minimap__mask", "fill-rule": "evenodd" });
      svg.append(mask);
    }
    const v = minimapView(proj, vp, s);
    mask.setAttribute(
      "d",
      `M0 0H${w}V${h}H0Z M${v.x.toFixed(1)} ${v.y.toFixed(1)}h${v.width.toFixed(1)}v${v.height.toFixed(1)}h${(-v.width).toFixed(1)}Z`,
    );
    let view = svg.querySelector<SVGRectElement>("rect.z-node-minimap__view");
    if (!view) {
      view = svgEl(doc, "rect", { class: "z-node-minimap__view" });
      svg.append(view);
    }
    view.setAttribute("x", v.x.toFixed(1));
    view.setAttribute("y", v.y.toFixed(1));
    view.setAttribute("width", Math.max(1, v.width).toFixed(1));
    view.setAttribute("height", Math.max(1, v.height).toFixed(1));
    if (!nav.hasAttribute("tabindex")) nav.tabIndex = 0;
    if (!nav.hasAttribute("aria-label")) nav.setAttribute("aria-label", labels.minimap);
    if (!nav.hasAttribute("aria-describedby")) nav.setAttribute("aria-describedby", desc.id);
  };

  const paintChrome = () => {
    const bar = controls();
    root.toggleAttribute("data-locked", locked || !!o.readOnly);
    root.toggleAttribute("data-readonly", !!o.readOnly);
    root.toggleAttribute("data-connecting", !!connecting || gesture?.kind === "connect" || gesture?.kind === "reconnect");
    const text = `${describeGraph(graph, labels)}. ${labels.instructions}`;
    if (desc.textContent !== text) desc.textContent = text;
    if (!bar) return;
    const set = (action: string, disabled: boolean) => {
      const b = bar.querySelector<HTMLElement>(`[data-node-action="${action}"]`);
      if (!b) return;
      if (disabled) b.setAttribute("aria-disabled", "true");
      else b.removeAttribute("aria-disabled");
    };
    set("zoom-in", vp.zoom >= (o.maxZoom ?? MAX_ZOOM) - 1e-6);
    set("zoom-out", vp.zoom <= (o.minZoom ?? MIN_ZOOM) + 1e-6);
    set("undo", !undo.canUndo || !editable());
    set("redo", !undo.canRedo || !editable());
    set("layout", !editable() || !graph.nodes.length);
    set("fit", !graph.nodes.length);
    const lock = bar.querySelector<HTMLElement>('[data-node-action="lock"]');
    if (lock) {
      lock.setAttribute("aria-pressed", String(locked));
      // En solo lectura no hay nada que bloquear: el botón no se muestra.
      lock.hidden = !!o.readOnly;
      const glyph = lock.querySelector<HTMLElement>("[data-lock-icon]");
      if (glyph) glyph.dataset.lockIcon = locked ? "closed" : "open";
    }
    const zoomText = bar.querySelector<HTMLElement>("[data-node-zoom]");
    if (zoomText) zoomText.textContent = `${Math.round(vp.zoom * 100)}%`;
  };

  function paint() {
    frame = 0;
    if (disposed) return;
    const d = dirty;
    dirty = { view: false, nodes: false, edges: false, minimap: false, chrome: false, cull: false };
    if (d.view) paintView();
    const moved = d.cull || d.view ? cull(d.nodes || d.edges) : false;
    if (d.nodes || moved) paintNodes();
    if (d.edges || moved) paintEdges();
    paintDraft();
    paintSelectionBox();
    if (d.minimap) paintMinimap();
    if (d.chrome || d.nodes) paintChrome();
    if (emitPending) {
      const change = emitPending;
      emitPending = null;
      emitGraph(change);
    }
    resolveFocus();
  }
  const flush = () => {
    if (frame) win?.cancelAnimationFrame?.(frame);
    frame = 0;
    paint();
  };

  const paintSelectionBox = () => {
    if (gesture?.kind !== "box" || !gesture.moved) {
      selectionBox.hidden = true;
      return;
    }
    const r = rectFromPoints(gesture.start, gesture.now);
    selectionBox.hidden = false;
    selectionBox.style.setProperty("--z-box-x", px(r.x));
    selectionBox.style.setProperty("--z-box-y", px(r.y));
    selectionBox.style.setProperty("--z-box-w", px(r.width));
    selectionBox.style.setProperty("--z-box-h", px(r.height));
  };

  // Foco.
  function firstNode(): string | null {
    let best: string | null = null;
    let bx = Infinity;
    let by = Infinity;
    for (const n of graph.nodes) {
      if (isGroup(n)) continue;
      const r = rects.get(n.id)!;
      if (r.x < bx - 0.5 || (Math.abs(r.x - bx) <= 0.5 && r.y < by)) {
        best = n.id;
        bx = r.x;
        by = r.y;
      }
    }
    return best ?? graph.nodes[0]?.id ?? null;
  }
  const resolveFocus = () => {
    if (!pendingFocus) return;
    const el = pendingFocus();
    if (el) {
      pendingFocus = null;
      el.focus({ preventScroll: true });
    }
  };
  /** Lleva el foco a un elemento que quizá aún no está pintado (se pinta al revelar su nodo). */
  const focusSoon = (find: () => HTMLElement | null) => {
    pendingFocus = find;
    flush();
  };
  const reveal = (id: string) => {
    const r = rects.get(id);
    if (r) setViewportInternal(revealRect(vp, r, size(), 32));
  };
  const goTo = (id: string) => {
    current = id;
    entered = null;
    reveal(id);
    invalidate({ nodes: true, cull: true });
    focusSoon(() => elementOf(id));
  };

  // Acciones.
  const removeSelection = () => {
    if (!editable()) return;
    const nodes = selNodes.size ? [...selNodes] : current && !selEdges.size ? [current] : [];
    const edges = [...selEdges];
    if (!nodes.length && !edges.length) return;
    const fallback = current && nodes.includes(current) ? nearestOther(current, new Set(nodes)) : current;
    // Antes de quitar nada: quien monta puede retirar el elemento enfocado en el mismo aviso.
    const hadFocus = root.contains(doc.activeElement) || doc.activeElement === doc.body;
    const next = removeElements(graph, nodes, edges);
    const count = graph.nodes.length - next.nodes.length || graph.edges.length - next.edges.length;
    selNodes = new Set();
    selEdges = new Set();
    commit(next, { type: "remove", ids: [...nodes, ...edges], done: true });
    emitSelection();
    say(fill(labels.deleted, { count }));
    current = fallback && index.has(fallback) ? fallback : firstNode();
    if (current && hadFocus) goTo(current);
  };
  const nearestOther = (id: string, exclude: Set<string>) => {
    const r = rects.get(id);
    if (!r) return null;
    let best: string | null = null;
    let bd = Infinity;
    for (const [other, o2] of rects) {
      if (exclude.has(other)) continue;
      const d = Math.hypot(o2.x - r.x, o2.y - r.y);
      if (d < bd) {
        bd = d;
        best = other;
      }
    }
    return best;
  };
  const doUndo = () => {
    if (!editable()) return;
    const prev = undo.undo(graph);
    if (!prev) return;
    commit(prev, { type: "undo", done: true }, false);
    say(labels.undone);
  };
  const doRedo = () => {
    if (!editable()) return;
    const next = undo.redo(graph);
    if (!next) return;
    commit(next, { type: "redo", done: true }, false);
    say(labels.redone);
  };
  const selectionIds = () => (selNodes.size ? [...selNodes] : current ? [current] : []);
  const copy = (cut = false) => {
    const ids = selectionIds();
    if (!ids.length) return null;
    clipboard = copyFragment(graph, ids);
    pasteCount = 0;
    say(fill(labels.copied, { count: clipboard.nodes.length }));
    if (cut && editable()) {
      const next = removeElements(graph, ids);
      selNodes = new Set();
      commit(next, { type: "remove", ids, done: true });
      emitSelection();
    }
    return clipboard;
  };
  const paste = (fragment: Graph | null) => {
    if (!fragment || !editable() || !fragment.nodes.length) return;
    pasteCount++;
    const step = typeof o.snap === "number" && o.snap > 0 ? o.snap * 2 : 32;
    const { graph: next, ids } = pasteFragment(graph, fragment, { x: step * pasteCount, y: step * pasteCount });
    const from: Record<string, string> = {};
    const added = next.nodes.slice(graph.nodes.length);
    added.forEach((n, i) => {
      from[n.id] = fragment.nodes[i]!.id;
    });
    commit(next, { type: "paste", ids: added.map((n) => n.id), from, done: true });
    setSelection(ids);
    if (ids[0]) goTo(ids[0]);
    say(fill(labels.pasted, { count: added.length }));
  };
  const doDuplicate = () => {
    const ids = selectionIds();
    if (!ids.length || !editable()) return;
    const step = typeof o.snap === "number" && o.snap > 0 ? o.snap * 2 : 32;
    const { graph: next, ids: newIds } = duplicate(graph, ids, { x: step, y: step });
    const from: Record<string, string> = {};
    const added = next.nodes.slice(graph.nodes.length);
    const source = copyFragment(graph, ids);
    added.forEach((n, i) => {
      from[n.id] = source.nodes[i]!.id;
    });
    commit(next, { type: "duplicate", ids: added.map((n) => n.id), from, done: true });
    setSelection(newIds);
    if (newIds[0]) goTo(newIds[0]);
    say(fill(labels.duplicated, { count: added.length }));
  };
  const doGroup = () => {
    if (!editable()) return;
    const ids = selectionIds().filter((id) => !index.get(id)?.parentId);
    if (!ids.length) return;
    const { graph: next, id } = groupNodes(graph, ids, { measured });
    if (!id) return;
    commit(next, { type: "group", ids: [id, ...ids], done: true });
    setSelection([id]);
    current = id;
    invalidate({ nodes: true });
    say(fill(labels.grouped, { count: ids.length }));
  };
  const doUngroup = () => {
    if (!editable()) return;
    const id = [...selNodes, current].find((x) => x && isGroup(index.get(x) ?? {}));
    if (!id) return;
    const kids = graph.nodes.filter((n) => n.parentId === id).map((n) => n.id);
    commit(ungroup(graph, id), { type: "ungroup", ids: [id, ...kids], done: true });
    setSelection(kids);
    current = kids[0] ?? firstNode();
    say(labels.ungrouped);
    if (current && root.contains(doc.activeElement)) goTo(current);
  };
  const doLayout = (direction: "LR" | "TB" = "LR") => {
    if (!editable() || !graph.nodes.length) return;
    const top = graph.nodes.filter((n) => !n.parentId);
    const sizes = new Map(top.map((n) => [n.id, nodeSize(n, measured)]));
    const box = unionRect(top.map((n) => rects.get(n.id)!));
    const { positions } = layeredLayout(
      top.map((n) => n.id),
      graph.edges.map((e) => ({ ...e, source: topOf(e.source), target: topOf(e.target) })),
      sizes,
      { direction, origin: box ? { x: box.x, y: box.y } : undefined, nodeGap: 48, layerGap: 120 },
    );
    commit(setPositions(graph, positions), { type: "layout", ids: [...positions.keys()], done: true });
    say(labels.layoutDone);
    fitView();
  };
  const topOf = (id: string) => {
    let cur = id;
    const seen = new Set<string>();
    while (index.get(cur)?.parentId && !seen.has(cur)) {
      seen.add(cur);
      cur = index.get(cur)!.parentId!;
    }
    return cur;
  };
  const fitView = (padding = 48, floor = o.minZoom) => {
    setViewportInternal(fitRect(unionRect(rects.values()), size(), { padding, min: floor, max: Math.min(o.maxZoom ?? MAX_ZOOM, 1.25) }));
  };
  const zoomStep = (dir: 1 | -1) => {
    const s = size();
    setViewportInternal(
      zoomTo(vp, dir > 0 ? vp.zoom * ZOOM_STEP : vp.zoom / ZOOM_STEP, { x: s.width / 2, y: s.height / 2 }, o.minZoom, o.maxZoom),
    );
    say(fill(labels.zoomLevel, { percent: Math.round(vp.zoom * 100) }));
  };
  const zoomExact = (zoom: number) => {
    const s = size();
    setViewportInternal(zoomTo(vp, zoom, { x: s.width / 2, y: s.height / 2 }, o.minZoom, o.maxZoom));
  };
  const toggleLock = () => {
    if (o.readOnly) return;
    locked = !locked;
    cancelConnect(false);
    invalidate({ chrome: true, edges: true });
    o.onLockChange?.(locked);
    say(locked ? labels.locked : labels.unlocked);
  };

  // Conectar.
  const validCandidates = (from: PortRef, ignoreEdge?: string) =>
    compatiblePorts(graph, from, { allowCycles: o.allowCycles, ignoreEdge }).filter((to) => {
      const kind = index.get(from.node)?.ports?.find((p) => p.id === from.port)?.kind ?? "source";
      return !o.isValidConnection || o.isValidConnection(normalizeConnection(from, kind, to));
    });
  const sortByDistance = (from: PortRef, list: PortRef[]) => {
    const r = rects.get(from.node)!;
    const dist = (p: PortRef) => {
      const x = rects.get(p.node)!;
      return Math.hypot(x.x - r.x, x.y - r.y);
    };
    return [...list].sort((a, b) => dist(a) - dist(b));
  };
  const portElement = (ref: PortRef) =>
    elementOf(ref.node)?.querySelector<HTMLElement>(`.z-node-port[data-port="${CSS.escape(ref.port ?? "")}"]`) ?? null;
  const startConnect = (from: PortRef, keyboard: boolean) => {
    if (!editable()) return;
    const kind = index.get(from.node)?.ports?.find((p) => p.id === from.port)?.kind ?? "source";
    const candidates = sortByDistance(from, validCandidates(from));
    connecting = { from, fromKind: kind, candidates, index: -1, keyboard };
    invalidate({ nodes: true, chrome: true });
    if (!candidates.length) {
      say(labels.noTargets);
      connecting = null;
      return;
    }
    say(fill(labels.connecting, { port: portName(from), node: nameOf(from.node), count: candidates.length }));
    if (keyboard) moveCandidate(1, false);
  };
  const moveCandidate = (step: 1 | -1, speak = true) => {
    if (!connecting) return;
    const c = connecting;
    c.index = (c.index + step + c.candidates.length) % c.candidates.length;
    const target = c.candidates[c.index]!;
    reveal(target.node);
    invalidate({ nodes: true, cull: true });
    focusSoon(() => portElement(target));
    if (speak)
      say(
        fill(labels.connectTarget, { port: portName(target), node: nameOf(target.node), index: c.index + 1, count: c.candidates.length }),
      );
  };
  const cancelConnect = (speak = true) => {
    if (!connecting) return;
    const from = connecting.from;
    const wasKeyboard = connecting.keyboard;
    connecting = null;
    invalidate({ nodes: true, chrome: true });
    if (speak) say(labels.connectCancelled);
    if (wasKeyboard) focusSoon(() => portElement(from));
  };
  const connect = (from: PortRef, fromKind: "source" | "target", to: PortRef): boolean => {
    const problem = connectionProblem(graph, from, to, { allowCycles: o.allowCycles });
    const edge = normalizeConnection(from, fromKind, to);
    if (problem || (o.isValidConnection && !o.isValidConnection(edge))) {
      say(labels.invalidConnection);
      return false;
    }
    const { graph: next, edge: clean } = addEdge(graph, o.edgeType ? { ...edge, type: o.edgeType } : edge);
    commit(next, { type: "connect", ids: [clean.id], done: true });
    o.onConnect?.(clean);
    say(fill(labels.connected, { source: nameOf(clean.source), target: nameOf(clean.target) }));
    return true;
  };
  const finishKeyboardConnect = () => {
    if (!connecting || connecting.index < 0) return;
    const c = connecting;
    const to = c.candidates[c.index]!;
    connecting = null;
    connect(c.from, c.fromKind, to);
    invalidate({ nodes: true, chrome: true });
    // De vuelta al puerto de origen: se sigue desde donde se empezó.
    reveal(c.from.node);
    focusSoon(() => portElement(c.from));
  };

  // Puntero.
  const portRefOf = (el: Element | null): PortRef | null => {
    const port = el?.closest<HTMLElement>(".z-node-port");
    const node = port?.closest<HTMLElement>("[data-id]");
    if (!port || !node || !root.contains(node)) return null;
    return { node: node.dataset.id!, port: port.dataset.port };
  };
  const dropTarget = (e: PointerEvent, from: PortRef, ignoreEdge?: string): PortRef | null => {
    const hit = doc.elementFromPoint(e.clientX, e.clientY);
    const direct = portRefOf(hit);
    const ok = (to: PortRef) =>
      to.node !== from.node && !connectionProblem(graph, from, to, { allowCycles: o.allowCycles, ignoreEdge }) ? to : null;
    if (direct) return ok(direct);
    // Soltar sobre el cuerpo de un nodo: su primer puerto compatible.
    const nodeEl = hit?.closest<HTMLElement>("[data-id]");
    if (nodeEl && root.contains(nodeEl) && nodeEl.dataset.id !== from.node) {
      const n = index.get(nodeEl.dataset.id!);
      for (const p of n?.ports ?? []) {
        const to = ok({ node: n!.id, port: p.id });
        if (to) return to;
      }
    }
    // Cerca de un puerto (24 px de pantalla).
    const w = toWorld(vp, local(e));
    let best: PortRef | null = null;
    let bd = 24 / vp.zoom;
    for (const id of visible) {
      const n = index.get(id);
      const r = rects.get(id);
      if (!n || !r || id === from.node) continue;
      for (const p of n.ports ?? []) {
        const a = anchorOf(n, r, p.id, p.kind);
        const d = Math.hypot(a.point.x - w.x, a.point.y - w.y);
        if (d < bd && ok({ node: id, port: p.id })) {
          bd = d;
          best = { node: id, port: p.id };
        }
      }
    }
    return best;
  };

  const capture = (id: number) => {
    try {
      root.setPointerCapture(id);
    } catch {
      // El puntero ya no existe (se soltó antes): el gesto termina con pointerup.
    }
  };

  const onPointerDown = (e: PointerEvent) => {
    if (disposed) return;
    const target = e.target as Element;
    if (target.closest(".z-node-controls")) return;
    if (chooser) {
      if (chooser.contains(target)) return;
      closeChooser(null);
    }
    pointers.set(e.pointerId, local(e));
    const mini = target.closest(".z-node-minimap");
    if (mini) {
      if (e.button !== 0) return;
      gesture = { kind: "minimap", pointer: e.pointerId };
      capture(e.pointerId);
      moveFromMinimap(e);
      e.preventDefault();
      return;
    }
    // Dos dedos: pellizco (zoom y desplazamiento a la vez).
    if (pointers.size === 2 && e.pointerType === "touch") {
      const [a, b] = [...pointers.values()] as [Point, Point];
      const ids = [...pointers.keys()] as [number, number];
      if (gesture?.kind === "drag") commit(gesture.before, { type: "move", done: true }, false);
      gesture = { kind: "pinch", ids, vp, distance: Math.hypot(b.x - a.x, b.y - a.y), center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      for (const id of ids) capture(id);
      return;
    }
    if (gesture) return;
    gestureBox = root.getBoundingClientRect();
    const p = local(e);
    const middle = e.button === 1;
    if (e.button !== 0 && !middle) return;
    if (connecting && !connecting.keyboard) {
      // Conectar con clics: el segundo clic en un puerto compatible conecta; en otro sitio, cancela.
      const to = portRefOf(target);
      const c = connecting;
      connecting = null;
      if (to && c.candidates.some((x) => x.node === to.node && x.port === to.port)) connect(c.from, c.fromKind, to);
      else say(labels.connectCancelled);
      invalidate({ nodes: true, chrome: true });
      suppressClick = true;
      e.preventDefault();
      return;
    }
    const end = target.closest<SVGElement>(".z-edge__end");
    if (end && editable() && !middle) {
      const edge = end.dataset.edge;
      if (edge) {
        gesture = { kind: "reconnect", pointer: e.pointerId, edge, end: end.dataset.end === "source" ? "source" : "target", now: p };
        capture(e.pointerId);
        invalidate({ edges: true, chrome: true });
        e.preventDefault();
        return;
      }
    }
    const port = portRefOf(target);
    if (port && !middle) {
      if (!editable()) return;
      const kind = index.get(port.node)?.ports?.find((x) => x.id === port.port)?.kind ?? "source";
      gesture = { kind: "connect", pointer: e.pointerId, from: port, fromKind: kind, start: p, now: p, moved: false };
      return;
    }
    const resizer = target.closest<HTMLElement>(".z-node__resize");
    const nodeEl = target.closest<HTMLElement>("[data-id]");
    const nodeId = nodeEl && (nodeEl.parentElement === nodesLayer || nodeEl.parentElement === groupsLayer) ? nodeEl.dataset.id! : null;
    if (resizer && nodeId && editable() && !middle) {
      const r = rects.get(nodeId)!;
      gesture = {
        kind: "resize",
        pointer: e.pointerId,
        node: nodeId,
        start: p,
        size: { width: r.width, height: r.height },
        before: graph,
        moved: false,
      };
      capture(e.pointerId);
      e.preventDefault();
      return;
    }
    const edgeHit = target.closest<SVGElement>(".z-edge__hit, .z-edge__label");
    if (edgeHit && !middle) {
      const id = edgeHit.closest<SVGGElement>(".z-edge")?.dataset.id ?? (edgeHit as unknown as HTMLElement).dataset.id;
      if (id) {
        if (e.shiftKey) setSelection(selNodes, selEdges.has(id) ? [...selEdges].filter((x) => x !== id) : [...selEdges, id]);
        else setSelection([], [id]);
        root.focus({ preventScroll: true });
        e.preventDefault();
        return;
      }
    }
    if (nodeId && !middle && !spaceDown) {
      if (target.closest(CONTROL) && target.closest("[data-id]") === nodeEl && target !== nodeEl) return;
      const n = index.get(nodeId)!;
      const additive = e.shiftKey || e.metaKey || e.ctrlKey;
      const toggleOff = additive && selNodes.has(nodeId);
      if (!selNodes.has(nodeId) && !additive) setSelection([nodeId]);
      else if (additive && !selNodes.has(nodeId)) setSelection([...selNodes, nodeId], selEdges);
      current = nodeId;
      const movable = topmost(selNodes.has(nodeId) ? selNodes : [nodeId], graph.nodes).filter((id) => index.get(id)?.draggable !== false);
      const origin = new Map(movable.map((id) => [id, index.get(id)!.position]));
      gesture = {
        kind: "drag",
        pointer: e.pointerId,
        start: p,
        origin: n.draggable === false || !editable() ? new Map() : origin,
        lead: nodeId,
        before: graph,
        moved: false,
        clicked: nodeId,
        additive,
        toggleOff,
      };
      if (doc.activeElement !== nodeEl && !nodeEl!.contains(doc.activeElement)) nodeEl!.focus({ preventScroll: true });
      invalidate({ nodes: true });
      return;
    }
    // Fondo: Mayús+arrastre selecciona con caja; si no, desplaza.
    if (e.shiftKey && !middle && !spaceDown) {
      gesture = { kind: "box", pointer: e.pointerId, start: p, now: p, base: new Set(selNodes), moved: false };
    } else {
      gesture = { kind: "pan", pointer: e.pointerId, start: p, vp, moved: false };
    }
    if (doc.activeElement === null || !root.contains(doc.activeElement)) root.focus({ preventScroll: true });
    e.preventDefault();
  };

  const moveFromMinimap = (e: PointerEvent) => {
    const nav = minimap();
    if (!nav) return;
    const r = nav.getBoundingClientRect();
    const w = nav.clientWidth || r.width;
    const h = nav.clientHeight || r.height;
    const proj = minimapProjection(unionRect(rects.values()), visibleRect(vp, size()), { width: w, height: h });
    setViewportInternal(viewportFromMinimap(proj, { x: e.clientX - r.left, y: e.clientY - r.top }, vp, size()));
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    const p = local(e);
    pointers.set(e.pointerId, p);
    const g = gesture;
    if (!g) return;
    if (g.kind === "pinch") {
      const a = pointers.get(g.ids[0]);
      const b = pointers.get(g.ids[1]);
      if (!a || !b) return;
      setViewportInternal(
        pinchViewport(
          g.vp,
          g.distance,
          Math.hypot(b.x - a.x, b.y - a.y),
          g.center,
          { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
          o.minZoom,
          o.maxZoom,
        ),
      );
      return;
    }
    if (g.kind === "minimap") {
      if (g.pointer === e.pointerId) moveFromMinimap(e);
      return;
    }
    if (g.pointer !== e.pointerId) return;
    if (g.kind === "pan") {
      if (!g.moved && Math.hypot(p.x - g.start.x, p.y - g.start.y) < THRESHOLD) return;
      if (!g.moved) {
        g.moved = true;
        capture(e.pointerId);
        root.dataset.panning = "";
      }
      setViewportInternal({ ...g.vp, x: g.vp.x + p.x - g.start.x, y: g.vp.y + p.y - g.start.y });
    } else if (g.kind === "box") {
      if (!g.moved && Math.hypot(p.x - g.start.x, p.y - g.start.y) < THRESHOLD) return;
      if (!g.moved) {
        g.moved = true;
        capture(e.pointerId);
      }
      g.now = p;
      const a = toWorld(vp, g.start);
      const b = toWorld(vp, p);
      const hits = boxSelection(rects, rectFromPoints(a, b)).filter((id) => !isGroup(index.get(id)!) || boxContains(id, a, b));
      setSelection(new Set([...g.base, ...hits]), selEdges, false);
      invalidate({ nodes: true });
    } else if (g.kind === "drag") {
      if (!g.moved && Math.hypot(p.x - g.start.x, p.y - g.start.y) < THRESHOLD) return;
      if (!g.origin.size) return;
      if (!g.moved) {
        g.moved = true;
        capture(e.pointerId);
        root.dataset.dragging = "";
      }
      const next = dragPositions(g.origin, (p.x - g.start.x) / vp.zoom, (p.y - g.start.y) / vp.zoom, o.snap ?? 16, g.lead);
      commit(setPositions(g.before, next), { type: "move", ids: [...next.keys()], done: false }, false);
    } else if (g.kind === "connect") {
      g.now = p;
      if (!g.moved && Math.hypot(p.x - g.start.x, p.y - g.start.y) < THRESHOLD) return;
      if (!g.moved) {
        g.moved = true;
        capture(e.pointerId);
        connecting = { from: g.from, fromKind: g.fromKind, candidates: validCandidates(g.from), index: -1, keyboard: false };
        invalidate({ nodes: true, chrome: true });
      }
      invalidate({});
    } else if (g.kind === "reconnect") {
      g.now = p;
      invalidate({});
    } else if (g.kind === "resize") {
      if (!g.moved && Math.hypot(p.x - g.start.x, p.y - g.start.y) < 2) return;
      g.moved = true;
      const next = resizeNode(
        g.before,
        g.node,
        { width: g.size.width + (p.x - g.start.x) / vp.zoom, height: g.size.height + (p.y - g.start.y) / vp.zoom },
        o.snap ?? 16,
      );
      commit(next, { type: "resize", ids: [g.node], done: false }, false);
    }
  };
  const boxContains = (id: string, a: Point, b: Point) =>
    boxSelection(new Map([[id, rects.get(id)!]]), rectFromPoints(a, b), "contain").length > 0;

  const endGesture = (e: PointerEvent, cancelled: boolean) => {
    pointers.delete(e.pointerId);
    const g = gesture;
    if (!g) return;
    if (g.kind === "pinch") {
      if (!g.ids.includes(e.pointerId)) return;
      gesture = null;
      return;
    }
    if (g.pointer !== e.pointerId) return;
    gesture = null;
    delete root.dataset.panning;
    delete root.dataset.dragging;
    if (g.kind === "pan") {
      if (g.moved) suppressClick = true;
      else if (!cancelled) setSelection([], []);
    } else if (g.kind === "box") {
      if (g.moved) {
        suppressClick = true;
        emitSelection();
        say(fill(labels.selectedCount, { count: selNodes.size }));
      } else if (!cancelled) setSelection([], []);
    } else if (g.kind === "drag") {
      if (g.moved) {
        suppressClick = true;
        if (cancelled) commit(g.before, { type: "move", ids: [...g.origin.keys()], done: true }, false);
        else {
          undo.record(g.before);
          commit(graph, { type: "move", ids: [...g.origin.keys()], done: true }, false);
        }
      } else if (!cancelled && g.toggleOff)
        setSelection(
          [...selNodes].filter((x) => x !== g.clicked),
          selEdges,
        );
      else if (!cancelled && !g.additive && selNodes.size > 1) setSelection([g.clicked]);
    } else if (g.kind === "connect") {
      if (g.moved) {
        suppressClick = true;
        const c = connecting;
        connecting = null;
        if (!cancelled) {
          const to = dropTarget(e, g.from);
          if (to) connect(g.from, g.fromKind, to);
          else if (c) say(labels.connectCancelled);
        }
        invalidate({ nodes: true, chrome: true });
      }
    } else if (g.kind === "reconnect") {
      suppressClick = true;
      const edge = graph.edges.find((x) => x.id === g.edge);
      if (edge && !cancelled) {
        const fixed: PortRef =
          g.end === "target" ? { node: edge.source, port: edge.sourcePort } : { node: edge.target, port: edge.targetPort };
        const to = dropTarget(e, fixed, edge.id);
        if (to) {
          commit(reconnectEdge(graph, edge.id, g.end, to), { type: "reconnect", ids: [edge.id], done: true });
          say(
            fill(labels.connected, {
              source: nameOf(g.end === "source" ? to.node : edge.source),
              target: nameOf(g.end === "target" ? to.node : edge.target),
            }),
          );
        }
      }
      invalidate({ edges: true, chrome: true });
    } else if (g.kind === "resize") {
      suppressClick = true;
      if (g.moved) {
        if (cancelled) commit(g.before, { type: "resize", ids: [g.node], done: true }, false);
        else {
          undo.record(g.before);
          commit(graph, { type: "resize", ids: [g.node], done: true }, false);
          say(fill(labels.resized, { name: nameOf(g.node) }));
        }
      }
    }
    try {
      if (root.hasPointerCapture(e.pointerId)) root.releasePointerCapture(e.pointerId);
    } catch {
      // Sin captura: nada que soltar.
    }
    invalidate({});
  };
  const onPointerUp = (e: PointerEvent) => endGesture(e, false);
  const onPointerCancel = (e: PointerEvent) => endGesture(e, true);
  const onLostCapture = (e: PointerEvent) => {
    if (gesture && "pointer" in gesture && gesture.pointer === e.pointerId && pointers.has(e.pointerId)) {
      // La captura se perdió sin soltar (el elemento desapareció): se termina como si se soltara.
      endGesture(e, false);
    }
  };

  const onWheel = (e: WheelEvent) => {
    if (disposed || (e.target as Element).closest(".z-node-controls")) return;
    const inNode = (e.target as Element).closest("[data-id]");
    // Un control con desplazamiento propio dentro de un nodo (una lista larga) se desplaza él.
    if (inNode && !e.ctrlKey && !e.metaKey) {
      const scroller = (e.target as Element).closest<HTMLElement>("[data-node-scroll], textarea, select");
      if (scroller) return;
    }
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      setViewportInternal(zoomTo(vp, vp.zoom * wheelFactor(e.deltaY, e.deltaMode, 0.01), local(e), o.minZoom, o.maxZoom));
      return;
    }
    const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? size().height : 1;
    let dx = e.deltaX * k;
    let dy = e.deltaY * k;
    if (e.shiftKey && !dx) {
      dx = dy;
      dy = 0;
    }
    setViewportInternal(panBy(vp, -dx, -dy));
  };

  const onClick = (e: MouseEvent) => {
    if (suppressClick) {
      suppressClick = false;
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    const target = e.target as Element;
    const item = target.closest<HTMLElement>(".z-node-canvas__menu-item");
    if (item && chooser?.contains(item)) {
      choose(item);
      return;
    }
    const action = target.closest<HTMLElement>("[data-node-action]");
    if (action && root.contains(action)) {
      e.preventDefault();
      if (action.getAttribute("aria-disabled") === "true") return;
      runAction(action.dataset.nodeAction ?? "");
      return;
    }
    const port = portRefOf(target);
    if (port) {
      if (connecting) {
        const c = connecting;
        if (c.candidates.some((x) => x.node === port.node && x.port === port.port)) {
          connecting = null;
          connect(c.from, c.fromKind, port);
          invalidate({ nodes: true, chrome: true });
          focusSoon(() => portElement(port));
        } else if (c.from.node === port.node && c.from.port === port.port) cancelConnect();
        return;
      }
      startConnect(port, e.detail === 0);
    }
  };

  const runAction = (name: string) => {
    if (name === "zoom-in") zoomStep(1);
    else if (name === "zoom-out") zoomStep(-1);
    else if (name === "fit") fitView();
    else if (name === "reset") {
      zoomExact(1);
      say(fill(labels.zoomLevel, { percent: 100 }));
    } else if (name === "lock") toggleLock();
    else if (name === "undo") doUndo();
    else if (name === "redo") doRedo();
    else if (name === "layout") doLayout(o.layoutDirection);
    else if (name === "layout-tb") doLayout("TB");
  };

  // Teclado.
  const onKeyDown = (e: KeyboardEvent) => {
    if (disposed || e.defaultPrevented) return;
    const target = (e.composedPath?.()[0] ?? e.target) as HTMLElement;
    if (target.closest?.(".z-node-controls")) return;
    if (gesture && e.key === "Escape") {
      const id = "pointer" in gesture ? gesture.pointer : gesture.kind === "pinch" ? gesture.ids[0] : -1;
      endGesture({ pointerId: id } as PointerEvent, true);
      e.preventDefault();
      return;
    }
    if (target.closest?.(".z-node-minimap")) {
      if (minimapKey(e)) e.preventDefault();
      return;
    }
    if (target.closest?.(".z-node-canvas__menu")) {
      if (chooserKey(e, target) && e.key !== "Tab") e.preventDefault();
      return;
    }
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key;
    if (key === " " && target === root) spaceDown = true;
    if (connecting?.keyboard) {
      if (key === "Escape") cancelConnect();
      else if (key === "ArrowRight" || key === "ArrowDown" || (key === "Tab" && !e.shiftKey)) moveCandidate(1);
      else if (key === "ArrowLeft" || key === "ArrowUp" || (key === "Tab" && e.shiftKey)) moveCandidate(-1);
      else if (key === "Enter" || key === " ") finishKeyboardConnect();
      else return;
      e.preventDefault();
      return;
    }
    if (connecting && key === "Escape") {
      cancelConnect();
      e.preventDefault();
      return;
    }
    const nodeEl = target.closest?.<HTMLElement>("[data-id]");
    const onNode = !!nodeEl && nodeEl === target && (nodeEl.parentElement === nodesLayer || nodeEl.parentElement === groupsLayer);
    const insideNode = !!nodeEl && nodeEl !== target && root.contains(nodeEl);
    if (insideNode) {
      if (key === "Escape") {
        exitNode(nodeEl.dataset.id!);
        e.preventDefault();
      }
      return;
    }
    if (!onNode && target !== root) return;
    const id = onNode ? nodeEl!.dataset.id! : null;
    // Atajos comunes.
    if (mod && !e.altKey) {
      const k = key.toLowerCase();
      if (k === "a") {
        setSelection(graph.nodes.map((n) => n.id));
        say(fill(labels.selectedCount, { count: selNodes.size }));
      } else if (k === "z" && !e.shiftKey) doUndo();
      else if ((k === "z" && e.shiftKey) || k === "y") doRedo();
      else if (k === "d") doDuplicate();
      else if (k === "g" && !e.shiftKey) doGroup();
      else if (k === "g" && e.shiftKey) doUngroup();
      else if (k === "c" || k === "x") {
        // Sin preventDefault: el navegador lanza `copy`/`cut` y ahí se escribe el portapapeles del sistema.
        copy(k === "x");
        return;
      } else if (k === "v") {
        pastePending = true;
        win?.setTimeout(() => {
          if (pastePending) {
            pastePending = false;
            paste(clipboard);
          }
        }, 0);
        return;
      } else if (k === "0") {
        zoomExact(1);
        say(fill(labels.zoomLevel, { percent: 100 }));
      } else return;
      e.preventDefault();
      return;
    }
    if (!mod && (key === "+" || key === "=")) zoomStep(1);
    else if (!mod && (key === "-" || key === "_")) zoomStep(-1);
    else if (!mod && key === "0") {
      zoomExact(1);
      say(fill(labels.zoomLevel, { percent: 100 }));
    } else if (!mod && (key === "f" || key === "F") && !e.altKey) fitView();
    else if (key === "Delete" || key === "Backspace") {
      if (!editable()) return;
      removeSelection();
    } else if (id) {
      if (!nodeKey(e, id)) return;
    } else if (!rootKey(e)) return;
    e.preventDefault();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key === " ") spaceDown = false;
  };

  /** Teclas con el foco en el lienzo (sin nodo): flechas desplazan, Intro va al nodo. */
  const rootKey = (e: KeyboardEvent): boolean => {
    const dir = arrowDirection(e.key);
    if (dir) {
      const step = e.shiftKey ? 200 : 48;
      const d = { up: [0, step], down: [0, -step], left: [step, 0], right: [-step, 0] }[dir];
      setViewportInternal(panBy(vp, d[0]!, d[1]!));
      return true;
    }
    if (e.key === "Enter") {
      const s = size();
      const center = toWorld(vp, { x: s.width / 2, y: s.height / 2 });
      let best: string | null = current;
      if (!best) {
        let bd = Infinity;
        for (const [id, r] of rects) {
          const d = Math.hypot(r.x + r.width / 2 - center.x, r.y + r.height / 2 - center.y);
          if (d < bd) {
            bd = d;
            best = id;
          }
        }
      }
      if (best) goTo(best);
      return !!best;
    }
    if (e.key === "Escape" && (selNodes.size || selEdges.size)) {
      setSelection([], []);
      return true;
    }
    return false;
  };

  /** Teclas con el foco en un nodo. */
  const nodeKey = (e: KeyboardEvent, id: string): boolean => {
    const dir = arrowDirection(e.key);
    if (dir && e.altKey) {
      if (!editable()) return true;
      const ids = topmost(selNodes.has(id) ? selNodes : [id], graph.nodes).filter((x) => index.get(x)?.draggable !== false);
      if (!ids.length) return true;
      const step = (typeof o.snap === "number" && o.snap > 0 ? o.snap : 10) * (e.shiftKey ? 10 : 1);
      const d = { up: [0, -step], down: [0, step], left: [-step, 0], right: [step, 0] }[dir];
      const origin = new Map(ids.map((x) => [x, index.get(x)!.position]));
      commit(
        setPositions(graph, dragPositions(origin, d[0]!, d[1]!, o.snap ?? 16, id)),
        { type: "move", ids, done: true },
        { key: "keyboard-move" },
      );
      reveal(id);
      say(
        fill(labels.moved, {
          name: ids.length > 1 ? fill(labels.selectedCount, { count: ids.length }) : nameOf(id),
          direction: labels.directions[dir],
        }),
      );
      return true;
    }
    if (dir && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      const from = rects.get(id);
      if (!from) return false;
      const ids = [...rects.keys()].filter((x) => x !== id);
      const box = (r: Rect) => ({ left: r.x, top: r.y, right: r.x + r.width, bottom: r.y + r.height });
      const i = nextInDirection(
        box(from),
        ids.map((x) => box(rects.get(x)!)),
        dir,
      );
      // Sin candidato no se hace nada (ni preventDefault).
      if (i < 0) return false;
      goTo(ids[i]!);
      return true;
    }
    if (e.key === "Enter") {
      enterNode(id);
      return true;
    }
    if (e.key === " ") {
      if (selNodes.has(id))
        setSelection(
          [...selNodes].filter((x) => x !== id),
          selEdges,
        );
      else setSelection([...selNodes, id], selEdges);
      say(selNodes.has(id) ? `${nameOf(id)}, ${labels.selected}` : fill(labels.selectedCount, { count: selNodes.size }));
      return true;
    }
    if (e.key === "Escape") {
      // Del nodo al lienzo; allí, otro Escape quita la selección.
      root.focus({ preventScroll: true });
      return true;
    }
    if (e.key === "]" || e.key === "[") {
      const out = e.key === "]";
      const edges = ((out ? adj.outgoing.get(id) : adj.incoming.get(id)) ?? []).filter((x) => index.has(out ? x.target : x.source));
      if (!edges.length) say(out ? labels.noOutgoing : labels.noIncoming);
      else if (edges.length === 1) followEdge(edges[0]!, out, 1);
      else openChooser(id, edges, out);
      return true;
    }
    return false;
  };

  /** Sigue una conexión: foco al otro extremo, la arista marcada y el anuncio. */
  const followEdge = (edge: GraphEdge, out: boolean, count: number, index = 0) => {
    const next = out ? edge.target : edge.source;
    goTo(next);
    setSelection(selNodes, [edge.id], false);
    say(fill(labels.followed, { name: nameOf(next), index: index + 1, count }));
  };
  const closeChooser = (refocus: string | null) => {
    if (!chooser) return;
    chooser.remove();
    chooser = null;
    if (refocus) focusSoon(() => elementOf(refocus));
  };
  /** Varias conexiones que seguir: un menú para elegir (flechas, Intro, Escape). */
  const openChooser = (origin: string, edges: GraphEdge[], out: boolean) => {
    closeChooser(null);
    const menu = doc.createElement("div");
    menu.className = "z-node-canvas__menu z-liquid";
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", fill(out ? labels.outgoingMenu : labels.incomingMenu, { name: nameOf(origin) }));
    menu.dataset.origin = origin;
    edges.forEach((edge, i) => {
      const item = doc.createElement("button");
      item.type = "button";
      item.className = "z-node-canvas__menu-item";
      item.setAttribute("role", "menuitem");
      item.tabIndex = -1;
      item.dataset.edge = edge.id;
      item.dataset.index = String(i);
      const other = out ? edge.target : edge.source;
      item.textContent = edge.label ? `${nameOf(other)} (${edge.label})` : nameOf(other);
      menu.append(item);
    });
    const el = elementOf(origin);
    const r = el?.getBoundingClientRect();
    const host = root.getBoundingClientRect();
    menu.style.setProperty("--z-menu-x", px(r ? Math.min(r.right - host.left, host.width - 220) : 16));
    menu.style.setProperty("--z-menu-y", px(r ? Math.min(r.top - host.top, host.height - 40 * edges.length - 16) : 16));
    root.append(menu);
    chooser = menu;
    menu.querySelector<HTMLElement>("[role=menuitem]")?.focus({ preventScroll: true });
  };
  const chooserKey = (e: KeyboardEvent, target: HTMLElement): boolean => {
    const menu = chooser;
    if (!menu) return false;
    const items = [...menu.querySelectorAll<HTMLElement>("[role=menuitem]")];
    const at = items.indexOf(target.closest<HTMLElement>("[role=menuitem]") ?? items[0]!);
    const go = (i: number) => items[(i + items.length) % items.length]?.focus({ preventScroll: true });
    if (e.key === "ArrowDown") go(at + 1);
    else if (e.key === "ArrowUp") go(at - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(items.length - 1);
    else if (e.key === "Escape") closeChooser(menu.dataset.origin ?? null);
    else if (e.key === "Tab") {
      closeChooser(menu.dataset.origin ?? null);
      return true;
    } else return false;
    return true;
  };
  const choose = (item: HTMLElement) => {
    const menu = chooser;
    if (!menu) return;
    const origin = menu.dataset.origin ?? "";
    const outList = (adj.outgoing.get(origin) ?? []).some((x) => x.id === item.dataset.edge);
    const edges = ((outList ? adj.outgoing.get(origin) : adj.incoming.get(origin)) ?? []).filter((x) =>
      index.has(outList ? x.target : x.source),
    );
    const edge = edges.find((x) => x.id === item.dataset.edge);
    closeChooser(null);
    if (edge) followEdge(edge, outList, edges.length, edges.indexOf(edge));
  };

  const enterNode = (id: string) => {
    const el = elementOf(id);
    if (!el) return;
    entered = id;
    tame(el, true);
    invalidate({ nodes: true });
    const first = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].find((c) => c.tabIndex >= 0 && !c.closest("[hidden]"));
    first?.focus({ preventScroll: true });
  };
  const exitNode = (id: string) => {
    const el = elementOf(id);
    entered = null;
    if (el) tame(el, false);
    invalidate({ nodes: true });
    current = id;
    focusSoon(() => elementOf(id));
  };

  const minimapKey = (e: KeyboardEvent): boolean => {
    const dir = arrowDirection(e.key);
    if (dir) {
      const step = (e.shiftKey ? 400 : 120) * vp.zoom;
      const d = { up: [0, step], down: [0, -step], left: [step, 0], right: [-step, 0] }[dir];
      setViewportInternal(panBy(vp, d[0]!, d[1]!));
      return true;
    }
    if (e.key === "+" || e.key === "=") zoomStep(1);
    else if (e.key === "-") zoomStep(-1);
    else if (e.key === "f" || e.key === "F") fitView();
    else return false;
    return true;
  };

  const onFocusIn = (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    const nodeEl = target.closest<HTMLElement>("[data-id]");
    if (!nodeEl || !(nodeEl.parentElement === nodesLayer || nodeEl.parentElement === groupsLayer)) return;
    const id = nodeEl.dataset.id!;
    if (target !== nodeEl) {
      if (entered !== id) {
        if (entered) {
          const old = elementOf(entered);
          if (old) tame(old, false);
        }
        entered = id;
        tame(nodeEl, true);
      }
    } else if (entered === id) {
      entered = null;
      tame(nodeEl, false);
    }
    if (current !== id) current = id;
    invalidate({ nodes: true });
  };
  const onFocusOut = (e: FocusEvent) => {
    // Si el foco sale del nodo en el que se entró (a otro sitio de la página), sus controles vuelven a salir del orden
    // de tabulación. Sin destino (la ventana pierde el foco) se conserva el estado.
    const next = e.relatedTarget as Node | null;
    if (!entered || !next) return;
    const el = elementOf(entered);
    if (el && el !== next && !el.contains(next)) {
      tame(el, false);
      entered = null;
      invalidate({ nodes: true });
    }
  };

  // Portapapeles del sistema (texto JSON) además del interno.
  const MARK = "application/x-zuix-graph";
  const onCopy = (e: ClipboardEvent) => {
    if (isEditableTarget(e.target)) return;
    const fragment = clipboard ?? copy();
    if (!fragment || !e.clipboardData) return;
    const text = serializeGraph(fragment);
    e.clipboardData.setData("text/plain", text);
    try {
      e.clipboardData.setData(MARK, text);
    } catch {
      // Tipos propios no admitidos: basta con el texto.
    }
    e.preventDefault();
  };
  const onPaste = (e: ClipboardEvent) => {
    if (isEditableTarget(e.target)) return;
    pastePending = false;
    const text = e.clipboardData?.getData(MARK) || e.clipboardData?.getData("text/plain") || "";
    const parsed = text ? parseGraph(text) : null;
    paste(parsed?.nodes.length ? parsed : clipboard);
    e.preventDefault();
  };
  const isEditableTarget = (t: EventTarget | null) => t instanceof Element && t.matches(EDITABLE);

  root.addEventListener("pointerdown", onPointerDown);
  root.addEventListener("pointermove", onPointerMove);
  root.addEventListener("pointerup", onPointerUp);
  root.addEventListener("pointercancel", onPointerCancel);
  root.addEventListener("lostpointercapture", onLostCapture);
  root.addEventListener("wheel", onWheel, { passive: false });
  root.addEventListener("click", onClick, true);
  root.addEventListener("keydown", onKeyDown);
  root.addEventListener("keyup", onKeyUp);
  root.addEventListener("focusin", onFocusIn);
  root.addEventListener("focusout", onFocusOut);
  root.addEventListener("copy", onCopy);
  const onCut = (e: ClipboardEvent) => {
    if (!isEditableTarget(e.target)) onCopy(e);
  };
  root.addEventListener("cut", onCut);
  root.addEventListener("paste", onPaste);
  const onToolbarKey = (e: KeyboardEvent) => {
    const t = e.target as Element;
    if (!t.closest(".z-node-controls") || e.ctrlKey || e.metaKey) return;
    // En la barra, + − y F funcionan igual que en el lienzo.
    if (e.key === "+" || e.key === "=") zoomStep(1);
    else if (e.key === "-") zoomStep(-1);
    else return;
    e.preventDefault();
  };
  root.addEventListener("keydown", onToolbarKey);

  // Primer pintado.
  collect();
  if (!o.viewport && o.fitOnMount !== false) {
    paintView();
    cull(true);
    paintNodes();
    // Al montar no se baja de READABLE_ZOOM: el texto de los nodos (12 px el más pequeño) sigue por encima de 9 px en
    // pantalla. Si el grafo no cabe a ese zoom se ve su principio y el resto se alcanza desplazando; el botón de
    // encuadrar y F siguen enseñándolo entero.
    fitView(48, Math.min(Math.max(o.minZoom ?? MIN_ZOOM, READABLE_ZOOM), o.maxZoom ?? MAX_ZOOM));
  }
  flush();

  /** Espera un fotograma (o nada, sin navegador). */
  const frameWait = () =>
    new Promise<void>((resolve) => (win?.requestAnimationFrame ? win.requestAnimationFrame(() => resolve()) : resolve()));
  /**
   * Clon del diagrama entero para exportarlo: pinta todo (sin recorte), espera a que estén todos los nodos (el binding
   * de React los pinta en su siguiente render) y encuadra el contenido con un margen, al 100 %.
   */
  const exportClone = async (opts: ExportOptions = {}) => {
    const before = o.cull;
    if (before !== false) {
      o = { ...o, cull: false };
      version++;
      invalidateAll();
      flush();
    }
    try {
      for (let i = 0; i < 90; i++) {
        collect();
        if (graph.nodes.every((n) => nodeEls.has(n.id))) break;
        await frameWait();
      }
      // Dos fotogramas más: las medidas de los nodos recién pintados (ResizeObserver) y sus aristas.
      await frameWait();
      await frameWait();
      invalidate({ nodes: true, edges: true });
      flush();
      const boxes: Rect[] = [...rects.values()];
      for (const e of graph.edges) {
        const r = routeOf(e);
        if (r) boxes.push(routeBounds(r));
      }
      const pad = opts.padding ?? 32;
      const content = expandRect(unionRect(boxes) ?? { x: 0, y: 0, width: 1, height: 1 }, pad);
      const bgEl = root.querySelector(".z-node-canvas__background");
      const dots = bgEl && win ? win.getComputedStyle(bgEl, "::before") : null;
      return await cloneForExport(root, opts, (clone) => {
        const world = clone.querySelector<HTMLElement>(".z-node-canvas__world");
        world?.style.setProperty("transform", `translate(${px(-content.x)}, ${px(-content.y)})`);
        clone.style.setProperty("border", "0");
        clone.style.setProperty("border-radius", "0");
        clone.style.setProperty("min-height", "0");
        const bg = clone.querySelector<HTMLElement>(".z-node-canvas__background");
        if (bg) {
          bg.replaceChildren();
          bg.style.setProperty("width", "100%");
          bg.style.setProperty("height", "100%");
          const image = dots?.getPropertyValue("background-image");
          if (image && image !== "none") {
            const step = typeof o.snap === "number" && o.snap > 0 ? o.snap : 16;
            bg.style.setProperty("background-image", image);
            bg.style.setProperty("background-size", `${step}px ${step}px`);
            bg.style.setProperty("background-position", `${px(-content.x % step)} ${px(-content.y % step)}`);
          }
        }
        return { width: content.width, height: content.height };
      });
    } finally {
      if (before !== false) {
        o = { ...o, cull: before };
        version++;
        invalidateAll();
        flush();
      }
    }
  };

  return {
    exportSVG: async (opts) => cloneToSVG(await exportClone(opts), opts?.title),
    exportPNG: async (opts) => {
      const c = await exportClone(opts);
      return svgToPNG(cloneToSVG(c, opts?.title), c.width, c.height, opts?.scale ?? 2, doc);
    },
    setGraph(next) {
      if (next === graph) return;
      graph = next;
      recompute();
      pruneSelection();
      invalidateAll();
      flush();
    },
    setViewport(next) {
      setViewportInternal(next, false);
      flush();
    },
    setOptions(next) {
      const changed = (Object.keys(next) as (keyof typeof next)[]).filter((k) =>
        k === "labels"
          ? JSON.stringify(next.labels ?? null) !== JSON.stringify(o.labels ?? null)
          : next[k] !== o[k as keyof NodeCanvasOptions],
      );
      o = { ...o, ...next };
      // Las funciones (validación, avisos) se renuevan en cada pintado de React sin cambiar nada que se vea.
      if (!changed.some((k) => typeof next[k] !== "function")) return;
      if (changed.includes("labels")) labels = mergeNodeLabels(o.labels);
      version++;
      invalidateAll();
    },
    setSelection(next) {
      setSelection(next.nodes ?? selNodes, next.edges ?? selEdges, false);
      flush();
    },
    refresh() {
      collect();
      invalidate({ nodes: true, edges: true });
      flush();
    },
    fitView: (padding) => fitView(padding),
    zoomIn: () => zoomStep(1),
    zoomOut: () => zoomStep(-1),
    zoomTo: zoomExact,
    undo: doUndo,
    redo: doRedo,
    layout: doLayout,
    focusNode: (id) => {
      if (index.has(id)) goTo(id);
    },
    removeSelection,
    removeEdge(id) {
      if (!editable() || !graph.edges.some((e) => e.id === id)) return;
      commit(removeElements(graph, [], [id]), { type: "remove", ids: [id], done: true });
      say(fill(labels.deleted, { count: 1 }));
    },
    get graph() {
      return graph;
    },
    get viewport() {
      return vp;
    },
    get selection() {
      return { nodes: [...selNodes], edges: [...selEdges] };
    },
    get locked() {
      return locked;
    },
    get visible() {
      return visible;
    },
    get sizes() {
      return new Map([...rects].map(([id, r]) => [id, { width: r.width, height: r.height }]));
    },
    dispose() {
      disposed = true;
      // Lo que pintó esta instancia se retira: otra puede montarse sobre el mismo elemento (React en modo estricto).
      for (const els of edgeEls.values()) {
        els.g.remove();
        els.label?.remove();
        els.ends.source?.remove();
        els.ends.target?.remove();
      }
      edgeEls.clear();
      overlayEl.replaceChildren();
      for (const rect of minimapRects.values()) rect.remove();
      minimapRects.clear();
      descs.replaceChildren();
      chooser?.remove();
      if (frame) win?.cancelAnimationFrame?.(frame);
      resize?.disconnect();
      rootResize?.disconnect();
      stopPause();
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerup", onPointerUp);
      root.removeEventListener("pointercancel", onPointerCancel);
      root.removeEventListener("lostpointercapture", onLostCapture);
      root.removeEventListener("wheel", onWheel);
      root.removeEventListener("click", onClick, true);
      root.removeEventListener("keydown", onKeyDown);
      root.removeEventListener("keyup", onKeyUp);
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("focusout", onFocusOut);
      root.removeEventListener("copy", onCopy);
      root.removeEventListener("paste", onPaste);
      root.removeEventListener("cut", onCut);
      root.removeEventListener("keydown", onToolbarKey);
    },
  };
}
