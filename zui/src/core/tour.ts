// Recorrido guiado (Tour): aritmética de pasos, del anillo que resalta el elemento del paso y de las teclas.
// Sin DOM al importar. La comparten el binding de React y `startTour()` del modo DOM.
import type { Box } from "./place";

/** Texto de progreso con `{step}` y `{count}` («Step 2 of 4»). */
export const tourProgress = (template: string, index: number, count: number) =>
  template.replace("{step}", String(index + 1)).replace("{count}", String(count));

/** Índice acotado al número de pasos (o -1 sin pasos). */
export const clampStep = (index: number, count: number) => (count > 0 ? Math.min(Math.max(index, 0), count - 1) : -1);

/**
 * Rectángulo del anillo que resalta el elemento del paso: el del elemento con `padding` alrededor, recortado a la
 * ventana. null si el elemento no está a la vista.
 */
export function ringBox(target: Box | null, padding: number, viewport: { width: number; height: number }): Box | null {
  if (!target || (target.width === 0 && target.height === 0)) return null;
  const left = Math.max(0, target.left - padding);
  const top = Math.max(0, target.top - padding);
  const right = Math.min(viewport.width, target.left + target.width + padding);
  const bottom = Math.min(viewport.height, target.top + target.height + padding);
  if (right <= left || bottom <= top) return null;
  return { left, top, width: right - left, height: bottom - top };
}

/** Ancla para un paso sin elemento (o fuera de la vista): el centro de la ventana. */
export const centerBox = (viewport: { width: number; height: number }): Box => ({
  left: viewport.width / 2,
  top: viewport.height / 3,
  width: 0,
  height: 0,
});

/** Paso al que lleva una tecla con el foco dentro del recorrido, o null. En RTL la flecha izquierda avanza. */
export function tourKey(key: string, rtl = false): "next" | "prev" | null {
  if (key === (rtl ? "ArrowLeft" : "ArrowRight")) return "next";
  if (key === (rtl ? "ArrowRight" : "ArrowLeft")) return "prev";
  return null;
}
