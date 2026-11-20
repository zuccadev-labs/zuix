// Colocación con CSS anchor positioning como mejora progresiva. Donde el navegador la tiene (`position-area` y
// `anchor-name`), la capa se ancla con CSS: la sigue el compositor al desplazar, sin recalcular en cada evento, y se
// voltea sola con `position-try-fallbacks`. Donde no, se usa la colocación de ./place (el respaldo de siempre).
// En los dos casos se escriben `data-side` y `--z-arrow-offset`, que dibujan la flecha.
import { isRtl } from "./dir";
import { arrowOffset, type Box, type Placement, type Side } from "./place";

/** Verdadero si el navegador coloca capas con CSS anchor positioning. */
export function supportsAnchor(): boolean {
  return (
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("position-area: bottom") &&
    CSS.supports("anchor-name: --a")
  );
}

/**
 * Área de `position-area` para una colocación. El lado es físico, como en ./place; la alineación `start`/`end` sigue
 * la dirección de escritura en el eje horizontal (`x-start`) y va de arriba abajo en el vertical.
 */
export function positionArea(placement: Placement): string {
  const [side, align] = placement.split("-") as [Side, "start" | "end" | undefined];
  if (side === "top" || side === "bottom") return align ? `${side} span-x-${align === "start" ? "end" : "start"}` : side;
  return align ? `${side} ${align === "start" ? "span-bottom" : "span-top"}` : side;
}

/** Lado del ancla en el que quedó la capa, medido (tras los volteos de `position-try-fallbacks`). */
export function sideOf(anchor: Box, popup: Box): Side {
  if (popup.top >= anchor.top + anchor.height - 1) return "bottom";
  if (popup.top + popup.height <= anchor.top + 1) return "top";
  if (popup.left >= anchor.left + anchor.width - 1) return "right";
  return "left";
}

const MARGIN: Record<Side, string> = { bottom: "margin-top", top: "margin-bottom", right: "margin-left", left: "margin-right" };
let serial = 0;

/**
 * Verdadero si la capa quedó pegada al ancla: en el lado medido, a no más de `gap` + 4 px, y solapando al ancla en el
 * otro eje. Un motor con un fallo de anclaje (capa lejos del ancla) no lo cumple y se vuelve a ./place.
 */
export function adjacent(anchor: Box, popup: Box, side: Side, gap: number): boolean {
  const slack = gap + 4;
  const overlapX = popup.left < anchor.left + anchor.width + 1 && popup.left + popup.width > anchor.left - 1;
  const overlapY = popup.top < anchor.top + anchor.height + 1 && popup.top + popup.height > anchor.top - 1;
  if (side === "bottom") return overlapX && Math.abs(popup.top - (anchor.top + anchor.height)) <= slack;
  if (side === "top") return overlapX && Math.abs(anchor.top - (popup.top + popup.height)) <= slack;
  if (side === "right") return overlapY && Math.abs(popup.left - (anchor.left + anchor.width)) <= slack;
  return overlapY && Math.abs(anchor.left - (popup.left + popup.width)) <= slack;
}

export interface CssAnchoring {
  /**
   * Mide dónde quedó la capa y escribe `data-side` y `--z-arrow-offset`. Llamarla tras abrir y al desplazar.
   * Devuelve false si la capa no quedó junto al ancla (el llamador vuelve entonces a colocar con `place()`).
   */
  measure(): boolean;
  /** Retira el ancla y los estilos de colocación. */
  release(): void;
}

/**
 * Ancla `el` (un `[popover]` ya abierto) a `anchor` con CSS. Devuelve null si el navegador no lo admite: el llamador
 * coloca entonces con `place()`. `gap` es la separación con el ancla; se escribe como margen del lado que la mira
 * (los volteos lo reflejan solos).
 */
export function anchorWithCss(el: HTMLElement, anchor: Element, placement: Placement, gap: number): CssAnchoring | null {
  if (!supportsAnchor() || !(anchor instanceof HTMLElement || anchor instanceof SVGElement)) return null;
  serial += 1;
  const name = `--z-anchor-${serial}`;
  const style = (anchor as HTMLElement).style;
  const previous = style.getPropertyValue("anchor-name");
  style.setProperty("anchor-name", previous && previous !== "none" ? `${previous}, ${name}` : name);
  const side = placement.split("-")[0] as Side;
  el.dataset.anchored = "";
  el.style.setProperty("position-anchor", name);
  el.style.setProperty("position-area", positionArea(placement));
  el.style.setProperty("position-try-fallbacks", "flip-block, flip-inline, flip-block flip-inline");
  el.style.setProperty("inset", "auto");
  el.style.setProperty("margin", "0");
  el.style.setProperty(MARGIN[side], `${gap}px`);
  el.style.removeProperty("left");
  el.style.removeProperty("top");
  return {
    measure() {
      if (!el.isConnected || !anchor.isConnected) return true;
      const a = anchor.getBoundingClientRect();
      const p = el.getBoundingClientRect();
      const measured = sideOf(a, p);
      el.dataset.side = measured;
      el.style.setProperty("--z-arrow-offset", `${arrowOffset(a, p, measured, { rtl: isRtl(el) })}px`);
      return adjacent(a, p, measured, gap);
    },
    release() {
      const names = style
        .getPropertyValue("anchor-name")
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part && part !== name);
      if (names.length) style.setProperty("anchor-name", names.join(", "));
      else style.removeProperty("anchor-name");
      delete el.dataset.anchored;
      for (const prop of ["position-anchor", "position-area", "position-try-fallbacks", "inset", "margin", ...Object.values(MARGIN)])
        el.style.removeProperty(prop);
    },
  };
}

/**
 * Vuelve a comprobar el anclaje en cada cuadro durante `ms` tras abrir: algún motor aplica el desplazamiento de la
 * página al anclaje con retraso y la capa salta lejos del ancla. `check` mide (y, si falla, vuelve a ./place).
 * Devuelve la función que cancela la vigilancia.
 */
export function settleAnchoring(check: () => void, ms = 400): () => void {
  if (typeof requestAnimationFrame !== "function") return () => {};
  const until = performance.now() + ms;
  let frame = 0;
  const tick = () => {
    check();
    if (performance.now() < until) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}
