// Affix: fija su contenido al desplazar con `position: sticky` (la hoja de estilos hace todo el trabajo). Aquí solo se
// sabe cuándo está pegado, para la sombra y para avisar a la aplicación: un IntersectionObserver con el margen
// recortado 1 px más allá del desplazamiento; al pegarse, la pieza deja de caber entera. Sin observador no hay
// `data-stuck`, pero sigue fijándose. Solo toca el documento al llamarse.
import { scrollerOf } from "./scroller";

export type AffixSide = "top" | "bottom";

/**
 * ¿Pegado? `root` es el área del observador ya recortada (el desplazamiento más 1 px): pegada arriba, la pieza
 * asoma por encima de ese borde; abajo, por debajo. `ratio` es la parte que cabe dentro del área.
 */
export function isStuck(side: AffixSide, ratio: number, rect: { top: number; bottom: number }, root: { top: number; bottom: number }): boolean {
  if (!(ratio < 1)) return false;
  return side === "top" ? rect.top < root.top && rect.bottom > root.top : rect.bottom > root.bottom && rect.top < root.bottom;
}

/** Conecta un `.z-affix` (lado en `data-side`, distancia en `--z-affix-offset`). */
export function attachAffix(el: HTMLElement, onChange?: (stuck: boolean) => void): () => void {
  const View = el.ownerDocument.defaultView?.IntersectionObserver;
  if (!View) return () => {};
  const side: AffixSide = el.dataset.side === "bottom" ? "bottom" : "top";
  // La distancia es la de la hoja (`--z-affix-offset` → `inset-block-start` o `-end`): no se repite en un atributo.
  const offset = Math.max(0, Number.parseFloat(getComputedStyle(el)[side]) || 0);
  const root = scrollerOf(el);
  // Pegado, el borde queda a `offset` del borde de contenido del desplazador (su relleno cuenta); el área del observador
  // empieza en el borde de relleno: se recorta también el relleno de ese lado.
  const pad = root ? Number.parseFloat(getComputedStyle(root)[side === "top" ? "paddingTop" : "paddingBottom"]) || 0 : 0;
  const margin = `${-(offset + pad + 1)}px`;
  const observer = new View(
    ([entry]) => {
      if (!entry) return;
      const box = entry.rootBounds ?? { top: 0, bottom: el.ownerDocument.defaultView?.innerHeight ?? 0 };
      const stuck = isStuck(side, entry.intersectionRatio, entry.boundingClientRect, box);
      if (stuck === el.hasAttribute("data-stuck")) return;
      el.toggleAttribute("data-stuck", stuck);
      onChange?.(stuck);
    },
    { root, rootMargin: side === "top" ? `${margin} 0px 0px 0px` : `0px 0px ${margin} 0px`, threshold: [1] },
  );
  observer.observe(el);
  return () => observer.disconnect();
}
