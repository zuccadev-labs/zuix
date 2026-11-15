// Lógica pura de los layouts, sin React ni DOM. La comparten el binding de React (layouts/*.tsx) y
// @zuccadev-labs/zuix-zout/dom, para que los dos lados calculen lo mismo.

/* ---------- Shell ---------- */

export type PanelMode = "docked" | "overlay";

/** Anchos del shell (px) bajo los cuales un panel en modo `auto` pasa a cajón. */
export const SIDEBAR_BREAKPOINT = 880;
export const INSPECTOR_BREAKPOINT = 1180;

/**
 * Modo que corresponde a un panel, esté abierto o no. `width` es el ancho medido del shell (`null` sin medir:
 * todo acoplado); `mode` es la preferencia del panel (`auto` o sin valor: decide el ancho).
 */
export function panelMode(width: number | null, breakpoint: number, mode?: PanelMode | "auto" | null): PanelMode {
  if (mode && mode !== "auto") return mode;
  return width !== null && width < breakpoint ? "overlay" : "docked";
}

/* ---------- ResizeHandle ---------- */

export type ResizeSide = "left" | "right" | "top" | "bottom";

export const RESIZE_MIN = 200;
export const RESIZE_MAX = 720;
export const RESIZE_STEP = 16;

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const isHorizontal = (side: ResizeSide) => side === "left" || side === "right";

/** Un tirador en el borde derecho o inferior crece al avanzar; en el izquierdo o superior, al retroceder. */
export const resizeSign = (side: ResizeSide) => (side === "right" || side === "bottom" ? 1 : -1);

/** Tamaño tras una tecla, o `undefined` si la tecla no mueve el tirador. */
export function resizeByKey(key: string, side: ResizeSide, size: number, opts: { min: number; max: number; step: number; defaultSize?: number }): number | undefined {
  const sign = resizeSign(side);
  const grow = isHorizontal(side) ? (sign === 1 ? "ArrowRight" : "ArrowLeft") : sign === 1 ? "ArrowDown" : "ArrowUp";
  const shrink = isHorizontal(side) ? (sign === 1 ? "ArrowLeft" : "ArrowRight") : sign === 1 ? "ArrowUp" : "ArrowDown";
  if (key === grow) return clamp(size + opts.step, opts.min, opts.max);
  if (key === shrink) return clamp(size - opts.step, opts.min, opts.max);
  if (key === "Home" && opts.defaultSize !== undefined) return clamp(opts.defaultSize, opts.min, opts.max);
  return undefined;
}

/* ---------- SplitPane ---------- */

export const SPLIT_MIN_FRACTION = 0.1;
/** Fracción que mueve cada flecha del teclado. */
export const SPLIT_KEY_STEP = 0.02;

export const evenFractions = (n: number) => Array.from({ length: n }, () => 1 / n);

/**
 * Mueve el divisor `index` (entre los paneles index e index+1) una fracción `delta`, partiendo de los tamaños
 * `a` y `b` que tenían esos dos paneles. Devuelve el reparto nuevo; el par conserva su suma.
 */
export function moveDivider(fractions: number[], index: number, a: number, b: number, delta: number, minFraction: number): number[] {
  const pair = a + b;
  const na = Math.max(minFraction, Math.min(pair - minFraction, a + delta));
  const next = [...fractions];
  next[index] = na;
  next[index + 1] = pair - na;
  return next;
}

/** Fracción que pide una tecla en un divisor, o 0 si la tecla no lo mueve. */
export function dividerKeyDelta(key: string, direction: "row" | "column"): number {
  const fwd = direction === "row" ? "ArrowRight" : "ArrowDown";
  const back = direction === "row" ? "ArrowLeft" : "ArrowUp";
  return key === fwd ? SPLIT_KEY_STEP : key === back ? -SPLIT_KEY_STEP : 0;
}

/* ---------- TabStrip ---------- */

/** Índice de la pestaña a la que lleva una tecla desde `current`, o -1 si la tecla no navega. */
export function tabKeyIndex(key: string, current: number, count: number): number {
  if (count === 0) return -1;
  if (key === "ArrowRight") return (current + 1) % count;
  if (key === "ArrowLeft") return (current - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return -1;
}

/** Desplazamiento horizontal que deja a la vista una pestaña (`tab`) dentro de la tira (`list`); 0 si ya se ve. */
export function revealOffset(tab: { left: number; right: number }, list: { left: number; right: number }): number {
  if (tab.left < list.left) return tab.left - list.left;
  if (tab.right > list.right) return tab.right - list.right;
  return 0;
}
