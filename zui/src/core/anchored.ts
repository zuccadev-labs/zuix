// Capa anclada para las piezas de árbol (core/widget) que abren una lista o un panel: Cascader, TreeSelect y
// QuarterPicker. El panel es un `[popover="manual"]` del propio árbol (capa superior del navegador, sin z-index), se
// coloca con ./place junto a su ancla, la sigue al desplazar y entra en la pila de ./layers: Escape, pulsación fuera y
// foco fuera lo cierran igual que en Select o Combobox. La misma función la llaman el binding de React y el modo DOM.
// Sin documento al importar: solo toca los elementos que recibe.
import { pushLayer } from "./layers";
import { place, type Placement } from "./place";
import { popoverOpen, showPopover } from "./popover";

export interface AnchoredOptions {
  placement?: Placement;
  gap?: number;
  /** Escribe `--z-anchor-width` con el ancho del ancla (ancho mínimo de una lista). */
  matchWidth?: boolean;
  /** Petición de cierre: Escape, pulsación fuera o foco fuera del ancla y del panel. */
  onDismiss: (reason: "escape" | "outside") => void;
}

export interface Anchored {
  /** Vuelve a colocar (tras pintar, si el contenido cambió de tamaño). */
  reposition(): void;
  /** Cierra la capa y retira los listeners. */
  close(): void;
}

/** Abre `popup` junto a `anchor`. */
export function openAnchored(popup: HTMLElement, anchor: HTMLElement, options: AnchoredOptions): Anchored {
  const { placement = "bottom-start", gap = 4, matchWidth = true } = options;
  const position = () => {
    if (!popup.isConnected || !anchor.isConnected) return;
    const rect = anchor.getBoundingClientRect();
    if (matchWidth) popup.style.setProperty("--z-anchor-width", `${rect.width}px`);
    place(popup, rect, placement, gap);
  };
  if (!popoverOpen(popup)) showPopover(popup);
  popup.dataset.state = "open";
  position();
  const wiring = new AbortController();
  const follow = (event: Event) => {
    // Desplazar dentro del panel (una columna larga) no lo mueve.
    if (event.target instanceof Node && popup.contains(event.target)) return;
    position();
  };
  const doc = popup.ownerDocument;
  doc.addEventListener("scroll", follow, { capture: true, passive: true, signal: wiring.signal });
  doc.defaultView?.addEventListener("resize", follow, { signal: wiring.signal });
  let frame = 0;
  const observer =
    typeof ResizeObserver === "function"
      ? new ResizeObserver(() => {
          if (frame) return;
          frame = requestAnimationFrame(() => {
            frame = 0;
            position();
          });
        })
      : undefined;
  observer?.observe(anchor);
  const release = pushLayer(
    {
      contains: (target) => popup.contains(target) || anchor.contains(target),
      onEscape: () => options.onDismiss("escape"),
      onPointerOutside: () => options.onDismiss("outside"),
      onFocusOutside: () => options.onDismiss("outside"),
    },
    doc,
  );
  let closed = false;
  return {
    reposition: position,
    close() {
      if (closed) return;
      closed = true;
      wiring.abort();
      observer?.disconnect();
      cancelAnimationFrame(frame);
      release();
      popup.dataset.state = "closed";
      if (popoverOpen(popup) && typeof popup.hidePopover === "function") popup.hidePopover();
    },
  };
}
