// CompareSlider (antes/después): posición del divisor a partir del puntero y del teclado, de 0 a 100. Sin documento.

import { keyValue } from "./slider";

const clamp = (n: number) => Math.min(100, Math.max(0, n));

/** Posición (0–100) bajo el puntero: horizontal desde la izquierda, vertical desde arriba. */
export function comparePosition(
  pointer: { x: number; y: number },
  rect: { left: number; top: number; width: number; height: number },
  vertical: boolean,
): number {
  const t = vertical ? (pointer.y - rect.top) / (rect.height || 1) : (pointer.x - rect.left) / (rect.width || 1);
  return Math.round(clamp(t * 100) * 10) / 10;
}

/**
 * Posición tras una tecla (patrón APG «slider»): la flecha hacia el «después» (derecha o abajo) muestra más «antes»;
 * Mayúsculas y Re/Av Pág, diez pasos; Inicio y Fin, los extremos. `undefined` si la tecla no mueve.
 */
export function compareKey(key: string, shift: boolean, value: number, vertical: boolean, step = 1): number | undefined {
  const next = keyValue(key, shift, value, 0, 100, step, 1, vertical ? -1 : 1);
  return next === undefined ? undefined : clamp(Math.round(next * 10) / 10);
}
