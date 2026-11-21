// Copia de zui/src/core/edges.ts (zout no importa el núcleo interno de zui).
// Bordes de una tira con desplazamiento horizontal (pestañas, listas en fila): marca en `data-scroll-edges` qué lado
// tiene contenido oculto ("start", "end" o los dos) para que la hoja difumine solo ese borde. Lógica pura más un
// observador sin efectos al importar; lo usan el binding de React y el modo DOM.

const EDGE_SLACK = 8;

/** Lados con contenido oculto. `scrollStart` es la distancia desplazada desde el inicio (positiva también en RTL). */
export function scrollEdges(scrollStart: number, scrollSize: number, viewSize: number): string {
  // Menos de 8 px por esconder es holgura (el hueco final de la fila, un contorno), no contenido oculto.
  const hidden = scrollSize - viewSize;
  if (hidden <= EDGE_SLACK) return "";
  const start = scrollStart > EDGE_SLACK;
  const end = scrollStart < hidden - EDGE_SLACK;
  return [start ? "start" : "", end ? "end" : ""].filter(Boolean).join(" ");
}

/** Mantiene `data-scroll-edges` al día al desplazar y al cambiar de tamaño. Devuelve la función que deja de vigilar. */
export function trackScrollEdges(el: HTMLElement): () => void {
  const update = () => {
    const value = scrollEdges(Math.abs(el.scrollLeft), el.scrollWidth, el.clientWidth);
    if (value) el.setAttribute("data-scroll-edges", value);
    else el.removeAttribute("data-scroll-edges");
  };
  update();
  el.addEventListener("scroll", update, { passive: true });
  const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
  ro?.observe(el);
  // El contenido cambia de ancho (carga de la fuente, un título nuevo) sin que cambie el de la tira.
  for (const child of el.children) ro?.observe(child);
  // Los hijos cambian (se añade o se cierra una pestaña) sin que cambie el tamaño de la tira.
  const mo = typeof MutationObserver === "undefined" ? null : new MutationObserver(update);
  mo?.observe(el, { childList: true });
  return () => {
    el.removeEventListener("scroll", update);
    ro?.disconnect();
    mo?.disconnect();
  };
}

/** Ancho del difuminado de una tira que desplaza (`--z-space-6`), o 0 si no desborda. */
export function edgeMargin(list: HTMLElement): number {
  if (list.scrollWidth <= list.clientWidth + 1) return 0;
  return Number.parseFloat(getComputedStyle(list).getPropertyValue("--z-space-6")) || 24;
}
