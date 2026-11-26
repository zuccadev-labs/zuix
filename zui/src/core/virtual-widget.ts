// Virtualización de las piezas de core/*-widget (MessageList, ConversationList, MemberList, TransferList): la ventana
// sale del estado (desplazamiento y alto guardados solo cuando cambia lo que hay que pintar), los altos medidos viven en
// un Map del estado y los rellenos son nodos `aria-hidden`. El árbol es puro; `followVirtual` (tras pintar) vigila el
// contenedor que desplaza aunque el repintado lo sustituya. Sin efectos al importar.

import { listWindow, sameWindow, scrollForIndex, type ListWindow } from "./virtual";
import { trackViewport, type ViewportState } from "./virtual-runtime";
import { h, type VEl } from "./vnode";

export type { ViewportState };

export interface WidgetListInput {
  /** Si se virtualiza (ver `wantsVirtual`). */
  virtual: boolean;
  count: number;
  /** Clave de cada fila (para los altos medidos). */
  keyOf: (index: number) => string;
  /** Alto estimado de una fila que aún no se ha medido. */
  estimate: number | ((index: number) => number);
  /** Altos medidos (los escribe `measureInto` tras pintar). */
  heights?: ReadonlyMap<string, number>;
  /** Desplazamiento y alto del contenedor; sin ellos, la primera ventana con un alto supuesto. */
  view?: ViewportState | null;
  /** Índices que no salen del documento (la fila activa, la parada de Tab). */
  keep?: ReadonlyArray<number>;
  overscan?: number;
}

/** Ventana de una lista de una pieza: todas las filas o la ventana visible más las fijadas. */
export function widgetList(input: WidgetListInput): ListWindow {
  const size = (i: number) => {
    const known = input.heights?.get(input.keyOf(i));
    if (known !== undefined) return known;
    return typeof input.estimate === "number" ? input.estimate : input.estimate(i);
  };
  return listWindow({
    virtual: input.virtual,
    count: input.count,
    size,
    scroll: input.view?.scroll ?? 0,
    viewport: input.view?.viewport || 640,
    overscan: input.overscan ?? 6,
    keep: input.keep,
  });
}

/** Relleno que ocupa el sitio de las filas no pintadas (fuera del árbol de accesibilidad). */
export function spacerNode(tag: string, key: string, px: number): VEl | null {
  if (!(px > 0)) return null;
  return h(tag, {
    key: `spacer-${key}`,
    class: "z-virtual-spacer",
    "aria-hidden": "true",
    s: { "--z-virtual-space": `${Math.round(px)}px` },
  });
}

/**
 * Mide las filas pintadas (`selector`, clave en `data-key`) y guarda su alto más el hueco del contenedor (`gap`) en
 * `heights`. `true` si alguna cambió.
 */
export function measureInto(container: Element, selector: string, heights: Map<string, number>): boolean {
  const style = container.ownerDocument.defaultView?.getComputedStyle(container);
  const gap = Number.parseFloat(style?.rowGap ?? "") || 0;
  let changed = false;
  for (const row of container.querySelectorAll<HTMLElement>(selector)) {
    const key = row.getAttribute("data-key");
    const height = row.offsetHeight;
    if (key === null || !height) continue;
    if (heights.get(key) !== height + gap) {
      heights.set(key, height + gap);
      changed = true;
    }
  }
  return changed;
}

const followed = new WeakMap<HTMLElement, Map<string, { el: HTMLElement; stop: () => void }>>();

/**
 * Tras cada pintado: vigila el contenedor `selector` de la pieza (o deja de vigilar si ya no está o no virtualiza).
 * `onView` recibe el desplazamiento nuevo; la pieza decide si cambia la ventana y vuelve a pintar.
 */
export function followVirtual(root: HTMLElement, name: string, selector: string | null, onView: (view: ViewportState) => void): void {
  let map = followed.get(root);
  const el = selector ? root.querySelector<HTMLElement>(selector) : null;
  const prev = map?.get(name);
  if (prev?.el === el) return;
  prev?.stop();
  if (!el) {
    map?.delete(name);
    return;
  }
  if (!map) {
    map = new Map();
    followed.set(root, map);
  }
  map.set(name, { el, stop: trackViewport(el, onView) });
}

/** Deja de vigilar todo lo de una pieza (al desmontar). */
export function unfollowVirtual(root: HTMLElement): void {
  for (const { stop } of followed.get(root)?.values() ?? []) stop();
  followed.delete(root);
}

/** ¿Cambia la ventana con el desplazamiento nuevo? Para no volver a pintar en cada fotograma de desplazamiento. */
export function windowChanges(input: WidgetListInput, view: ViewportState): boolean {
  const a = widgetList(input);
  const b = widgetList({ ...input, view });
  return !sameWindow(a, b) || a.indices.join() !== b.indices.join();
}

/** Desplaza el contenedor para que se vea la fila `index` (antes de que exista en el documento). */
export function scrollToRow(scroller: HTMLElement | null, input: WidgetListInput, index: number): void {
  if (!scroller || !input.virtual) return;
  const size = (i: number) =>
    input.heights?.get(input.keyOf(i)) ?? (typeof input.estimate === "number" ? input.estimate : input.estimate(i));
  const top = scrollForIndex(index, size, input.count, scroller.scrollTop, scroller.clientHeight);
  if (top !== scroller.scrollTop) scroller.scrollTop = top;
}
