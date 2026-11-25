// Capas de selección y de paso del puntero sobre el lienzo. Viven fuera del contenedor del documento (en la capa
// superior, con `popover="manual"` si el navegador lo admite), son inertes y no reciben el puntero: el documento
// pintado no cambia ni lleva marcas del editor salvo `data-z-node`. Estilos en src/styles/editor.css.

import type { Rect } from "./protocol";

export type OverlayKind = "select" | "hover";

export interface Overlay {
  /** Marca un elemento (o quita la marca con `null`) con una etiqueta (el tipo del bloque). */
  show(kind: OverlayKind, el: Element | null, label?: string): void;
  /** Recoloca las marcas (tras pintar, desplazar o cambiar de tamaño). */
  refresh(): void;
  destroy(): void;
}

export const rectOf = (el: Element): Rect => {
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
};

export function createOverlay(doc: Document = document): Overlay {
  const root = doc.createElement("div");
  root.className = "z-editor-overlay";
  root.setAttribute("aria-hidden", "true");
  root.inert = true;
  // Las cajas se colocan con coordenadas de la ventana (izquierda a derecha) aunque la página sea RTL.
  root.dir = "ltr";
  const supportsPopover = typeof (root as HTMLElement & { showPopover?: unknown }).showPopover === "function";
  if (supportsPopover) root.setAttribute("popover", "manual");
  const boxes: Record<OverlayKind, { box: HTMLElement; label: HTMLElement; target: Element | null }> = {
    select: part("select"),
    hover: part("hover"),
  };
  function part(kind: OverlayKind) {
    const box = doc.createElement("div");
    box.className = "z-editor-overlay__box";
    box.dataset.kind = kind;
    box.hidden = true;
    const label = doc.createElement("span");
    label.className = "z-editor-overlay__label";
    box.append(label);
    root.append(box);
    return { box, label, target: null as Element | null };
  }
  doc.body.append(root);
  if (supportsPopover) root.showPopover();

  let frame = 0;
  const place = () => {
    frame = 0;
    for (const p of Object.values(boxes)) {
      const t = p.target;
      if (!t?.isConnected) {
        p.box.hidden = true;
        continue;
      }
      const r = t.getBoundingClientRect();
      p.box.hidden = false;
      p.box.style.translate = `${r.x}px ${r.y}px`;
      p.box.style.width = `${r.width}px`;
      p.box.style.height = `${r.height}px`;
    }
  };
  const schedule = () => {
    if (!frame) frame = doc.defaultView?.requestAnimationFrame(place) ?? 0;
  };
  const view = doc.defaultView;
  view?.addEventListener("scroll", schedule, { capture: true, passive: true });
  view?.addEventListener("resize", schedule, { passive: true });
  const resize = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;

  return {
    show(kind, el, label = "") {
      const p = boxes[kind];
      if (p.target && resize) resize.unobserve(p.target);
      p.target = el;
      p.label.textContent = label;
      if (el && resize) resize.observe(el);
      place();
    },
    refresh: schedule,
    destroy() {
      if (frame) view?.cancelAnimationFrame(frame);
      view?.removeEventListener("scroll", schedule, { capture: true });
      view?.removeEventListener("resize", schedule);
      resize?.disconnect();
      root.remove();
    },
  };
}
