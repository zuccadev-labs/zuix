// SignaturePad: trazos como listas de puntos en fracciones del lienzo (se adaptan al cambiar de tamaño), trazado
// suavizado (curvas cuadráticas por los puntos medios) y exportación a SVG. Sin documento.

export interface SignaturePoint {
  /** Fracción del ancho (0–1). */
  x: number;
  /** Fracción del alto (0–1). */
  y: number;
  /** Presión del puntero (0–1; 0,5 sin sensor). */
  p: number;
}
export type SignatureStroke = SignaturePoint[];

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Grosor de un trazo: base modulado por la presión media (entre 0,6 y 1,4 veces la base). */
export function strokeWidth(stroke: SignatureStroke, base = 2.5): number {
  if (!stroke.length) return base;
  const avg = stroke.reduce((sum, pt) => sum + (Number.isFinite(pt.p) ? pt.p : 0.5), 0) / stroke.length;
  return r2(base * (0.6 + Math.min(1, Math.max(0, avg)) * 0.8));
}

/**
 * Trazado SVG suavizado de un trazo en un lienzo de `width` × `height`: un punto solo es un círculo diminuto (un
 * toque); dos, una línea; más, curvas cuadráticas con control en cada punto y extremos en los puntos medios.
 */
export function strokePath(stroke: SignatureStroke, width: number, height: number): string {
  const pts = stroke.map((pt) => ({ x: r2(pt.x * width), y: r2(pt.y * height) }));
  if (!pts.length) return "";
  const [first] = pts as [{ x: number; y: number }];
  if (pts.length === 1) return `M${first.x} ${first.y}l0.01 0`;
  if (pts.length === 2) return `M${first.x} ${first.y}L${pts[1]!.x} ${pts[1]!.y}`;
  let d = `M${first.x} ${first.y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    d += `Q${a.x} ${a.y} ${r2((a.x + b.x) / 2)} ${r2((a.y + b.y) / 2)}`;
  }
  const last = pts[pts.length - 1]!;
  return `${d}L${last.x} ${last.y}`;
}

/** Firma en SVG autónomo (trazos redondeados en `color`, por defecto el color del texto donde se inserte). */
export function signatureSvg(
  strokes: readonly SignatureStroke[],
  width: number,
  height: number,
  color = "currentColor",
  base = 2.5,
): string {
  const paths = strokes
    .filter((s) => s.length)
    .map((s) => `<path d="${strokePath(s, width, height)}" stroke-width="${strokeWidth(s, base)}"/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

/** Un punto nuevo en fracciones del lienzo, acotado; descarta los que apenas se mueven (menos de `minStep` px). */
export function addPoint(
  stroke: SignatureStroke,
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  pressure: number,
  minStep = 0.75,
): boolean {
  const w = rect.width || 1;
  const h = rect.height || 1;
  const x = Math.min(1, Math.max(0, (clientX - rect.left) / w));
  const y = Math.min(1, Math.max(0, (clientY - rect.top) / h));
  const last = stroke[stroke.length - 1];
  if (last && Math.hypot((x - last.x) * w, (y - last.y) * h) < minStep) return false;
  stroke.push({ x: Math.round(x * 10000) / 10000, y: Math.round(y * 10000) / 10000, p: pressure > 0 ? pressure : 0.5 });
  return true;
}
