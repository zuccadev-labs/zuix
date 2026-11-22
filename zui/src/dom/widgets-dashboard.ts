// Familia de dashboard y tableros sin framework. Gauge, DeltaBadge, ProgressGoal, BarList, FunnelChart, Tracker y
// KanbanBoard se pintan con el mismo árbol que el binding de React (core/widget + core/vnode). DashboardGrid conecta la
// misma interacción (core/dashboard-grid) al marcado ya escrito: la disposición vive en los `data-x/y/w/h` de cada
// pieza; al soltar se escriben, los nodos se reordenan al orden de lectura y sale `z:layoutchange { layout }`.
import { registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { arrowTrendingDownRight } from "@zuccadev-labs/zuix-zicon/icons/arrow-trending-down-right";
import { arrowTrendingUpRight } from "@zuccadev-labs/zuix-zicon/icons/arrow-trending-up-right";
import { arrowsPointingOut } from "@zuccadev-labs/zuix-zicon/icons/arrows-pointing-out";
import { calendar } from "@zuccadev-labs/zuix-zicon/icons/calendar";
import { checkCircle } from "@zuccadev-labs/zuix-zicon/icons/check-circle";
import { chevronDown } from "@zuccadev-labs/zuix-zicon/icons/chevron-down";
import { chevronUp } from "@zuccadev-labs/zuix-zicon/icons/chevron-up";
import { exclamationTriangle } from "@zuccadev-labs/zuix-zicon/icons/exclamation-triangle";
import { minus } from "@zuccadev-labs/zuix-zicon/icons/minus";
import { plus } from "@zuccadev-labs/zuix-zicon/icons/plus";
import { attachDashboardGrid, readLayout, writeLayout } from "../core/dashboard-grid";
import { barListWidget, deltaWidget, funnelWidget, progressGoalWidget } from "../core/dashboard-trees";
import { gaugeWidget } from "../core/gauge";
import { GRID_LABELS, normalizeLayout, sortLayout, type GridLabels, type GridLayout } from "../core/grid-layout";
import { kanbanWidget } from "../core/kanban-widget";
import { trackerWidget } from "../core/tracker";
import { emit, inDom } from "./forms-popup";
import type { DomPart } from "./shared";
import { widgetPart } from "./widgets";

registerIcons([
  arrowTrendingDownRight,
  arrowTrendingUpRight,
  arrowsPointingOut,
  calendar,
  checkCircle,
  chevronDown,
  chevronUp,
  exclamationTriangle,
  minus,
  plus,
]);

export const dashboardWidgets = /* @__PURE__ */ widgetPart(45.8, [
  gaugeWidget,
  deltaWidget,
  progressGoalWidget,
  barListWidget,
  funnelWidget,
  trackerWidget,
  kanbanWidget,
]);

interface GridEntry {
  committed: GridLayout;
  detach: () => void;
}
const grids = new Map<HTMLElement, GridEntry>();

const canvasOf = (el: HTMLElement) => el.querySelector<HTMLElement>(":scope > .z-dashboard-grid__canvas") ?? el;

/** Variables de posición (sin tocar los atributos: es la vista provisional). */
function writeVars(el: HTMLElement, layout: GridLayout): void {
  const canvas = canvasOf(el);
  for (const item of layout) {
    const node = canvas.querySelector<HTMLElement>(`:scope > .z-dashboard-grid__item[data-id="${CSS.escape(item.id)}"]`);
    if (!node) continue;
    node.style.setProperty("--z-x", String(item.x));
    node.style.setProperty("--z-y", String(item.y));
    node.style.setProperty("--z-w", String(item.w));
    node.style.setProperty("--z-h", String(item.h));
  }
}

/** Reordena los nodos al orden de lectura (con `moveBefore` donde existe: conserva el estado y el foco). */
function reorder(el: HTMLElement, layout: GridLayout): void {
  const canvas = canvasOf(el);
  const focused = el.ownerDocument.activeElement as HTMLElement | null;
  const move = (canvas as HTMLElement & { moveBefore?: (n: Node, ref: Node | null) => void }).moveBefore;
  for (const item of sortLayout(layout)) {
    const node = canvas.querySelector<HTMLElement>(`:scope > .z-dashboard-grid__item[data-id="${CSS.escape(item.id)}"]`);
    if (!node) continue;
    if (move) move.call(canvas, node, null);
    else canvas.append(node);
  }
  if (focused && el.contains(focused) && el.ownerDocument.activeElement !== focused) focused.focus({ preventScroll: true });
}

function labelsOf(el: HTMLElement): GridLabels {
  const out: GridLabels = { ...GRID_LABELS };
  for (const key of Object.keys(GRID_LABELS) as (keyof GridLabels)[]) {
    const v = el.dataset[`${key}Label`];
    if (v !== undefined) out[key] = v;
  }
  return out;
}

function mountGrid(el: HTMLElement): void {
  if (grids.has(el)) return;
  const cols = () => Number(el.dataset.cols) || 12;
  const entry: GridEntry = { committed: normalizeLayout(readLayout(el), cols()), detach: () => {} };
  writeLayout(el, entry.committed);
  reorder(el, entry.committed);
  entry.detach = attachDashboardGrid(el, {
    layout: () => entry.committed,
    preview: (next) => writeVars(el, next ?? entry.committed),
    commit: (next) => {
      entry.committed = next;
      writeLayout(el, next);
      reorder(el, next);
      emit(el, "layoutchange", { layout: sortLayout(next) });
    },
    editable: () => el.dataset.editable !== undefined && el.dataset.editable !== "false",
    labels: () => labelsOf(el),
  });
  grids.set(el, entry);
}

/** Disposición confirmada de una DashboardGrid montada (en orden de lectura), o `null`. */
export function getDashboardLayout(el: HTMLElement): GridLayout | null {
  const entry = grids.get(el);
  return entry ? sortLayout(entry.committed) : null;
}

/** Cambia la disposición de una DashboardGrid montada (la normaliza, la escribe y reordena los nodos; sin evento). */
export function setDashboardLayout(el: HTMLElement, layout: GridLayout): void {
  const entry = grids.get(el);
  if (!entry) return;
  entry.committed = normalizeLayout(layout, Number(el.dataset.cols) || 12);
  writeLayout(el, entry.committed);
  reorder(el, entry.committed);
}

export const dashboardGridPart: DomPart = {
  rank: 45.9,
  setup() {},
  hydrate(root) {
    const found = [...root.querySelectorAll<HTMLElement>(".z-dashboard-grid")];
    if (root instanceof HTMLElement && root.matches(".z-dashboard-grid")) found.unshift(root);
    for (const el of found) if (inDom(el)) mountGrid(el);
    for (const el of [...grids.keys()])
      if (!el.isConnected) {
        grids.get(el)!.detach();
        grids.delete(el);
      }
  },
  teardown() {
    for (const entry of grids.values()) entry.detach();
    grids.clear();
  },
};
