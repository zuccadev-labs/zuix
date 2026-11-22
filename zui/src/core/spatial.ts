// Navegación espacial con flechas entre piezas de una rejilla irregular (eventos de la agenda), con el algoritmo
// habitual de navegación espacial: un candidato está en la dirección pulsada solo si su borde cercano está en o más
// allá del borde lejano del actual en ese eje; se prefieren los que se solapan en el eje perpendicular (menor
// distancia, y a igualdad menor desvío del centro) y, si no hay, se puntúa `distancia + peso × desvío`. Sin
// candidato devuelve -1: quien llama no debe hacer `preventDefault()`, para que el navegador desplace.
// Las cajas se leen en cada tecla (getBoundingClientRect), no se guardan.

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
export type Direction = "up" | "down" | "left" | "right";

/** Índice del mejor candidato en `dir` desde `current`, o -1. */
export function nextInDirection(current: Box, candidates: Box[], dir: Direction, tolerance = 1, weight = 2): number {
  const horizontal = dir === "left" || dir === "right";
  let best = -1;
  let bestAligned = false;
  let bestScore = Infinity;
  let bestTie = Infinity;
  candidates.forEach((c, i) => {
    if (c === current) return;
    let gap: number;
    if (dir === "right") gap = c.left - current.right;
    else if (dir === "left") gap = current.left - c.right;
    else if (dir === "down") gap = c.top - current.bottom;
    else gap = current.top - c.bottom;
    if (gap < -tolerance) return;
    gap = Math.max(0, gap);
    const [a0, a1, b0, b1] = horizontal ? [current.top, current.bottom, c.top, c.bottom] : [current.left, current.right, c.left, c.right];
    const aligned = Math.min(a1, b1) - Math.max(a0, b0) > 0;
    const offset = Math.abs((a0 + a1) / 2 - (b0 + b1) / 2);
    if (aligned) {
      if (!bestAligned || gap < bestScore || (gap === bestScore && offset < bestTie)) {
        best = i;
        bestAligned = true;
        bestScore = gap;
        bestTie = offset;
      }
    } else if (!bestAligned) {
      const score = gap + weight * offset;
      if (score < bestScore) {
        best = i;
        bestScore = score;
        bestTie = offset;
      }
    }
  });
  return best;
}

/** Dirección de una tecla de flecha ya convertida a lógica de pantalla (en RTL, quien llama la invierte antes). */
export function arrowDirection(key: string): Direction | null {
  return key === "ArrowUp" ? "up" : key === "ArrowDown" ? "down" : key === "ArrowLeft" ? "left" : key === "ArrowRight" ? "right" : null;
}
