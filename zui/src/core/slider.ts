// Aritmética del Slider: paso, porcentaje, teclado y reparto entre tiradores.

const decimalsOf = (n: number) => (String(n).split(".")[1] ?? "").length;

/** Ajusta al paso más cercano (contado desde `min`), sin el ruido de la coma flotante. Un valor no numérico da `min`. */
export function snap(value: number, min: number, max: number, step: number): number {
  if (!Number.isFinite(value)) return value === Number.POSITIVE_INFINITY ? Math.max(min, max) : min;
  const size = Number.isFinite(step) && step > 0 ? step : 1;
  const decimals = Math.max(decimalsOf(size), decimalsOf(min));
  const snapped = Number((Math.round((value - min) / size) * size + min).toFixed(decimals));
  return Math.min(Math.max(min, max), Math.max(min, snapped));
}

/** Posición de un valor en la pista, de 0 a 100. */
export const percent = (value: number, min: number, max: number) => (max === min ? 0 : ((value - min) / (max - min)) * 100);

/**
 * Valor al que lleva una tecla desde `current`, o `undefined` si la tecla no mueve. `dirX` y `dirY` son 1, o -1 cuando
 * ese eje va invertido (horizontal: RTL o `inverted`; vertical: `inverted`): entonces la flecha izquierda (o la de
 * abajo) sube el valor. Mayúsculas y Re/Av Pág: 10 pasos.
 */
export function keyValue(key: string, shift: boolean, current: number, min: number, max: number, step: number, dirX: 1 | -1 = 1, dirY: 1 | -1 = 1): number | undefined {
  const big = shift || key === "PageUp" || key === "PageDown" ? 10 : 1;
  if (key === "Home") return min;
  if (key === "End") return max;
  if (key === "PageUp") return current + step * big;
  if (key === "PageDown") return current - step * big;
  if (key === "ArrowUp") return current + step * big * dirY;
  if (key === "ArrowDown") return current - step * big * dirY;
  if (key === "ArrowRight") return current + step * big * dirX;
  if (key === "ArrowLeft") return current - step * big * dirX;
  return undefined;
}

/** Valor que corresponde a una fracción (0 a 1) del recorrido de la pista. */
export const valueAt = (ratio: number, min: number, max: number) => min + Math.min(1, Math.max(0, ratio)) * (max - min);

/** Tirador más cercano a un valor (el que se mueve al pulsar en la pista). */
export function closestThumb(values: ReadonlyArray<number>, value: number): number {
  return values.reduce((best, v, i) => (Math.abs(v - value) < Math.abs(values[best]! - value) ? i : best), 0);
}

/** Mueve un tirador entre sus vecinos. Devuelve la lista nueva, o `null` si no cambia. */
export function moveThumb(values: ReadonlyArray<number>, index: number, raw: number, min: number, max: number, step: number, minStepsBetween = 0): number[] | null {
  if (index < 0 || index >= values.length) return null;
  const gap = minStepsBetween * step;
  const low = index > 0 ? values[index - 1]! + gap : min;
  const high = index < values.length - 1 ? values[index + 1]! - gap : max;
  const next = Math.min(high, Math.max(low, snap(raw, min, max, step)));
  if (next === values[index]) return null;
  const out = [...values];
  out[index] = next;
  return out;
}
