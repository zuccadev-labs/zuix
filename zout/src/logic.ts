// Lógica pura de los layouts, sin React ni DOM. La comparten el binding de React (layouts/*.tsx) y
// @zuccadev-labs/zuix-zout/dom, para que los dos lados calculen lo mismo.

import { SIZE_CLASS_NAMES, resolveAdaptive, sizeClassFor, type AdaptiveMap, type SizeClass } from "./adaptive";

/* ---------- Shell ---------- */

export type PanelMode = "docked" | "overlay";

/** Anchos del shell (px) bajo los cuales un panel en modo `auto` pasa a cajón. */
export const SIDEBAR_BREAKPOINT = 880;
export const INSPECTOR_BREAKPOINT = 1180;
/** Ancho del shell (px) bajo el cual el rail deja de ocupar una columna y pasa al cajón de la sidebar. */
export const RAIL_BREAKPOINT = 600;

/**
 * Modo que corresponde a un panel, esté abierto o no. `width` es el ancho medido del shell (`null` sin medir:
 * todo acoplado); `mode` es la preferencia del panel (`auto` o sin valor: decide el ancho).
 */
export function panelMode(width: number | null, breakpoint: number, mode?: PanelMode | "auto" | null): PanelMode {
  if (mode && mode !== "auto") return mode;
  return width !== null && width < breakpoint ? "overlay" : "docked";
}

/**
 * Si el rail va dentro del cajón de la sidebar. En un teléfono una columna de iconos fija se come una quinta parte
 * del ancho; la navegación ya está en la sidebar, que ahí es un cajón, y el rail entra en él. Hace falta medir
 * (`width`), que haya sidebar y que esta sea un cajón.
 */
export function railInDrawer(width: number | null, breakpoint: number, sidebar: PanelMode | null): boolean {
  return width !== null && width < breakpoint && sidebar === "overlay";
}

/** Variante de un panel del Shell en una clase de tamaño (`adaptive: { compact: { variant: "drawer" } }`). */
export type ShellPanelVariant = "docked" | "drawer" | "rail";

export interface AdaptivePanelState {
  mode: PanelMode;
  /** Acoplado y plegado a iconos: la Sidebar que lleva dentro se pliega sola. */
  rail: boolean;
  /** Oculto en esta clase: ni acoplado ni cajón. */
  hidden: boolean;
}

const panelVariant = (variant: string | undefined): ShellPanelVariant =>
  variant === "drawer" || variant === "overlay" ? "drawer" : variant === "rail" ? "rail" : "docked";

/**
 * Estado de un panel del Shell con ajustes por clase, a partir del ancho medido del shell. Sin medir (`null`, el HTML
 * del servidor) queda acoplado: la hoja oculta o estrecha el panel con consultas de contenedor hasta que se mide.
 */
export function adaptivePanel(width: number | null, adaptive: AdaptiveMap): AdaptivePanelState {
  if (width === null) return { mode: "docked", rail: false, hidden: false };
  const s = resolveAdaptive(adaptive, sizeClassFor(width));
  const variant = panelVariant(s.variant);
  return { mode: variant === "drawer" ? "overlay" : "docked", rail: variant === "rail", hidden: s.hidden === true };
}

/**
 * Clases en que un panel adaptativo es cajón, rail u oculto, separadas por espacios (atributos `data-drawer-in`,
 * `data-rail-in` y `data-hidden-in` del `<aside>`): con ellas la hoja coloca el panel antes de medir.
 */
export function adaptivePanelClasses(adaptive: AdaptiveMap): { drawerIn?: string; railIn?: string; hiddenIn?: string } {
  const drawer: SizeClass[] = [];
  const rail: SizeClass[] = [];
  const hidden: SizeClass[] = [];
  for (const cls of SIZE_CLASS_NAMES) {
    const s = resolveAdaptive(adaptive, cls);
    if (s.hidden) hidden.push(cls);
    else if (panelVariant(s.variant) === "drawer") drawer.push(cls);
    else if (panelVariant(s.variant) === "rail") rail.push(cls);
  }
  const list = (l: SizeClass[]) => (l.length ? l.join(" ") : undefined);
  return { drawerIn: list(drawer), railIn: list(rail), hiddenIn: list(hidden) };
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

/**
 * Desplazamiento horizontal que deja a la vista una pestaña (`tab`) dentro de la tira (`list`); 0 si ya se ve.
 * `margin` aparta la pestaña del borde (el ancho del difuminado de la tira), para que no quede bajo la máscara.
 */
export function revealOffset(tab: { left: number; right: number }, list: { left: number; right: number }, margin = 0): number {
  // Si la pestaña no cabe con el margen a los dos lados, se deja entera sin margen (mejor rozar el borde que cortarla).
  const m = tab.right - tab.left + 2 * margin <= list.right - list.left ? margin : 0;
  if (tab.left < list.left + m) return tab.left - list.left - m;
  if (tab.right > list.right - m) return tab.right - list.right + m;
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

/* ---------- FloatingPanel ---------- */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Margen mínimo entre un panel flotante y el borde de su área. */
export const FLOAT_MARGIN = 8;
/** Paso de las flechas al mover o redimensionar; con Mayús, ×10. */
export const FLOAT_STEP = 10;

/**
 * Rectángulo acotado al área `bounds` (ancho y alto): el tamaño no pasa del área menos los márgenes ni baja del mínimo,
 * y la posición deja el panel entero dentro (si no cabe, pegado al margen de inicio).
 */
export function clampRect(
  rect: Rect,
  bounds: { width: number; height: number },
  min: { width: number; height: number } = { width: 0, height: 0 },
  margin = FLOAT_MARGIN,
): Rect {
  const width = clamp(rect.width, min.width, Math.max(min.width, bounds.width - margin * 2));
  const height = clamp(rect.height, min.height, Math.max(min.height, bounds.height - margin * 2));
  const x = clamp(rect.x, margin, Math.max(margin, bounds.width - width - margin));
  const y = clamp(rect.y, margin, Math.max(margin, bounds.height - height - margin));
  return { x, y, width, height };
}

/** Desplazamiento que pide una flecha en el asa de mover (hacia donde apunta), o null si la tecla no mueve. */
export function moveDelta(key: string, step: number): { dx: number; dy: number } | null {
  if (key === "ArrowLeft") return { dx: -step, dy: 0 };
  if (key === "ArrowRight") return { dx: step, dy: 0 };
  if (key === "ArrowUp") return { dx: 0, dy: -step };
  if (key === "ArrowDown") return { dx: 0, dy: step };
  return null;
}

/**
 * Rectángulo tras llevar la esquina de redimensionar `dw`, `dh` píxeles (positivos: hacia la derecha y abajo), acotado
 * al mínimo y al área. La esquina está al final de la línea: en RTL, abajo a la izquierda, así que el panel crece hacia
 * la izquierda y conserva su borde derecho.
 */
export function resizeRect(
  rect: Rect,
  dw: number,
  dh: number,
  bounds: { width: number; height: number },
  min: { width: number; height: number },
  rtl = false,
  margin = FLOAT_MARGIN,
): Rect {
  const right = rect.x + rect.width;
  const maxWidth = rtl ? right - margin : bounds.width - margin - rect.x;
  const maxHeight = bounds.height - margin - rect.y;
  const width = clamp(rect.width + (rtl ? -dw : dw), min.width, Math.max(min.width, maxWidth));
  const height = clamp(rect.height + dh, min.height, Math.max(min.height, maxHeight));
  return { x: rtl ? right - width : rect.x, y: rect.y, width, height };
}

/** Tamaño que pide una flecha en la esquina de redimensionar: derecha y abajo crecen (en RTL, izquierda crece). */
export function resizeDelta(key: string, step: number): { dw: number; dh: number } | null {
  const d = moveDelta(key, step);
  return d ? { dw: d.dx, dh: d.dy } : null;
}

/* ---------- PaneLayout: mosaico de paneles ---------- */

export type PaneNode = { type: "pane"; id: string } | { type: "split"; direction: "row" | "column"; sizes: number[]; children: PaneNode[] };

/** Borde de un panel donde cae lo arrastrado. Lógico: `inline-start` es la izquierda en LTR y la derecha en RTL. */
export type DropEdge = "inline-start" | "inline-end" | "block-start" | "block-end" | "center";

/** Ids de los paneles en orden de lectura (profundidad primero). */
export function paneIds(node: PaneNode | null): string[] {
  if (!node) return [];
  return node.type === "pane" ? [node.id] : node.children.flatMap(paneIds);
}

const normalize = (sizes: number[]) => {
  const total = sizes.reduce((a, b) => a + b, 0);
  return total > 0 ? sizes.map((s) => s / total) : evenFractions(sizes.length);
};

/** Reparto nuevo de la división en `path` (índices de hijos desde la raíz). */
export function setSizesAt(node: PaneNode, path: readonly number[], sizes: number[]): PaneNode {
  if (node.type !== "split") return node;
  if (!path.length) return { ...node, sizes: [...sizes] };
  const [head, ...rest] = path as [number, ...number[]];
  return { ...node, children: node.children.map((child, i) => (i === head ? setSizesAt(child, rest, sizes) : child)) };
}

/**
 * Divide el panel `target` y pone `id` delante (`before`) o detrás en `direction`. Si el padre ya divide en esa
 * dirección, el panel nuevo entra como hermano y se queda con la mitad del espacio del panel dividido.
 */
export function splitPane(
  node: PaneNode,
  target: string,
  id: string,
  direction: "row" | "column",
  position: "before" | "after" = "after",
): PaneNode {
  const pane: PaneNode = { type: "pane", id };
  if (node.type === "pane") {
    if (node.id !== target) return node;
    return { type: "split", direction, sizes: [0.5, 0.5], children: position === "before" ? [pane, node] : [node, pane] };
  }
  const at = node.children.findIndex((c) => c.type === "pane" && c.id === target);
  if (at >= 0 && node.direction === direction) {
    const half = (node.sizes[at] ?? 0) / 2;
    const children = [...node.children];
    const sizes = [...node.sizes];
    const index = position === "before" ? at : at + 1;
    children.splice(index, 0, pane);
    sizes.splice(at, 1, half, half);
    return { ...node, children, sizes };
  }
  return { ...node, children: node.children.map((c) => splitPane(c, target, id, direction, position)) };
}

/** Quita el panel `id`. Una división que se queda con un hijo cede su sitio a ese hijo. Sin paneles, null. */
export function removePane(node: PaneNode, id: string): PaneNode | null {
  if (node.type === "pane") return node.id === id ? null : node;
  const kept: { child: PaneNode; size: number }[] = [];
  node.children.forEach((child, i) => {
    const next = removePane(child, id);
    if (next) kept.push({ child: next, size: node.sizes[i] ?? 0 });
  });
  if (!kept.length) return null;
  if (kept.length === 1) return kept[0]!.child;
  return { ...node, children: kept.map((k) => k.child), sizes: normalize(kept.map((k) => k.size)) };
}

/** Intercambia dos paneles de sitio. */
export function swapPanes(node: PaneNode, a: string, b: string): PaneNode {
  if (node.type === "pane") return node.id === a ? { type: "pane", id: b } : node.id === b ? { type: "pane", id: a } : node;
  return { ...node, children: node.children.map((c) => swapPanes(c, a, b)) };
}

/**
 * Lleva el panel `id` al borde `edge` del panel `target` (lo divide), o lo intercambia con él (`center`). En RTL un
 * borde `inline-start` queda a la derecha, que en una fila es el primer hijo: el árbol guarda el orden lógico.
 */
export function movePane(node: PaneNode, id: string, target: string, edge: DropEdge): PaneNode {
  if (id === target || !paneIds(node).includes(id) || !paneIds(node).includes(target)) return node;
  if (edge === "center") return swapPanes(node, id, target);
  const rest = removePane(node, id);
  if (!rest) return node;
  const direction = edge === "inline-start" || edge === "inline-end" ? "row" : "column";
  const position = edge === "inline-start" || edge === "block-start" ? "before" : "after";
  return splitPane(rest, target, id, direction, position);
}

/**
 * Borde sobre el que está el punto dentro del rectángulo de un panel: el centro (la mitad interior en los dos ejes)
 * intercambia; fuera de él, el borde más cercano en proporción.
 */
export function dropEdge(rect: Box, point: { x: number; y: number }, rtl = false): DropEdge {
  const fx = rect.width > 0 ? (point.x - rect.left) / rect.width : 0.5;
  const fy = rect.height > 0 ? (point.y - rect.top) / rect.height : 0.5;
  if (fx > 0.25 && fx < 0.75 && fy > 0.25 && fy < 0.75) return "center";
  const distances: [DropEdge, number][] = [
    [rtl ? "inline-end" : "inline-start", fx],
    [rtl ? "inline-start" : "inline-end", 1 - fx],
    ["block-start", fy],
    ["block-end", 1 - fy],
  ];
  return distances.reduce((best, d) => (d[1] < best[1] ? d : best))[0];
}

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Panel vecino de `id` en una dirección física de la pantalla, según los rectángulos de los paneles: el más cercano
 * cuyo centro queda hacia ese lado y que se solapa en el otro eje. Null si no hay.
 */
export function neighborPane(
  rects: readonly { id: string; rect: Box }[],
  id: string,
  direction: "left" | "right" | "up" | "down",
): string | null {
  const from = rects.find((r) => r.id === id)?.rect;
  if (!from) return null;
  const cx = from.left + from.width / 2;
  const cy = from.top + from.height / 2;
  let best: { id: string; d: number } | null = null;
  for (const { id: other, rect } of rects) {
    if (other === id) continue;
    const ox = rect.left + rect.width / 2;
    const oy = rect.top + rect.height / 2;
    const horizontal = direction === "left" || direction === "right";
    const ahead = direction === "left" ? ox < cx : direction === "right" ? ox > cx : direction === "up" ? oy < cy : oy > cy;
    const overlap = horizontal
      ? rect.top < from.top + from.height && rect.top + rect.height > from.top
      : rect.left < from.left + from.width && rect.left + rect.width > from.left;
    if (!ahead || !overlap) continue;
    const d = horizontal ? Math.abs(ox - cx) : Math.abs(oy - cy);
    if (!best || d < best.d) best = { id: other, d };
  }
  return best?.id ?? null;
}

// ── Navbar de sitio ───────────────────────────────────────────────────────────────────────────────────────────

/**
 * Si hay que volver a medir si la fila del Navbar cabe. En fila se mide en cada cambio; plegado (cajón), solo
 * cuando la barra crece: medir en fila a cada estrechamiento haría parpadear el diseño.
 */
export function navbarShouldMeasure(collapsed: boolean, width: number, lastWidth: number): boolean {
  if (!collapsed) return true;
  return width > lastWidth;
}

/* ---------- AppBar y DocsLayout ---------- */

/** Avance 0…1 del pliegue de una AppBar tras desplazar `scroll` px sobre una distancia de pliegue. */
export function appBarProgress(scroll: number, distance: number): number {
  if (!(distance > 0) || !Number.isFinite(scroll)) return scroll > 0 ? 1 : 0;
  return clamp(scroll / distance, 0, 1);
}

/**
 * Índice de la sección activa de un índice de contenidos: la última cuyo inicio queda por encima de la línea de
 * lectura (`line`, px desde arriba). `tops` son los inicios de cada sección relativos al viewport, en orden. Si
 * ninguna ha llegado, la primera; con la página al final (`atEnd`), la última.
 */
export function activeSection(tops: readonly number[], line: number, atEnd = false): number {
  if (!tops.length) return -1;
  if (atEnd) return tops.length - 1;
  let active = 0;
  tops.forEach((top, i) => {
    if (top <= line) active = i;
  });
  return active;
}
