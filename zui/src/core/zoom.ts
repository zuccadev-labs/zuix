// Zoom y encuadre de una imagen dentro de una vista (Lightbox): escala acotada, zoom alrededor de un punto y
// traslación que no deja ver el fondo. Lógica pura en px; la traslación es la del centro de la imagen respecto al
// centro de la vista.

export interface ZoomState {
  scale: number;
  x: number;
  y: number;
}

export interface ZoomBox {
  /** Tamaño de la vista. */
  vw: number;
  vh: number;
  /** Tamaño de la imagen a escala 1 (ya encajada en la vista). */
  w: number;
  h: number;
}

export const MIN_SCALE = 1;
export const MAX_SCALE = 4;
export const ZOOM_STEP = 1.5;
export const IDENTITY: ZoomState = { scale: 1, x: 0, y: 0 };

/** Traslación máxima en cada eje: la imagen escalada no se separa del borde de la vista. */
export function panLimits(box: ZoomBox, scale: number): { x: number; y: number } {
  return { x: Math.max(0, (box.w * scale - box.vw) / 2), y: Math.max(0, (box.h * scale - box.vh) / 2) };
}

/** Acota escala y traslación. */
export function clampZoom(box: ZoomBox, s: ZoomState, min = MIN_SCALE, max = MAX_SCALE): ZoomState {
  const scale = Math.max(min, Math.min(max, Number.isFinite(s.scale) ? s.scale : 1));
  const lim = panLimits(box, scale);
  const x = Math.max(-lim.x, Math.min(lim.x, Number.isFinite(s.x) ? s.x : 0));
  const y = Math.max(-lim.y, Math.min(lim.y, Number.isFinite(s.y) ? s.y : 0));
  return { scale, x: x === 0 ? 0 : x, y: y === 0 ? 0 : y };
}

/**
 * Cambia la escala a `scale` dejando quieto el punto (`px`, `py`) de la vista (coordenadas desde el centro de la
 * vista): lo que estaba bajo el puntero sigue bajo el puntero.
 */
export function zoomAt(box: ZoomBox, s: ZoomState, scale: number, px = 0, py = 0): ZoomState {
  const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
  const k = next / s.scale;
  return clampZoom(box, { scale: next, x: px - (px - s.x) * k, y: py - (py - s.y) * k });
}

/** Un paso de zoom hacia dentro (+1) o hacia fuera (−1), alrededor del centro. */
export const zoomStep = (box: ZoomBox, s: ZoomState, direction: 1 | -1) =>
  zoomAt(box, s, direction > 0 ? s.scale * ZOOM_STEP : s.scale / ZOOM_STEP);

/** Mueve la imagen ampliada. */
export const pan = (box: ZoomBox, s: ZoomState, dx: number, dy: number) => clampZoom(box, { ...s, x: s.x + dx, y: s.y + dy });

/** Tamaño de una imagen de `nw`×`nh` encajada (contain) en una vista de `vw`×`vh`. */
export function containSize(nw: number, nh: number, vw: number, vh: number): { w: number; h: number } {
  if (!(nw > 0) || !(nh > 0) || !(vw > 0) || !(vh > 0)) return { w: Math.max(0, vw), h: Math.max(0, vh) };
  const k = Math.min(vw / nw, vh / nh);
  return { w: nw * k, h: nh * k };
}
