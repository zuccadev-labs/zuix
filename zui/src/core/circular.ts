// CircularSlider: aritmética del anillo (ángulo ↔ valor, arco abierto o círculo completo, trazado SVG de los arcos y
// posición del tirador). Ángulos en grados, 0 arriba y en el sentido de las agujas del reloj. Sin documento.

import { snap } from "./slider";

const wrap = (deg: number) => ((deg % 360) + 360) % 360;

/** Arco válido (30–360) y ángulo de inicio: sin `start`, un arco abierto queda centrado abajo (hueco abajo). */
export function ringGeometry(arc?: number, start?: number): { arc: number; start: number } {
  const a = Number.isFinite(arc) ? Math.min(360, Math.max(30, arc!)) : 360;
  const s = Number.isFinite(start) ? wrap(start!) : a >= 360 ? 0 : wrap(180 + (360 - a) / 2);
  return { arc: a, start: s };
}

/** Ángulo del valor sobre el anillo. */
export function angleOf(value: number, min: number, max: number, arc: number, start: number): number {
  const t = max === min ? 0 : (Math.min(max, Math.max(min, value)) - min) / (max - min);
  return wrap(start + t * arc);
}

/**
 * Valor en un punto relativo al centro (`dx` a la derecha, `dy` hacia abajo). En un arco abierto, lo que cae en el
 * hueco va al extremo más cercano.
 */
export function valueAtPoint(dx: number, dy: number, min: number, max: number, step: number, arc: number, start: number): number {
  const angle = wrap((Math.atan2(dx, -dy) * 180) / Math.PI);
  let rel = wrap(angle - start);
  if (arc < 360 && rel > arc) rel = rel > arc + (360 - arc) / 2 ? 0 : arc;
  return snap(min + (rel / arc) * (max - min), min, max, step);
}

/** Punto del anillo en un ángulo, en un lienzo de `size` con centro en `size / 2`. */
export function pointAt(angle: number, radius: number, size = 100): { x: number; y: number } {
  const rad = (angle * Math.PI) / 180;
  const r3 = (n: number) => Math.round(n * 1000) / 1000;
  return { x: r3(size / 2 + radius * Math.sin(rad)), y: r3(size / 2 - radius * Math.cos(rad)) };
}

/** Trazado SVG de un arco de `from` a `to` grados (en el sentido de las agujas); 360 o más es un círculo. */
export function arcPath(from: number, sweep: number, radius: number, size = 100): string {
  if (sweep <= 0) return "";
  if (sweep >= 360) {
    const top = pointAt(0, radius, size);
    const bottom = pointAt(180, radius, size);
    return `M${top.x} ${top.y}A${radius} ${radius} 0 1 1 ${bottom.x} ${bottom.y}A${radius} ${radius} 0 1 1 ${top.x} ${top.y}`;
  }
  const a = pointAt(from, radius, size);
  const b = pointAt(from + sweep, radius, size);
  return `M${a.x} ${a.y}A${radius} ${radius} 0 ${sweep > 180 ? 1 : 0} 1 ${b.x} ${b.y}`;
}
