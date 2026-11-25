// Minimapa de un lienzo de nodos: escala y proyección del conjunto (nodos más lo que se ve) en una caja pequeña, y el
// camino inverso para mover la vista desde un punto del minimapa. Puro, sin documento.

import { centerOn, type Point, type Rect, type Size, unionRect, type Viewport, visibleRect } from "./viewport";

export interface MinimapProjection {
  /** Unidades de minimapa por unidad del mundo. */
  scale: number;
  /** Desplazamiento: `mini = (world - origin) × scale + offset`. */
  origin: Point;
  offset: Point;
}

/**
 * Proyección que encaja `content` (lo que hay) y la vista actual en un minimapa de `size`, centrada y con `padding`
 * en unidades del minimapa.
 */
export function minimapProjection(content: Rect | null, view: Rect, size: Size, padding = 8): MinimapProjection {
  const box = unionRect(content ? [content, view] : [view])!;
  const aw = Math.max(1, size.width - padding * 2);
  const ah = Math.max(1, size.height - padding * 2);
  const scale = Math.min(aw / Math.max(1, box.width), ah / Math.max(1, box.height));
  return {
    scale,
    origin: { x: box.x, y: box.y },
    offset: { x: (size.width - box.width * scale) / 2, y: (size.height - box.height * scale) / 2 },
  };
}

export const projectRect = (p: MinimapProjection, r: Rect): Rect => ({
  x: (r.x - p.origin.x) * p.scale + p.offset.x,
  y: (r.y - p.origin.y) * p.scale + p.offset.y,
  width: r.width * p.scale,
  height: r.height * p.scale,
});

export const unprojectPoint = (p: MinimapProjection, m: Point): Point => ({
  x: (m.x - p.offset.x) / p.scale + p.origin.x,
  y: (m.y - p.offset.y) / p.scale + p.origin.y,
});

/** Vista centrada en el punto del minimapa `m` (sin cambiar el zoom). */
export const viewportFromMinimap = (p: MinimapProjection, m: Point, vp: Viewport, size: Size): Viewport =>
  centerOn(vp, unprojectPoint(p, m), size);

/** Caja visible del lienzo proyectada: el rectángulo que se pinta en el minimapa. */
export const minimapView = (p: MinimapProjection, vp: Viewport, size: Size): Rect => projectRect(p, visibleRect(vp, size));
