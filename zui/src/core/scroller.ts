// Desplazador del que depende un elemento (el ancestro que desplaza en vertical o el documento) y las medidas que
// comparten las piezas de página: TableOfContents, BackToTop y Affix. Solo toca el documento al llamarse.

/** Ancestro que desplaza en vertical, o `null` si es el documento. */
export function scrollerOf(el: Element | null): HTMLElement | null {
  const doc = el?.ownerDocument;
  for (let p = el?.parentElement ?? null; p && p !== doc?.body && p !== doc?.documentElement; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === "auto" || o === "scroll" || o === "overlay") && p.scrollHeight > p.clientHeight + 1) return p;
  }
  return null;
}

/** Elemento por id, o el propio elemento; `null` si no existe. */
export function resolveElement(doc: Document, target: string | Element | null | undefined): HTMLElement | null {
  if (!target) return null;
  if (typeof target !== "string") return target as HTMLElement;
  return doc.getElementById(target.startsWith("#") ? target.slice(1) : target);
}

export interface ScrollMetrics {
  top: number;
  /** Alto visible del desplazador. */
  height: number;
  /** Alto total de su contenido. */
  total: number;
  /** Borde superior del área visible, en coordenadas de la ventana. */
  viewTop: number;
}

/** Medidas del desplazador (`null`: el documento). */
export function scrollMetrics(scroller: HTMLElement | null, doc: Document): ScrollMetrics {
  if (scroller) {
    return {
      top: scroller.scrollTop,
      height: scroller.clientHeight,
      total: scroller.scrollHeight,
      viewTop: scroller.getBoundingClientRect().top,
    };
  }
  const view = doc.defaultView;
  const root = doc.scrollingElement ?? doc.documentElement;
  return { top: view?.scrollY ?? root.scrollTop, height: view?.innerHeight ?? root.clientHeight, total: root.scrollHeight, viewTop: 0 };
}

/** Lo que escucha `scroll` para un desplazador (la ventana si es el documento). */
export const scrollEventTarget = (scroller: HTMLElement | null, doc: Document): EventTarget => scroller ?? doc.defaultView ?? doc;

/** Desplaza hasta `top` (px desde el principio del contenido). */
export function scrollToPosition(scroller: HTMLElement | null, doc: Document, top: number, behavior: ScrollBehavior): void {
  const target = scroller ?? doc.defaultView;
  target?.scrollTo?.({ top: Math.max(0, top), behavior });
}

/** Lleva el foco a un elemento sin desplazar; si no es enfocable, lo hace enfocable por programa (`tabindex="-1"`). */
export function focusTarget(el: HTMLElement | null): void {
  if (!el) return;
  if (!el.matches("a[href], button, input, select, textarea, [tabindex]")) el.setAttribute("tabindex", "-1");
  el.focus({ preventScroll: true });
}
