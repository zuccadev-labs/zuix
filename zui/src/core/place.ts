// Colocación de una capa junto a su ancla: lado y alineación pedidos, volteo al lado opuesto si no cabe,
// desplazamiento para no salir de la ventana y tamaño disponible. `computePlace` es aritmética pura;
// `place` la aplica a un elemento.
import { isRtl } from "./dir";

export type Side = "top" | "right" | "bottom" | "left";
export type Align = "start" | "center" | "end";
export type Placement = Side | `${Side}-start` | `${Side}-end`;

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PlaceInput {
  anchor: Box;
  /** Tamaño de la capa. */
  size: { width: number; height: number };
  viewport: { width: number; height: number };
  placement: Placement;
  /** Separación entre el ancla y la capa. */
  gap?: number;
  /** Margen mínimo con el borde de la ventana. */
  padding?: number;
  /** En RTL `start` es el borde derecho del ancla. */
  rtl?: boolean;
  /** Lado ya decidido: no se vuelve a voltear (segunda pasada, tras aplicar el tamaño disponible). */
  lockSide?: Side;
}

export interface PlaceResult {
  x: number;
  y: number;
  side: Side;
  align: Align;
  /** Hueco entre el ancla y el borde de la ventana en el lado elegido (y el ancho o alto útil en el otro eje). */
  availableWidth: number;
  availableHeight: number;
}

export const PLACE_PADDING = 8;

export function computePlace({
  anchor,
  size,
  viewport,
  placement,
  gap = 6,
  padding = PLACE_PADDING,
  rtl = false,
  lockSide,
}: PlaceInput): PlaceResult {
  const [wanted, align = "center"] = placement.split("-") as [Side, Align?];
  const { width, height } = size;
  const right = anchor.left + anchor.width;
  const bottom = anchor.top + anchor.height;
  let side = lockSide ?? wanted;
  // Voltea al lado opuesto si no cabe.
  if (!lockSide) {
    if (side === "bottom" && bottom + gap + height > viewport.height && anchor.top - gap - height >= 0) side = "top";
    else if (side === "top" && anchor.top - gap - height < 0) side = "bottom";
    else if (side === "right" && right + gap + width > viewport.width) side = "left";
    else if (side === "left" && anchor.left - gap - width < 0) side = "right";
  }
  const start = rtl ? "end" : "start";
  let x: number;
  let y: number;
  if (side === "top" || side === "bottom") {
    y = side === "bottom" ? bottom + gap : anchor.top - gap - height;
    x = align === "center" ? anchor.left + anchor.width / 2 - width / 2 : align === start ? anchor.left : right - width;
  } else {
    x = side === "right" ? right + gap : anchor.left - gap - width;
    y = align === "start" ? anchor.top : align === "end" ? bottom - height : anchor.top + anchor.height / 2 - height / 2;
  }
  const room = {
    top: anchor.top - gap,
    bottom: viewport.height - bottom - gap,
    left: anchor.left - gap,
    right: viewport.width - right - gap,
  };
  const vertical = side === "top" || side === "bottom";
  return {
    x: Math.round(Math.min(Math.max(padding, x), Math.max(padding, viewport.width - width - padding))),
    y: Math.round(Math.min(Math.max(padding, y), Math.max(padding, viewport.height - height - padding))),
    side,
    align,
    availableWidth: Math.max(0, Math.floor((vertical ? viewport.width - padding : room[side]) - padding)),
    availableHeight: Math.max(0, Math.floor((vertical ? room[side] : viewport.height - padding) - padding)),
  };
}

/**
 * Coloca `el` (posición fija) junto a `rect`. Escribe `left`/`top`, `data-side`, `data-align` y las variables
 * `--z-available-width`/`--z-available-height` (hueco hasta el borde de la ventana), que el CSS usa como tope
 * de tamaño. Si ese tope cambia el tamaño de la capa, se recoloca con el tamaño nuevo sin volver a voltear.
 */
export function place(el: HTMLElement, rect: Box, placement: Placement, gap = 6): PlaceResult {
  const root = el.ownerDocument.documentElement;
  const viewport = { width: root.clientWidth, height: root.clientHeight };
  const rtl = isRtl(el);
  const measure = () => {
    const box = el.getBoundingClientRect();
    return { width: box.width, height: box.height };
  };
  const apply = (result: PlaceResult) => {
    el.style.setProperty("--z-available-width", `${result.availableWidth}px`);
    el.style.setProperty("--z-available-height", `${result.availableHeight}px`);
  };
  const input = { anchor: rect, viewport, placement, gap, rtl };
  // El lado se decide con el tamaño natural, sin el tope de la colocación anterior.
  el.style.removeProperty("--z-available-width");
  el.style.removeProperty("--z-available-height");
  const size = measure();
  let result = computePlace({ ...input, size });
  apply(result);
  const fitted = measure();
  if (fitted.width !== size.width || fitted.height !== size.height) {
    result = computePlace({ ...input, size: fitted, lockSide: result.side });
    apply(result);
  }
  el.style.left = `${result.x}px`;
  el.style.top = `${result.y}px`;
  el.dataset.side = result.side;
  el.dataset.align = result.align;
  return result;
}

/**
 * Ancla de un submenú: el borde del menú padre a la altura de la entrada que lo abre, con `inset` (relleno y borde
 * del submenú) para que su primera entrada quede alineada con ella.
 */
export function submenuAnchor(menu: Box, item: Box, inset: number): Box {
  return { left: menu.left, top: item.top - inset, width: menu.width, height: item.height + inset * 2 };
}

/** Relleno más borde superior de un elemento: lo que separa su primera entrada de su borde. */
export function topInset(el: Element): number {
  const style = getComputedStyle(el);
  return (parseFloat(style.paddingTop) || 0) + (parseFloat(style.borderTopWidth) || 0);
}
