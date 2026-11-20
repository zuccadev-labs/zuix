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

/** Lado físico del panel donde va el tirador. */
export type PhysicalSide = "left" | "right" | "top" | "bottom";
/** `start` y `end` son los bordes lógicos en el eje de la escritura: en RTL, `start` es el derecho. */
export type ResizeSide = PhysicalSide | "start" | "end";

/** Lado físico de un lado lógico según la dirección de escritura. */
export function physicalSide(side: ResizeSide, rtl: boolean): PhysicalSide {
  if (side === "start") return rtl ? "right" : "left";
  if (side === "end") return rtl ? "left" : "right";
  return side;
}

export const RESIZE_MIN = 200;
export const RESIZE_MAX = 720;
export const RESIZE_STEP = 16;

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const isHorizontal = (side: ResizeSide) => side !== "top" && side !== "bottom";

/** Un tirador en el borde derecho o inferior crece al avanzar; en el izquierdo o superior, al retroceder. */
export const resizeSign = (side: PhysicalSide) => (side === "right" || side === "bottom" ? 1 : -1);

/**
 * Tamaño tras una tecla, o `undefined` si la tecla no mueve el tirador. Las flechas son físicas (patrón
 * «window splitter» de WAI-ARIA): la flecha mueve el tirador hacia donde apunta. Inicio vuelve al tamaño por defecto.
 */
export function resizeByKey(
  key: string,
  side: PhysicalSide,
  size: number,
  opts: { min: number; max: number; step: number; defaultSize?: number },
): number | undefined {
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

/**
 * Fracción que pide una tecla en un divisor, o 0 si la tecla no lo mueve. Las flechas mueven el divisor hacia
 * donde apuntan: en una fila RTL el primer panel está a la derecha, así que la flecha derecha lo encoge.
 * Inicio y Fin llevan el divisor a su mínimo y a su máximo (±Infinity; `moveDivider` lo acota).
 */
export function dividerKeyDelta(key: string, direction: "row" | "column", rtl = false): number {
  const sign = direction === "row" && rtl ? -1 : 1;
  const fwd = direction === "row" ? "ArrowRight" : "ArrowDown";
  const back = direction === "row" ? "ArrowLeft" : "ArrowUp";
  if (key === "Home") return -Infinity;
  if (key === "End") return Infinity;
  return key === fwd ? sign * SPLIT_KEY_STEP : key === back ? -sign * SPLIT_KEY_STEP : 0;
}

/* ---------- TabStrip ---------- */

/**
 * Índice de la pestaña a la que lleva una tecla desde `current`, o -1 si la tecla no navega. En RTL la tira
 * se dibuja de derecha a izquierda, así que la flecha izquierda avanza.
 */
export function tabKeyIndex(key: string, current: number, count: number, rtl = false): number {
  if (count === 0) return -1;
  if (key === (rtl ? "ArrowLeft" : "ArrowRight")) return (current + 1) % count;
  if (key === (rtl ? "ArrowRight" : "ArrowLeft")) return (current - 1 + count) % count;
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

/* ---------- TabStrip: grupos y reordenación ---------- */

/** Lista con el elemento `from` llevado a la posición final `to` (índices acotados). Sin cambios, la misma lista. */
export function reorder<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (from < 0 || from >= list.length) return next;
  const target = clamp(to, 0, list.length - 1);
  if (target === from) return next;
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item as T);
  return next;
}

/** Tramo de una pestaña en el eje de la tira, en coordenadas de la ventana. */
export interface Span {
  start: number;
  end: number;
}

/**
 * Hueco donde caería lo arrastrado: índice de inserción (0…n) según el punto `at` frente a la mitad de cada pestaña.
 * `spans` va en orden del documento; en RTL la tira se dibuja de derecha a izquierda (la primera, a la derecha).
 */
export function dropIndex(at: number, spans: readonly Span[], rtl = false): number {
  let index = 0;
  for (const span of spans) {
    const middle = (span.start + span.end) / 2;
    if (rtl ? at < middle : at > middle) index += 1;
  }
  return index;
}

/** Posición final de un elemento que estaba en `from` y se suelta en el hueco `gap` (índice de inserción). */
export const finalIndex = (from: number, gap: number) => (gap > from ? gap - 1 : gap);

/**
 * Posición a la que lleva una tecla de mover pestaña (Ctrl+Mayús+flecha, o Inicio/Fin con Ctrl+Mayús) desde
 * `current`, o -1 si la tecla no mueve o ya está en el extremo. En RTL la flecha izquierda avanza.
 */
export function tabMoveIndex(key: string, current: number, count: number, rtl = false): number {
  let next = -1;
  if (key === (rtl ? "ArrowLeft" : "ArrowRight")) next = current + 1;
  else if (key === (rtl ? "ArrowRight" : "ArrowLeft")) next = current - 1;
  else if (key === "Home") next = 0;
  else if (key === "End") next = count - 1;
  return next < 0 || next >= count || next === current ? -1 : next;
}

/** Lista de ids con `id` movido delante de `before` (al final si es null). Sin `id` en la lista, la misma lista. */
export function moveBefore(ids: readonly string[], id: string, before: string | null): string[] {
  if (!ids.includes(id) || id === before) return [...ids];
  const rest = ids.filter((x) => x !== id);
  const at = before === null ? -1 : rest.indexOf(before);
  if (at < 0) rest.push(id);
  else rest.splice(at, 0, id);
  return rest;
}

/**
 * Hueco de inserción (índice de `visible`) para mover `id` a la posición `to` de la lista visible: devuelve el id
 * delante del que se coloca (null = al final).
 */
export function beforeFor(visible: readonly string[], id: string, to: number): string | null {
  const rest = visible.filter((x) => x !== id);
  return rest[to] ?? null;
}
