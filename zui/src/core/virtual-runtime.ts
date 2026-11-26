// Virtualización conectada al documento: vigila el contenedor que desplaza (desplazamiento pasivo y ResizeObserver
// del contenedor y de las filas pintadas), mide las filas de alto variable y lleva el desplazamiento a un índice.
// La comparten el binding de React (primitives/virtual), las piezas de core/*-widget y el modo DOM. El cálculo de qué
// pintar es el de ./virtual; aquí solo lo que necesita el documento. Sin efectos al importar.

import {
  createSizeCache,
  listWindow,
  offsets,
  sameWindow,
  scrollForIndex,
  type ListWindow,
  type ScrollAlign,
  type SizeCache,
} from "./virtual";

export interface ViewportState {
  /** Desplazamiento dentro de la lista (el del contenedor menos lo que hay delante de la lista). */
  scroll: number;
  /** Alto visible del contenedor. */
  viewport: number;
}

/**
 * Sigue el desplazamiento y el alto de `scroller` y llama a `onChange` como mucho una vez por fotograma. `offset`
 * es lo que ocupa el contenido anterior a la lista dentro del mismo contenedor (una cabecera de tabla, un buscador).
 */
export function trackViewport(scroller: HTMLElement, onChange: (state: ViewportState) => void, offset: () => number = () => 0): () => void {
  const win = scroller.ownerDocument.defaultView;
  let frame = 0;
  let last: ViewportState | null = null;
  const read = () => {
    frame = 0;
    const next = { scroll: Math.max(0, scroller.scrollTop - offset()), viewport: scroller.clientHeight };
    if (last && last.scroll === next.scroll && last.viewport === next.viewport) return;
    last = next;
    onChange(next);
  };
  const schedule = () => {
    if (!frame) frame = win?.requestAnimationFrame(read) ?? 0;
  };
  scroller.addEventListener("scroll", schedule, { passive: true });
  const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
  ro?.observe(scroller);
  read();
  return () => {
    scroller.removeEventListener("scroll", schedule);
    ro?.disconnect();
    if (frame) win?.cancelAnimationFrame(frame);
  };
}

/**
 * Mide las filas pintadas (`selector` dentro de `container`, con la clave en `data-key` o en `keyAttr`) y guarda su
 * alto en la caché. `true` si alguna cambió.
 */
export function measureRows(container: ParentNode, selector: string, cache: SizeCache, keyAttr = "data-key"): boolean {
  let changed = false;
  for (const row of container.querySelectorAll<HTMLElement>(selector)) {
    const key = row.getAttribute(keyAttr);
    if (key !== null && cache.set(key, row.offsetHeight)) changed = true;
  }
  return changed;
}

export interface VirtualizerOptions {
  /** Número de filas. */
  count: number;
  /** Alto fijo, o la estimación para las filas que aún no se han medido (con `key`, se miden al pintarse). */
  size: number | ((index: number) => number);
  /** Clave estable de la fila: activa la medida de altos reales (filas de alto variable). */
  key?: (index: number) => string;
  /** Filas de más a cada lado. Por defecto 6. */
  overscan?: number;
  /** Índices que no salen del documento aunque no se vean (la fila con el foco). */
  keep?: () => ReadonlyArray<number>;
  /** Si se virtualiza; si no, `window()` devuelve todas las filas. */
  enabled?: boolean;
  /** Lo que ocupa el contenido anterior a la lista dentro del contenedor. */
  offset?: () => number;
  /** La ventana cambió: hay que volver a pintar. */
  onChange(win: ListWindow): void;
}

export interface Virtualizer {
  /** Ventana actual (índices a pintar y rellenos). */
  window(): ListWindow;
  /** Cambian las filas o las opciones: recalcula y avisa si la ventana cambia (o siempre, con `force`). */
  update(options: Partial<Omit<VirtualizerOptions, "onChange">>, force?: boolean): void;
  /** Tras pintar: mide las filas (`selector`, clave en `data-key`) y recalcula si alguna cambió de alto. */
  measure(container: ParentNode, selector: string, keyAttr?: string): void;
  /** Lleva el desplazamiento a la fila `index` (y recalcula la ventana para que se pinte). */
  scrollToIndex(index: number, align?: ScrollAlign): void;
  /** Alto (medido o estimado) de una fila. */
  sizeOf(index: number): number;
  /** Posiciones acumuladas (con alto variable; se recalculan solo si cambian las filas o una medida). */
  positions(): ReadonlyArray<number> | undefined;
  destroy(): void;
}

/** Ventana virtual sobre un contenedor que desplaza. La vía que pinta llama a `window()` y a `measure()` tras pintar. */
export function createVirtualizer(scroller: HTMLElement, options: VirtualizerOptions): Virtualizer {
  let o = { overscan: 6, enabled: true, ...options };
  const fixed = typeof o.size === "number";
  const cache = createSizeCache(typeof o.size === "number" ? o.size : (i) => (o.size as (i: number) => number)(i));
  let view: ViewportState = { scroll: 0, viewport: scroller.clientHeight || 600 };
  const sizeOf = (i: number) =>
    typeof o.size === "number" && !o.key ? o.size : o.key ? cache.size(i, o.key(i)) : (o.size as (i: number) => number)(i);
  const size = () => (fixed && !o.key ? (o.size as number) : sizeOf);
  // Con alto variable, las posiciones acumuladas se guardan: con 10 000 filas, recalcularlas en cada desplazamiento
  // era el coste principal. Se tiran al cambiar las filas, el alto estimado o una medida.
  let pos: number[] | null = null;
  const positions = () => {
    if (fixed && !o.key) return undefined;
    if (!pos || pos.length !== o.count + 1) pos = offsets(o.count, sizeOf);
    return pos;
  };
  const compute = () =>
    listWindow({
      virtual: o.enabled !== false,
      count: o.count,
      size: size(),
      positions: positions(),
      scroll: view.scroll,
      viewport: view.viewport,
      overscan: o.overscan,
      keep: o.keep?.(),
    });
  let current = compute();
  const refresh = (force = false) => {
    const next = compute();
    const changed = force || !sameWindow(next, current) || next.indices.join() !== current.indices.join();
    current = next;
    if (changed) o.onChange(next);
  };
  const stop = trackViewport(
    scroller,
    (state) => {
      view = state;
      refresh();
    },
    () => o.offset?.() ?? 0,
  );
  return {
    window: () => current,
    update(patch, force) {
      // Cada pintado puede traer otras filas (orden, filtro) con otros altos: las posiciones se recalculan una vez.
      pos = null;
      o = { ...o, ...patch };
      refresh(force);
    },
    measure(container, selector, keyAttr) {
      if (!o.key || o.enabled === false) return;
      if (measureRows(container, selector, cache, keyAttr)) {
        pos = null;
        refresh();
      }
    },
    positions,
    scrollToIndex(index, align = "nearest") {
      const offset = o.offset?.() ?? 0;
      const top = scrollForIndex(index, size(), o.count, view.scroll, view.viewport, align, positions());
      if (Math.abs(top - view.scroll) >= 1) scroller.scrollTop = top + offset;
      view = { scroll: Math.max(0, scroller.scrollTop - offset), viewport: scroller.clientHeight || view.viewport };
      refresh();
    },
    sizeOf,
    destroy: stop,
  };
}
