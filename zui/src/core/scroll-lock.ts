// Bloqueo del desplazamiento de la página mientras hay un diálogo modal abierto. Cuenta usos: varios diálogos
// anidados comparten un único bloqueo. Compensa el ancho de la barra para que la página no salte.

let locks = 0;
let restore: (() => void) | undefined;

/** Bloquea el desplazamiento del documento. Devuelve la función que lo libera (idempotente). */
export function lockScroll(doc: Document = document): () => void {
  if (locks++ === 0) {
    const root = doc.documentElement;
    const before = { overflow: root.style.overflow, gutter: root.style.scrollbarGutter, padding: root.style.paddingInlineEnd };
    const bar = (doc.defaultView?.innerWidth ?? root.clientWidth) - root.clientWidth;
    // Con `scrollbar-gutter: stable` el navegador ya reserva el hueco; si no, se rellena lo que ocupaba la barra.
    if (bar > 0 && !getComputedStyle(root).scrollbarGutter?.includes("stable")) {
      root.style.paddingInlineEnd = `${(parseFloat(getComputedStyle(root).paddingInlineEnd) || 0) + bar}px`;
    }
    root.style.overflow = "hidden";
    restore = () => {
      root.style.overflow = before.overflow;
      root.style.scrollbarGutter = before.gutter;
      root.style.paddingInlineEnd = before.padding;
    };
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--locks === 0) {
      restore?.();
      restore = undefined;
    }
  };
}
