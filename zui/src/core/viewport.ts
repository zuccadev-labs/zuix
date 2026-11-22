// Vista de un lienzo infinito (nodos): transformación pantalla ↔ mundo, zoom alrededor de un punto con límites,
// encuadre de unas cajas con margen y la caja del mundo que se ve. También la aritmética de rectángulos que comparten
// el lienzo, la selección por caja y el minimapa. Puro: números y cajas, sin documento.
// Convención: un punto del mundo `w` se pinta en la pantalla en `w × zoom + (x, y)`.

export interface Point {
  x: number;
  y: number;
}
export interface Size {
  width: number;
  height: number;
}
export interface Rect extends Point, Size {}
export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;
export const ZOOM_STEP = 1.2;
export const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

const finite = (n: number, fallback: number) => (Number.isFinite(n) ? n : fallback);

/** Zoom acotado a [min, max] (con límites en orden y positivos). */
export function clampZoom(zoom: number, min = MIN_ZOOM, max = MAX_ZOOM): number {
  const lo = Math.max(1e-3, Math.min(min, max));
  const hi = Math.max(lo, Math.max(min, max));
  return Math.min(hi, Math.max(lo, finite(zoom, 1)));
}

/** Punto de la pantalla (relativo al lienzo) → punto del mundo. */
export const toWorld = (vp: Viewport, p: Point): Point => ({ x: (p.x - vp.x) / vp.zoom, y: (p.y - vp.y) / vp.zoom });
/** Punto del mundo → punto de la pantalla. */
export const toScreen = (vp: Viewport, p: Point): Point => ({ x: p.x * vp.zoom + vp.x, y: p.y * vp.zoom + vp.y });

/** Cambia el zoom a `zoom` dejando quieto el punto de la pantalla `at`: lo que estaba bajo el puntero sigue ahí. */
export function zoomTo(vp: Viewport, zoom: number, at: Point, min = MIN_ZOOM, max = MAX_ZOOM): Viewport {
  const next = clampZoom(zoom, min, max);
  const world = toWorld(vp, at);
  return { zoom: next, x: at.x - world.x * next, y: at.y - world.y * next };
}

/** Multiplica el zoom por `factor` alrededor de `at`. */
export const zoomBy = (vp: Viewport, factor: number, at: Point, min = MIN_ZOOM, max = MAX_ZOOM): Viewport =>
  zoomTo(vp, vp.zoom * finite(factor, 1), at, min, max);

/** Desplaza la vista en px de pantalla. */
export const panBy = (vp: Viewport, dx: number, dy: number): Viewport => ({ ...vp, x: vp.x + finite(dx, 0), y: vp.y + finite(dy, 0) });

/**
 * Factor de zoom de una rueda: exponencial en el desplazamiento, así acercar y alejar lo mismo vuelve al punto de
 * partida. `deltaMode` 1 (líneas) y 2 (páginas) se pasan a px como hace el navegador.
 */
export function wheelFactor(deltaY: number, deltaMode = 0, speed = 0.0025): number {
  const px = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;
  // Un paso de rueda de ratón (~100 px) no pasa de ×1.3: se evita el salto brusco.
  return Math.exp(-Math.max(-120, Math.min(120, finite(px, 0))) * speed);
}

/** Caja del mundo que se ve en una vista de `size`. */
export function visibleRect(vp: Viewport, size: Size): Rect {
  return { x: -vp.x / vp.zoom, y: -vp.y / vp.zoom, width: size.width / vp.zoom, height: size.height / vp.zoom };
}

/**
 * Vista que encuadra `rect` en una vista de `size` con `padding` px de margen (en pantalla) y el zoom acotado. Sin
 * caja (o vacía) centra el origen a escala 1. Si el zoom mínimo no deja que la caja quepa, en ese eje se ve su
 * principio (arriba, a la izquierda) con el margen, y el resto se alcanza desplazando: centrada, se cortarían los
 * dos extremos.
 */
export function fitRect(rect: Rect | null, size: Size, o: { padding?: number; min?: number; max?: number } = {}): Viewport {
  const padding = Math.max(0, o.padding ?? 48);
  if (!rect || !(size.width > 0) || !(size.height > 0)) return { x: size.width / 2 || 0, y: size.height / 2 || 0, zoom: 1 };
  const aw = Math.max(1, size.width - padding * 2);
  const ah = Math.max(1, size.height - padding * 2);
  const zoom = clampZoom(Math.min(aw / Math.max(1, rect.width), ah / Math.max(1, rect.height)), o.min, o.max ?? 1.5);
  const axis = (start: number, length: number, room: number, view: number) =>
    length * zoom > room + 0.5 ? padding - start * zoom : view / 2 - (start + length / 2) * zoom;
  return { zoom, x: axis(rect.x, rect.width, aw, size.width), y: axis(rect.y, rect.height, ah, size.height) };
}

/** Vista que centra el punto del mundo `p` sin cambiar el zoom. */
export const centerOn = (vp: Viewport, p: Point, size: Size): Viewport => ({
  ...vp,
  x: size.width / 2 - p.x * vp.zoom,
  y: size.height / 2 - p.y * vp.zoom,
});

/**
 * Desplazamiento mínimo para que `rect` (mundo) quede dentro de la vista con `margin` px: lo que hace
 * `scrollIntoView({ block: "nearest" })` en un lienzo. Si ya se ve, la vista no cambia.
 */
export function revealRect(vp: Viewport, rect: Rect, size: Size, margin = 24): Viewport {
  const a = toScreen(vp, rect);
  const w = rect.width * vp.zoom;
  const h = rect.height * vp.zoom;
  let dx = 0;
  let dy = 0;
  if (w + margin * 2 > size.width) dx = size.width / 2 - (a.x + w / 2);
  else if (a.x < margin) dx = margin - a.x;
  else if (a.x + w > size.width - margin) dx = size.width - margin - (a.x + w);
  if (h + margin * 2 > size.height) dy = size.height / 2 - (a.y + h / 2);
  else if (a.y < margin) dy = margin - a.y;
  else if (a.y + h > size.height - margin) dy = size.height - margin - (a.y + h);
  return dx || dy ? panBy(vp, dx, dy) : vp;
}

/**
 * Zoom de un pellizco: la vista de partida, la distancia y el centro iniciales y los actuales (en pantalla). El punto
 * del mundo bajo el centro inicial queda bajo el centro actual, así el gesto también desplaza.
 */
export function pinchViewport(
  start: Viewport,
  startDistance: number,
  distance: number,
  startCenter: Point,
  center: Point,
  min = MIN_ZOOM,
  max = MAX_ZOOM,
): Viewport {
  const zoom = clampZoom(start.zoom * (distance > 0 && startDistance > 0 ? distance / startDistance : 1), min, max);
  const world = toWorld(start, startCenter);
  return { zoom, x: center.x - world.x * zoom, y: center.y - world.y * zoom };
}

// Rectángulos.

/** Caja normalizada entre dos puntos (en cualquier orden). */
export function rectFromPoints(a: Point, b: Point): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
}

/** Verdadero si dos cajas se solapan (tocarse en el borde no cuenta). */
export const intersects = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Verdadero si `outer` contiene a `inner` por completo. */
export const containsRect = (outer: Rect, inner: Rect): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

/** Verdadero si el punto está dentro de la caja (bordes incluidos). */
export const containsPoint = (r: Rect, p: Point): boolean => p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;

/** Caja que envuelve a todas, o `null` sin cajas. */
export function unionRect(rects: Iterable<Rect>): Rect | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const r of rects) {
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.width);
    y1 = Math.max(y1, r.y + r.height);
  }
  return x0 === Infinity ? null : { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** Caja agrandada `by` en cada lado. */
export const expandRect = (r: Rect, by: number): Rect => ({ x: r.x - by, y: r.y - by, width: r.width + by * 2, height: r.height + by * 2 });

/** Valor ajustado a la cuadrícula `grid` (sin cuadrícula, tal cual). */
export const snapValue = (v: number, grid: number | false | undefined): number => (grid && grid > 0 ? Math.round(v / grid) * grid : v);
/** Punto ajustado a la cuadrícula. */
export const snapPoint = (p: Point, grid: number | false | undefined): Point => ({ x: snapValue(p.x, grid), y: snapValue(p.y, grid) });
