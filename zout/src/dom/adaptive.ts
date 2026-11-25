// Layouts adaptativos sin framework: `.z-adaptive` (AdaptiveLayout) y `.z-adaptive-switch` (AdaptiveSwitch). La
// colocación y la variante visible ya las pone la hoja; aquí se mide la clase para emitir `z:sizeclass`, se reordena el
// DOM en el modo `dom` y se editan plantillas y piezas en vivo (setAdaptiveTemplates, setAdaptiveItem).
import {
  SIZE_CLASS_NAMES,
  nodeStyle,
  parseAreasValue,
  templateVars,
  type AdaptiveNode,
  type AdaptiveTemplates,
  type SizeClass,
} from "../adaptive";
import {
  adaptiveTransition,
  isDev,
  layoutParts,
  observeSizeClass,
  syncLayoutOrder,
  type MeasureMode,
  type ReorderMode,
  type SizeState,
} from "../adaptive-runtime";

const watched = new WeakMap<HTMLElement, () => void>();
const current = new WeakMap<HTMLElement, SizeClass>();
const inDom = (el: Element) => el.closest("[data-z-dom]") !== null;

function all(root: ParentNode, selector: string): HTMLElement[] {
  const list = [...root.querySelectorAll<HTMLElement>(selector)];
  if (root instanceof HTMLElement && root.matches(selector)) list.unshift(root);
  return list.filter(inDom);
}

const emit = (el: Element, name: string, detail: unknown) =>
  el.dispatchEvent(new CustomEvent(`z:${name}`, { bubbles: true, cancelable: true, detail }));

const measureOf = (el: HTMLElement): MeasureMode => (el.dataset.measure === "window" ? "window" : "container");
const reorderOf = (el: HTMLElement): ReorderMode => (el.dataset.reorder === "visual" ? "visual" : "dom");

/** Reordena (modo `dom`) o comprueba el orden (modo `visual`) de un layout en su clase actual. */
function syncOrder(layout: HTMLElement, animate: boolean): void {
  const cls = current.get(layout);
  if (!cls) return;
  const report = syncLayoutOrder(layout, cls, reorderOf(layout), animate && layout.hasAttribute("data-transition"));
  // Con el orden visual separado del DOM se avisa; cancelado el evento, la aplicación se encarga.
  if (reorderOf(layout) === "visual" && report.mismatch && emit(layout, "ordermismatch", report) && isDev && !report.readingFlow)
    console.warn(
      `[zout] .z-adaptive: en ${cls} el orden visual (${report.visual.join(", ")}) no es el del DOM (${report.dom.join(", ")}).`,
    );
}

function watchLayout(layout: HTMLElement): void {
  if (watched.has(layout)) {
    syncOrder(layout, false);
    return;
  }
  watched.set(
    layout,
    observeSizeClass(
      layout,
      (state, previous) => {
        current.set(layout, state.sizeClass);
        layout.dataset.sizeClass = state.sizeClass;
        // La hoja ya colocó las piezas: el cambio de orden del DOM no se ve y no se anima.
        if (emit(layout, "sizeclass", detailOf(state, previous))) syncOrder(layout, false);
      },
      measureOf(layout),
    ),
  );
}

const detailOf = (state: SizeState, previous: SizeState | null) => ({ ...state, previous: previous?.sizeClass ?? null });

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function watchSwitch(el: HTMLElement): void {
  if (watched.has(el)) return;
  // Si el foco está dentro: al ocultarse su variante el navegador lo devuelve a <body> antes de que se pueda mirar.
  let inside = false;
  const onIn = () => {
    inside = true;
  };
  const onOut = (event: FocusEvent) => {
    if (event.relatedTarget instanceof Node && !el.contains(event.relatedTarget)) inside = false;
  };
  el.addEventListener("focusin", onIn);
  el.addEventListener("focusout", onOut);
  const stop = observeSizeClass(
    el,
    (state, previous) => {
      const variants = [...el.querySelectorAll<HTMLElement>(":scope > .z-adaptive-switch__variant")];
      const active = variants.find((v) => (v.dataset.classes ?? "").split(/\s+/).includes(state.sizeClass));
      el.dataset.sizeClass = state.sizeClass;
      if (active?.dataset.variant) el.dataset.variant = active.dataset.variant;
      emit(el, "sizeclass", { ...detailOf(state, previous), variant: active?.dataset.variant ?? null });
      if (!inside || !active) return;
      // El foco estaba en la variante que se oculta: pasa al primer control de la que se muestra.
      const doc = el.ownerDocument;
      requestAnimationFrame(() => {
        const now = doc.activeElement;
        if (!now || now === doc.body || (el.contains(now) && !active.contains(now))) active.querySelector<HTMLElement>(FOCUSABLE)?.focus();
      });
    },
    measureOf(el),
  );
  watched.set(el, () => {
    stop();
    el.removeEventListener("focusin", onIn);
    el.removeEventListener("focusout", onOut);
  });
}

export function hydrateAdaptive(root: ParentNode): void {
  for (const layout of all(root, ".z-adaptive")) watchLayout(layout);
  for (const el of all(root, ".z-adaptive-switch")) watchSwitch(el);
}

export function disposeAdaptive(root: ParentNode): void {
  for (const el of all(root, ".z-adaptive, .z-adaptive-switch")) {
    watched.get(el)?.();
    watched.delete(el);
    current.delete(el);
  }
}

/** Plantillas efectivas de un layout, leídas de las variables de su rejilla (las cinco clases, ya resueltas). */
export function getAdaptiveTemplates(layout: HTMLElement): AdaptiveTemplates {
  const { grid } = layoutParts(layout);
  const out: AdaptiveTemplates = {};
  if (!grid) return out;
  for (const cls of SIZE_CLASS_NAMES) {
    const areas = parseAreasValue(grid.style.getPropertyValue(`--z-areas-${cls}`));
    if (!areas) continue;
    const columns = grid.style.getPropertyValue(`--z-columns-${cls}`).trim();
    const rows = grid.style.getPropertyValue(`--z-rows-${cls}`).trim();
    out[cls] = { areas, ...(columns ? { columns } : {}), ...(rows && rows !== "none" ? { rows } : {}) };
  }
  return out;
}

/**
 * Cambia las plantillas de un layout (`{ [clase]: { areas, columns?, rows? } }`) y recoloca las piezas que tengan
 * guardados sus ajustes (las que pasaron por `setAdaptiveItem`). Con `data-transition`, animado.
 */
export function setAdaptiveTemplates(layout: HTMLElement, templates: AdaptiveTemplates): void {
  const { grid, items } = layoutParts(layout);
  if (!grid) return;
  const apply = () => {
    for (const [name, value] of Object.entries(templateVars(templates))) grid.style.setProperty(name, value);
    for (const item of items) {
      const node = nodes.get(item);
      if (node) writeItem(item, node, templates);
    }
    syncOrder(layout, false);
  };
  if (layout.hasAttribute("data-transition")) adaptiveTransition(layout, apply);
  else apply();
}

const nodes = new WeakMap<HTMLElement, AdaptiveNode>();

function writeItem(item: HTMLElement, node: AdaptiveNode, templates: AdaptiveTemplates): void {
  const { vars, hiddenIn } = nodeStyle(templates, node);
  for (const [name, value] of Object.entries(vars)) item.style.setProperty(name, value);
  if (hiddenIn) item.setAttribute("data-hidden-in", hiddenIn);
  else item.removeAttribute("data-hidden-in");
}

/**
 * Cambia el área, el orden o la visibilidad de una pieza (`.z-adaptive__item`), por clase: lo que haría el editor.
 * `node` es `{ area?, order?, span?, hidden?, adaptive? }`; el identificador sale de `data-item`.
 */
export function setAdaptiveItem(item: HTMLElement, node: Omit<AdaptiveNode, "id">): void {
  const layout = item.closest<HTMLElement>(".z-adaptive");
  if (!layout) return;
  const full: AdaptiveNode = { id: item.dataset.item ?? "", ...node };
  nodes.set(item, full);
  const apply = () => {
    writeItem(item, full, getAdaptiveTemplates(layout));
    syncOrder(layout, false);
  };
  if (layout.hasAttribute("data-transition")) adaptiveTransition(layout, apply);
  else apply();
}
