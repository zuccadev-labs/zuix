/**
 * Geometría de la lente curva del carrusel.
 *
 * El centro de la tira queda plano; hacia los bordes el contenido se amplía en horizontal
 * y se estira en vertical en forma de S: a la izquierda cae hacia abajo (anclado arriba)
 * y a la derecha sube (anclado abajo).
 *
 * Todas las medidas son px CSS relativos al viewport de la tira.
 * - lensSource: punto visible → punto del contenido que se ve ahí (pruebas de puntero).
 * - lensForward: inversa exacta; la usan la malla WebGL (misma fórmula en GLSL) y matrix3d.
 */

export interface LensShape {
  width: number;
  height: number;
  centerY: number;
  slideHeight: number;
  /** Fracción (0..1) de media anchura que queda sin deformar. */
  flat: number;
  /** Estiramiento vertical máximo en el borde (0.6 = +60 % de alto). */
  stretch: number;
  /** Ampliación horizontal en el borde; < 0.5 para que el mapeo sea monótono. */
  magnify: number;
}

export interface LensPoint {
  x: number;
  y: number;
}

const CURVE = 1.8;

export function createLensShape(width: number, height: number, slideHeight: number, widestSlide: number): LensShape {
  const compact = width < 640;
  const half = Math.max(width / 2, 1);
  const flat = Math.min(Math.max((widestSlide / 2 + (compact ? 8 : 24)) / half, 0.2), 0.86);
  return {
    width,
    height,
    centerY: height / 2,
    slideHeight,
    flat,
    stretch: compact ? 0.45 : 0.62,
    magnify: compact ? 0.18 : 0.24,
  };
}

export function lensSource(x: number, y: number, shape: LensShape, strength = 1): LensPoint {
  const half = shape.width / 2;
  const nx = (x - half) / half;
  const side = nx < 0 ? -1 : 1;
  const ax = Math.abs(nx);
  const span = Math.max(1 - shape.flat, 1e-3);
  const u = Math.max(ax - shape.flat, 0);
  const t = Math.min(u / span, 1);
  const e = Math.pow(t, CURVE) * strength;

  const sx = ax - shape.magnify * strength * u * t;
  const halfSlide = shape.slideHeight / 2;
  const ny = (y - shape.centerY) / halfSlide;
  const sy = side + (ny - side) / (1 + shape.stretch * e);

  return { x: half + side * sx * half, y: shape.centerY + sy * halfSlide };
}

export function lensForward(x: number, y: number, shape: LensShape, strength = 1): LensPoint {
  const half = shape.width / 2;
  const nx = (x - half) / half;
  const side = nx < 0 ? -1 : 1;
  const a = Math.abs(nx);
  const f = shape.flat;
  const span = Math.max(1 - f, 1e-3);
  const m = shape.magnify * strength;

  let u = 0;
  if (a > f) {
    const v = a - f;
    if (v >= span * (1 - m)) {
      // Más allá del borde t se satura en 1 y el mapeo es lineal.
      u = v / (1 - m);
    } else {
      const c = m / span;
      u = c < 1e-6 ? v : (1 - Math.sqrt(Math.max(1 - 4 * c * v, 0))) / (2 * c);
    }
  }

  const ax = a > f ? f + u : a;
  const t = Math.min(u / span, 1);
  const e = Math.pow(t, CURVE) * strength;
  const halfSlide = shape.slideHeight / 2;
  const nySource = (y - shape.centerY) / halfSlide;
  const ny = side + (nySource - side) * (1 + shape.stretch * e);

  return { x: half + side * ax * half, y: shape.centerY + ny * halfSlide };
}

/**
 * Homografía que lleva la caja (0,0)-(w,h) de un elemento al cuadrilátero dado
 * (esquinas en orden: superior izquierda, superior derecha, inferior derecha, inferior izquierda,
 * relativas al origen del elemento). Requiere transform-origin: 0 0.
 */
export function quadToMatrix3d(w: number, h: number, quad: [LensPoint, LensPoint, LensPoint, LensPoint]): string {
  const [p0, p1, p2, p3] = quad;
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const dy3 = p0.y - p1.y + p2.y - p3.y;

  let a: number, b: number, d: number, e: number, g: number, k: number;
  const det = dx1 * dy2 - dx2 * dy1;
  if ((Math.abs(dx3) < 1e-6 && Math.abs(dy3) < 1e-6) || Math.abs(det) < 1e-9) {
    a = p1.x - p0.x;
    b = p3.x - p0.x;
    d = p1.y - p0.y;
    e = p3.y - p0.y;
    g = 0;
    k = 0;
  } else {
    g = (dx3 * dy2 - dx2 * dy3) / det;
    k = (dx1 * dy3 - dx3 * dy1) / det;
    a = p1.x - p0.x + g * p1.x;
    b = p3.x - p0.x + k * p3.x;
    d = p1.y - p0.y + g * p1.y;
    e = p3.y - p0.y + k * p3.y;
  }

  const c = p0.x;
  const f = p0.y;
  const values = [a / w, d / w, 0, g / w, b / h, e / h, 0, k / h, 0, 0, 1, 0, c, f, 0, 1];
  return `matrix3d(${values.map((value) => (Number.isFinite(value) ? +value.toFixed(6) : 0)).join(",")})`;
}

/** Ancho (en fracción del tramo curvo) del fundido entre el slide real y el dibujado con WebGL. */
export const LENS_BAND = 0.05;

/**
 * Franja central donde se ve el slide HTML real (nítido). Fuera de ella dibuja WebGL.
 * En el límite la deformación es < 1 px, así que el paso entre ambas no se aprecia.
 */
export function centerBounds(shape: LensShape): { left: number; right: number } {
  const half = shape.width / 2;
  const reach = (shape.flat + LENS_BAND * (1 - shape.flat)) * half;
  return { left: half - reach, right: half + reach };
}
