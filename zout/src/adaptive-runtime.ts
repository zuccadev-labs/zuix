// Parte de navegador de los layouts adaptativos, compartida por el binding de React y el modo sin framework. No toca
// el documento al importarse: cada función recibe el elemento sobre el que actúa.
//
// La colocación inicial la hace la hoja de estilos con consultas de contenedor. Aquí solo queda lo que CSS no puede:
// saber la clase desde JavaScript (para cambiar de variante), reordenar el DOM sin rehacer los nodos y animar un
// cambio con view transitions cuando el usuario no pide menos movimiento.
import {
  inputClassOf,
  orderMismatch,
  parseAreasValue,
  readingOrder,
  sizeClassFor,
  type InputClass,
  type PlacedNode,
  type SizeClass,
} from "./adaptive";

export type MeasureMode = "container" | "window";

export interface SizeState extends InputClass {
  sizeClass: SizeClass;
  /** Ancho medido en px: el de la caja de contenido del contenedor o el de la ventana. */
  width: number;
}

const matchOf = (el: Element) => {
  const view = el.ownerDocument?.defaultView;
  return view?.matchMedia ? (query: string) => view.matchMedia(query) : null;
};

/**
 * Contenedor de consulta del que dependen los hijos de `el`: el propio `el` si lo es, o el ancestro más cercano con
 * `container-type`. Es el mismo que eligen las reglas `@container` sin nombre de la hoja. `null` si no hay ninguno.
 */
export function sizeContainerOf(el: Element): HTMLElement | null {
  const view = el.ownerDocument?.defaultView;
  if (!view) return null;
  for (let node: Element | null = el; node; node = node.parentElement) {
    if (!(node instanceof view.HTMLElement)) continue;
    const type = view.getComputedStyle(node).containerType;
    if (type && type !== "normal") return node;
  }
  return null;
}

/** Ancho de la caja de contenido (lo que mide una consulta de contenedor): sin bordes, relleno ni barra de desplazamiento. */
function contentWidth(el: HTMLElement): number {
  const style = el.ownerDocument.defaultView!.getComputedStyle(el);
  return Math.max(
    0,
    el.clientWidth - (Number.parseFloat(style.paddingInlineStart) || 0) - (Number.parseFloat(style.paddingInlineEnd) || 0),
  );
}

/** Clase de tamaño y de entrada de `el`: sobre su contenedor de consulta, o sobre la ventana con `window` o sin contenedor. */
export function sizeClassOf(el: Element, measure: MeasureMode = "container"): SizeState {
  const view = el.ownerDocument?.defaultView;
  const container = measure === "container" ? sizeContainerOf(el) : null;
  const width = container ? contentWidth(container) : (view?.innerWidth ?? 0);
  return { sizeClass: sizeClassFor(width), width, ...inputClassOf(matchOf(el)) };
}

const same = (a: SizeState | null, b: SizeState) =>
  a !== null && a.sizeClass === b.sizeClass && a.pointer === b.pointer && a.hover === b.hover;

/**
 * Vigila la clase de `el` y llama a `onChange` al empezar y cada vez que cambia la clase de tamaño o la de entrada (no
 * con cada píxel). Devuelve la función que deja de vigilar.
 */
export function observeSizeClass(
  el: Element,
  onChange: (state: SizeState, previous: SizeState | null) => void,
  measure: MeasureMode = "container",
): () => void {
  const view = el.ownerDocument?.defaultView;
  if (!view) return () => {};
  let last: SizeState | null = null;
  const check = () => {
    const next = sizeClassOf(el, measure);
    if (same(last, next)) {
      last = next;
      return;
    }
    const previous = last;
    last = next;
    onChange(next, previous);
  };
  check();
  const offs: (() => void)[] = [];
  const container = measure === "container" ? sizeContainerOf(el) : null;
  if (container && typeof view.ResizeObserver === "function") {
    const ro = new view.ResizeObserver(check);
    ro.observe(container);
    offs.push(() => ro.disconnect());
  } else {
    view.addEventListener("resize", check);
    offs.push(() => view.removeEventListener("resize", check));
  }
  if (view.matchMedia)
    for (const query of ["(pointer: coarse)", "(hover: hover)"]) {
      const mq = view.matchMedia(query);
      mq.addEventListener?.("change", check);
      offs.push(() => mq.removeEventListener?.("change", check));
    }
  return () => {
    for (const off of offs) off();
  };
}

/**
 * Pone los hijos `nodes` de `parent` en ese orden sin rehacerlos. Con `moveBefore` (Chrome 133, Firefox 144) cada nodo
 * conserva el foco, los iframes y las animaciones; sin él se usa `insertBefore` y, si el foco estaba dentro de un nodo
 * movido, se devuelve a su sitio. Solo mueve lo que está fuera de lugar.
 */
export function reorderChildren(parent: Element, nodes: readonly Element[]): boolean {
  const current = [...parent.children].filter((c) => nodes.includes(c));
  if (current.length === nodes.length && current.every((c, i) => c === nodes[i])) return false;
  const doc = parent.ownerDocument;
  const focused =
    doc.activeElement instanceof Element && nodes.some((n) => n.contains(doc.activeElement)) ? (doc.activeElement as HTMLElement) : null;
  const move = (parent as Element & { moveBefore?: (node: Node, child: Node | null) => void }).moveBefore;
  // Se coloca cada nodo delante del que ocupaba el sitio siguiente; el último va detrás del último colocado.
  let anchor: ChildNode | null = current.at(-1)?.nextSibling ?? null;
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i]!;
    if (node.nextSibling !== anchor || node.parentNode !== parent) {
      if (typeof move === "function") move.call(parent, node, anchor);
      else parent.insertBefore(node, anchor);
    }
    anchor = node;
  }
  if (focused?.isConnected && doc.activeElement !== focused) focused.focus({ preventScroll: true });
  return true;
}

/** Si el usuario pide menos movimiento. */
export const prefersReducedMotion = (el: Element) => matchOf(el)?.("(prefers-reduced-motion: reduce)").matches === true;

type Transition = { ready?: Promise<unknown>; finished?: Promise<unknown>; updateCallbackDone?: Promise<unknown> };
type TransitionHost = { startViewTransition?: (update: () => void) => Transition | undefined };

/** Una transición que se salta (porque empieza otra) rechaza sus promesas: no es un error de la aplicación. */
const quiet = (t: Transition | undefined) => {
  for (const p of [t?.ready, t?.finished, t?.updateCallbackDone]) p?.catch(() => {});
};

/**
 * Aplica `update` con una view transition si hay soporte y el usuario no pide menos movimiento; si no, la aplica tal
 * cual. Prefiere la transición limitada al elemento (el resto de la página sigue respondiendo) y, si no existe, la del
 * documento. La actualización siempre deja el estado final aunque la animación se salte.
 */
export function adaptiveTransition(scope: Element, update: () => void): void {
  if (prefersReducedMotion(scope)) {
    update();
    return;
  }
  const own = (scope as Element & TransitionHost).startViewTransition;
  if (typeof own === "function") {
    quiet(own.call(scope, update));
    return;
  }
  const doc = scope.ownerDocument as Document & TransitionHost;
  if (typeof doc.startViewTransition === "function") {
    quiet(doc.startViewTransition(update));
    return;
  }
  update();
}

declare const process: { env: Record<string, string | undefined> };
/** Desarrollo: `process.env.NODE_ENV` distinto de `production` (lo sustituye el bundler) o sin bundler. */
export const isDev = (() => {
  try {
    return process.env.NODE_ENV !== "production";
  } catch {
    return true;
  }
})();

/** Si el navegador hace seguir el foco y la lectura al orden visual de una rejilla (`reading-flow`, Chrome 137). */
export function supportsReadingFlow(el: Element): boolean {
  const css = el.ownerDocument?.defaultView?.CSS;
  return typeof css?.supports === "function" && css.supports("reading-flow", "grid-rows");
}

/* ---------- AdaptiveLayout ---------- */

export type ReorderMode = "dom" | "visual";

/** Rejilla y piezas de un `.z-adaptive`. */
export function layoutParts(layout: Element): { grid: HTMLElement | null; items: HTMLElement[] } {
  const grid = layout.querySelector<HTMLElement>(":scope > .z-adaptive__grid");
  return { grid, items: grid ? [...grid.querySelectorAll<HTMLElement>(":scope > .z-adaptive__item")] : [] };
}

const itemId = (item: HTMLElement, index: number) => item.dataset.item ?? `#${index}`;

/**
 * Orden de lectura que corresponde a `cls`, leído del propio marcado (las variables `--z-areas-*`, `--z-place-*` y
 * `--z-order-*` y `data-hidden-in`): sirve igual para el HTML del binding que para uno escrito a mano. Devuelve los
 * identificadores (`data-item`) en el orden actual del DOM y en el visual.
 */
export function readLayoutOrder(layout: Element, cls: SizeClass): { dom: string[]; visual: string[]; items: HTMLElement[] } {
  const { grid, items } = layoutParts(layout);
  const areas = grid ? parseAreasValue(grid.style.getPropertyValue(`--z-areas-${cls}`)) : null;
  const names = new Set(areas?.flatMap((row) => row.split(/\s+/)) ?? []);
  const nodes: PlacedNode[] = items.map((item, index) => {
    const place = item.style.getPropertyValue(`--z-place-${cls}`).trim();
    const order = Number(item.style.getPropertyValue(`--z-order-${cls}`).trim() || 0);
    return {
      id: itemId(item, index),
      index,
      area: names.has(place) ? place : null,
      order: Number.isFinite(order) ? order : 0,
      hidden: (item.getAttribute("data-hidden-in") ?? "").split(/\s+/).includes(cls),
    };
  });
  return { dom: nodes.map((n) => n.id), visual: readingOrder(areas, nodes), items };
}

export interface OrderReport {
  sizeClass: SizeClass;
  /** Orden del DOM de las piezas (identificadores `data-item`). */
  dom: string[];
  /** Orden visual de las piezas visibles. */
  visual: string[];
  /** Si el DOM y lo que se ve van en distinto orden (en modo `dom`, antes de reordenar). */
  mismatch: boolean;
  /** Si este navegador hace seguir el foco al orden visual de la rejilla (`reading-flow`). */
  readingFlow: boolean;
  /** Si se movieron nodos. */
  moved: boolean;
}

/**
 * Lleva el orden de lectura a `cls`. En modo `dom` mueve las piezas (las ocultas, al final) para que el orden del
 * documento, y con él el de tabulación y el del lector de pantalla, sea el que se ve. En modo `visual` no toca nada e
 * informa de si los dos órdenes se separan. `transition` anima el cambio con view transitions.
 */
// Orden de origen de las piezas de cada rejilla (el del marcado tal como llegó), para volver a él en modo `visual`. Si
// cambia el conjunto de piezas, el orden actual pasa a ser el de origen.
const sourceOrder = new WeakMap<Element, HTMLElement[]>();

function sourceOf(grid: HTMLElement, items: HTMLElement[]): HTMLElement[] {
  const known = sourceOrder.get(grid);
  if (known && known.length === items.length && items.every((item) => known.includes(item))) return known;
  sourceOrder.set(grid, items);
  return items;
}

// Último orden pedido para cada layout. Con una view transition el cambio se aplica más tarde y, si entretanto llega
// otra clase, se aplica la última: el DOM nunca acaba en el orden de una clase anterior.
const wanted = new WeakMap<Element, { cls: SizeClass; mode: ReorderMode }>();

/** Aplica el último orden pedido para `layout`. Devuelve si movió nodos. */
function applyOrder(layout: Element): boolean {
  const want = wanted.get(layout);
  const { grid, items: present } = layoutParts(layout);
  if (!want || !grid) return false;
  const source = sourceOf(grid, present);
  // En modo visual el DOM vuelve a su orden de origen, aunque antes se hubiera reordenado en modo `dom`.
  if (want.mode === "visual") return reorderChildren(grid, source);
  const { dom, visual, items } = readLayoutOrder(layout, want.cls);
  if (!orderMismatch(dom, visual)) return false;
  const byId = new Map(items.map((item, i) => [itemId(item, i), item]));
  const seen = new Set(visual);
  return reorderChildren(
    grid,
    [...visual, ...dom.filter((id) => !seen.has(id))].map((id) => byId.get(id)!),
  );
}

/**
 * Lleva el orden de lectura a `cls`. En modo `dom` mueve las piezas (las ocultas, al final) para que el orden del
 * documento, y con él el de tabulación y el del lector de pantalla, sea el que se ve. En modo `visual` deja el DOM en
 * su orden de origen e informa de si los dos órdenes se separan. `transition` anima el cambio con view transitions.
 */
export function syncLayoutOrder(layout: Element, cls: SizeClass, mode: ReorderMode, transition = false): OrderReport {
  wanted.set(layout, { cls, mode });
  const { grid, items: present } = layoutParts(layout);
  if (grid) sourceOf(grid, present);
  const before = readLayoutOrder(layout, cls);
  const report: OrderReport = {
    sizeClass: cls,
    dom: before.dom,
    visual: before.visual,
    mismatch: orderMismatch(before.dom, before.visual),
    readingFlow: supportsReadingFlow(layout),
    moved: false,
  };
  if (transition && mode === "dom" && report.mismatch) {
    adaptiveTransition(layout, () => {
      applyOrder(layout);
    });
    report.moved = true;
  } else report.moved = applyOrder(layout);
  // En modo visual lo que cuenta es el orden de origen frente al visual.
  if (mode === "visual") {
    const after = readLayoutOrder(layout, cls);
    report.dom = after.dom;
    report.mismatch = orderMismatch(after.dom, after.visual);
  }
  return report;
}
