// Marcado de un lienzo de nodos (contrato HTML): textos por defecto, el árbol de un nodo por defecto (cabecera con
// icono, título y estado; cuerpo; puertos; asa de redimensionado), el de un grupo y la vista en lista. Lo pintan el
// modo DOM (core/vnode → nodos) y las pruebas; el binding de React escribe el mismo marcado. Sin documento.

import { cloudShapeTree, colorVar, folderTabTree } from "./diagram";
import { GRAPH_LABELS, type Graph, type GraphLabels, type GraphNode, indexNodes, isGroup, nodeLabel, type NodePort } from "./graph";
import { portFractions, portSide } from "./ports";
import { fill, h, icon, type VEl } from "./vnode";

export interface NodeCanvasLabels extends GraphLabels {
  /** Nombre del lienzo. */
  canvas: string;
  /** `aria-roledescription` del lienzo, de cada nodo y de cada grupo. */
  roleCanvas: string;
  roleNode: string;
  roleGroup: string;
  instructions: string;
  /** Puertos: «Input {name}» y «Output {name}». */
  input: string;
  output: string;
  selected: string;
  moved: string;
  directions: { up: string; down: string; left: string; right: string };
  resized: string;
  deleted: string;
  selectedCount: string;
  copied: string;
  pasted: string;
  duplicated: string;
  grouped: string;
  ungrouped: string;
  undone: string;
  redone: string;
  layoutDone: string;
  zoomLevel: string;
  locked: string;
  unlocked: string;
  connecting: string;
  connectTarget: string;
  connected: string;
  connectCancelled: string;
  noTargets: string;
  invalidConnection: string;
  followed: string;
  noOutgoing: string;
  noIncoming: string;
  /** Menú para elegir conexión cuando hay varias: «Connections from {name}». */
  outgoingMenu: string;
  incomingMenu: string;
  /** Controles. */
  zoomIn: string;
  zoomOut: string;
  fitView: string;
  resetZoom: string;
  lock: string;
  undo: string;
  redo: string;
  layout: string;
  controls: string;
  minimap: string;
  /** Vista en lista. */
  listNodes: string;
  listEdges: string;
  listName: string;
  listStatus: string;
  listInputs: string;
  listOutputs: string;
  listFrom: string;
  listTo: string;
  listActions: string;
  removeEdge: string;
  showNode: string;
  emptyList: string;
}

export const NODE_CANVAS_LABELS: NodeCanvasLabels = {
  ...GRAPH_LABELS,
  canvas: "Diagram",
  roleCanvas: "diagram",
  roleNode: "node",
  roleGroup: "group",
  instructions:
    "Arrow keys move between nodes. Enter goes into a node and Escape leaves it. Alt with the arrow keys moves the node. ] and [ follow connections. Space selects, Delete removes the selection.",
  input: "Input {name}",
  output: "Output {name}",
  selected: "selected",
  moved: "{name} moved {direction}",
  directions: { up: "up", down: "down", left: "left", right: "right" },
  resized: "{name} resized",
  deleted: "{count} deleted. Control Z undoes it.",
  selectedCount: "{count} selected",
  copied: "{count} copied",
  pasted: "{count} pasted",
  duplicated: "{count} duplicated",
  grouped: "Grouped {count} nodes",
  ungrouped: "Group removed",
  undone: "Undone",
  redone: "Redone",
  layoutDone: "Nodes arranged",
  zoomLevel: "Zoom {percent}%",
  locked: "Canvas locked",
  unlocked: "Canvas unlocked",
  connecting: "Connecting from {port} of {node}. Choose a target with the arrow keys, {count} available. Enter connects, Escape cancels.",
  connectTarget: "{port} of {node}, {index} of {count}",
  connected: "Connected {source} to {target}",
  connectCancelled: "Connection cancelled",
  noTargets: "No compatible ports",
  invalidConnection: "Those ports cannot be connected",
  followed: "{name}, connection {index} of {count}",
  noOutgoing: "No outgoing connections",
  noIncoming: "No incoming connections",
  outgoingMenu: "Connections from {name}",
  incomingMenu: "Connections into {name}",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  fitView: "Fit view",
  resetZoom: "Actual size",
  lock: "Lock canvas",
  undo: "Undo",
  redo: "Redo",
  layout: "Arrange nodes",
  controls: "Canvas controls",
  minimap: "Minimap",
  listNodes: "Nodes",
  listEdges: "Connections",
  listName: "Name",
  listStatus: "Status",
  listInputs: "Inputs",
  listOutputs: "Outputs",
  listFrom: "From",
  listTo: "To",
  listActions: "Actions",
  removeEdge: "Remove connection",
  showNode: "Show",
  emptyList: "No nodes",
};

export function mergeNodeLabels(labels?: Partial<NodeCanvasLabels>): NodeCanvasLabels {
  if (!labels) return NODE_CANVAS_LABELS;
  return {
    ...NODE_CANVAS_LABELS,
    ...labels,
    status: { ...NODE_CANVAS_LABELS.status, ...labels.status },
    directions: { ...NODE_CANVAS_LABELS.directions, ...labels.directions },
  };
}

/** Nombre accesible de un puerto («Input json»). */
export const portLabel = (p: NodePort, labels: NodeCanvasLabels = NODE_CANVAS_LABELS) =>
  fill(p.kind === "target" ? labels.input : labels.output, { name: p.label ?? p.id }).trim();

/** Variables de posición de un nodo (las escribe también la interacción). */
export function nodeVars(x: number, y: number, size?: { width: number; height: number }): Record<string, string> {
  const vars: Record<string, string> = { "--z-node-x": `${round(x)}px`, "--z-node-y": `${round(y)}px` };
  if (size) {
    vars["--z-node-w"] = `${round(size.width)}px`;
    vars["--z-node-h"] = `${round(size.height)}px`;
  }
  return vars;
}
const round = (n: number) => Math.round(n * 100) / 100;

/** Árbol de un puerto. */
export function portTree(p: NodePort, t: number, labels: NodeCanvasLabels = NODE_CANVAS_LABELS): VEl {
  return h(
    "button",
    {
      type: "button",
      class: "z-node-port",
      "data-port": p.id,
      "data-kind": p.kind,
      "data-side": portSide(p),
      "data-type": p.type,
      "data-max": p.max,
      "aria-label": portLabel(p, labels),
      s: { "--z-port-t": round(t) },
    },
    p.label ? h("span", { class: "z-node-port__label" }, p.label) : null,
  );
}

/**
 * Árbol de un nodo por defecto (o de un grupo). `x`/`y` son la posición absoluta. El cuerpo es la descripción del
 * nodo; quien pinta con otro cuerpo usa el mismo envoltorio.
 */
export function nodeTree(node: GraphNode, x: number, y: number, labels: NodeCanvasLabels = NODE_CANVAS_LABELS): VEl {
  const label = nodeLabel(node);
  const color = colorVar(node.data.color as string | undefined);
  if (isGroup(node)) {
    const zone = node.type === "zone";
    return h(
      "div",
      {
        class: "z-node-group",
        "data-id": node.id,
        "data-type": zone ? "zone" : "group",
        role: "group",
        "aria-roledescription": labels.roleGroup,
        "aria-label": label,
        s: { ...nodeVars(x, y, node.size), ...(zone && color ? { "--z-zone-color": color } : {}) },
      },
      h(
        "div",
        { class: "z-node-group__header" },
        node.data.icon ? icon(String(node.data.icon), 16) : null,
        h("span", { class: "z-node-group__title" }, label),
        zone && node.data.description ? h("span", { class: "z-node-group__note" }, String(node.data.description)) : null,
      ),
      h("span", { class: "z-node__resize", "aria-hidden": "true" }),
    );
  }
  const ports = node.ports ?? [];
  const fractions = portFractions(ports);
  const handles = ports.filter((p) => !p.anchor).map((p) => portTree(p, fractions.get(p.id) ?? 0.5, labels));
  const base = {
    "data-id": node.id,
    "data-type": node.type,
    role: "group",
    "aria-roledescription": labels.roleNode,
    "aria-label": label,
  };
  if (node.type === "cloud")
    return h(
      "div",
      { class: "z-node", ...base, s: nodeVars(x, y, node.size) },
      cloudShapeTree(),
      h("div", { class: "z-node__header" }, h("span", { class: "z-node__title" }, label)),
      node.data.description ? h("div", { class: "z-node__body" }, String(node.data.description)) : null,
      ...handles,
    );
  if (node.type === "folder")
    return h(
      "div",
      { class: "z-node z-folder-card", ...base, s: { ...nodeVars(x, y, node.size), ...(color ? { "--z-folder-color": color } : {}) } },
      folderTabTree({ title: label, kind: node.data.kind as string | undefined, icon: node.data.icon as string | undefined, as: "span" }),
      h("div", { class: "z-folder-card__body" }, node.data.description ? String(node.data.description) : null),
      ...handles,
      h("span", { class: "z-node__resize", "aria-hidden": "true" }),
    );
  const status = node.data.status;
  const statusText = status ? labels.status[status] : "";
  return h(
    "div",
    {
      class: "z-node",
      "data-id": node.id,
      "data-type": node.type,
      "data-status": status && status !== "idle" ? status : undefined,
      "data-tone": node.data.tone,
      role: "group",
      "aria-roledescription": labels.roleNode,
      "aria-label": label,
      s: nodeVars(x, y, node.size),
    },
    h(
      "div",
      { class: "z-node__header" },
      node.data.icon ? h("span", { class: "z-node__icon", "aria-hidden": "true" }, icon(String(node.data.icon), 16)) : null,
      h("span", { class: "z-node__title" }, label),
      statusText ? h("span", { class: "z-node__status", "data-status": status }, statusText) : null,
    ),
    node.data.description ? h("div", { class: "z-node__body" }, String(node.data.description)) : null,
    ...handles,
    h("span", { class: "z-node__resize", "aria-hidden": "true" }),
  );
}

/** Vista en lista: una tabla de nodos con sus conexiones y otra de conexiones, con las mismas acciones. */
export function listViewTree(graph: Graph, labels: NodeCanvasLabels = NODE_CANVAS_LABELS, readOnly = false): VEl {
  const index = indexNodes(graph.nodes);
  const nodes = graph.nodes.filter((n) => !isGroup(n));
  const th = (text: string) => h("th", { scope: "col" }, text);
  const count = (n: GraphNode, kind: "target" | "source") => {
    const own = (n.ports ?? []).filter((p) => p.kind === kind).length;
    return String(own);
  };
  return h(
    "div",
    { class: "z-node-list" },
    h(
      "div",
      { class: "z-node-list__scroll", role: "region", "aria-label": labels.listNodes, tabindex: 0 },
      h(
        "table",
        { class: "z-table z-node-list__table" },
        h("caption", { class: "z-node-list__caption" }, labels.listNodes),
        h(
          "thead",
          null,
          h("tr", null, th(labels.listName), th(labels.listStatus), th(labels.listInputs), th(labels.listOutputs), th(labels.listActions)),
        ),
        h(
          "tbody",
          null,
          ...(nodes.length
            ? nodes.map((n) =>
                h(
                  "tr",
                  { key: n.id, "data-id": n.id },
                  h("th", { scope: "row" }, nodeLabel(n)),
                  h("td", null, n.data.status ? labels.status[n.data.status] || "—" : "—"),
                  h("td", null, count(n, "target")),
                  h("td", null, count(n, "source")),
                  h(
                    "td",
                    null,
                    h(
                      "button",
                      { type: "button", class: "z-btn z-btn--ghost", "data-size": "sm", "data-node-action": "show", "data-node": n.id },
                      labels.showNode,
                      h("span", { class: "z-sr-only" }, ` ${nodeLabel(n)}`),
                    ),
                  ),
                ),
              )
            : [h("tr", null, h("td", { colspan: 5 }, labels.emptyList))]),
        ),
      ),
    ),
    h(
      "div",
      { class: "z-node-list__scroll", role: "region", "aria-label": labels.listEdges, tabindex: 0 },
      h(
        "table",
        { class: "z-table z-node-list__table" },
        h("caption", { class: "z-node-list__caption" }, labels.listEdges),
        h("thead", null, h("tr", null, th(labels.listFrom), th(labels.listTo), th(labels.listActions))),
        h(
          "tbody",
          null,
          ...graph.edges.map((e) => {
            const from = `${nodeLabel(index.get(e.source))}${e.sourcePort ? ` · ${e.sourcePort}` : ""}`;
            const to = `${nodeLabel(index.get(e.target))}${e.targetPort ? ` · ${e.targetPort}` : ""}`;
            return h(
              "tr",
              { key: e.id, "data-edge": e.id },
              h("td", null, from),
              h("td", null, e.label ? `${to} (${e.label})` : to),
              h(
                "td",
                null,
                readOnly
                  ? "—"
                  : h(
                      "button",
                      {
                        type: "button",
                        class: "z-btn z-btn--ghost",
                        "data-size": "sm",
                        "data-node-action": "remove-edge",
                        "data-edge": e.id,
                      },
                      labels.removeEdge,
                      h("span", { class: "z-sr-only" }, ` ${from} → ${to}`),
                    ),
              ),
            );
          }),
        ),
      ),
    ),
  );
}

export interface ControlsOptions {
  showZoom?: boolean;
  showFit?: boolean;
  showLock?: boolean;
  /** Deshacer y rehacer. Por defecto sí. */
  showHistory?: boolean;
  /** Ordenar los nodos (disposición por capas). Por defecto no. */
  showLayout?: boolean;
  orientation?: "horizontal" | "vertical";
  position?: "bottom-left" | "top-left" | "top-right";
}

const ctrl = (action: string, label: string, glyph: string, extra: Record<string, string> = {}): VEl =>
  h(
    "button",
    {
      type: "button",
      title: label,
      "aria-label": label,
      class: "z-btn z-btn--icon z-btn--ghost",
      "data-size": "sm",
      "data-node-action": action,
      ...extra,
    },
    icon(glyph, 16),
  );

/** Barra de controles del lienzo (contrato de Toolbar: una parada de tabulación, flechas entre botones). */
export function controlsTree(labels: NodeCanvasLabels = NODE_CANVAS_LABELS, o: ControlsOptions = {}): VEl {
  const orientation = o.orientation ?? "vertical";
  const kids: VEl[] = [];
  const sep = () =>
    h("div", {
      role: "separator",
      "aria-orientation": orientation === "vertical" ? "horizontal" : "vertical",
      class: "z-toolbar__separator",
    });
  if (o.showZoom !== false)
    kids.push(ctrl("zoom-in", labels.zoomIn, "magnifying-glass-plus"), ctrl("zoom-out", labels.zoomOut, "magnifying-glass-minus"));
  if (o.showFit !== false) kids.push(ctrl("fit", labels.fitView, "arrows-pointing-in"));
  if (o.showLock !== false)
    kids.push(
      h(
        "button",
        {
          type: "button",
          title: labels.lock,
          "aria-label": labels.lock,
          "aria-pressed": "false",
          class: "z-btn z-btn--icon z-btn--ghost",
          "data-size": "sm",
          "data-node-action": "lock",
        },
        h(
          "span",
          { "data-lock-icon": "open", class: "z-node-controls__lock" },
          h("span", { "data-when": "open" }, icon("lock-open", 16)),
          h("span", { "data-when": "closed" }, icon("lock-closed", 16)),
        ),
      ),
    );
  if (o.showHistory !== false) {
    if (kids.length) kids.push(sep());
    kids.push(
      ctrl("undo", labels.undo, "arrow-uturn-up-left", { "aria-disabled": "true" }),
      ctrl("redo", labels.redo, "arrow-uturn-up-right", { "aria-disabled": "true" }),
    );
  }
  if (o.showLayout) kids.push(ctrl("layout", labels.layout, "squares-2x2"));
  return h(
    "div",
    {
      role: "toolbar",
      "aria-label": labels.controls,
      "aria-orientation": orientation,
      class: "z-toolbar z-liquid z-node-controls",
      "data-variant": "glass",
      "data-size": "sm",
      "data-position": o.position,
    },
    ...kids,
  );
}

/** Minimapa (el contenido lo pinta la interacción). */
export const minimapTree = (labels: NodeCanvasLabels = NODE_CANVAS_LABELS, position?: string): VEl =>
  h("nav", { class: "z-node-minimap z-liquid", "aria-label": labels.minimap, "data-position": position, tabindex: 0 });
