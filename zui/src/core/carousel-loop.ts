// Bucle sin réplicas del modo de desplazamiento nativo (guía `carousel`): no se clona ni se mueve nada en el DOM; el
// primer o el último slide se «aparca» con CSS `order` junto al actual cuando el carrusel está en un extremo o a un
// paso de él. El CSS hace el aparcamiento con `--z-carousel-current`; aquí está el mismo cálculo para el motor (orden
// visual, vecinos) y para las pruebas. Lógica pura.

/** Hacen falta tres slides para que el actual tenga siempre un vecino a cada lado. */
export const canPark = (count: number) => count >= 3;

/**
 * `order` del primer y del último slide para un `current` (índice original). El primero se aparca detrás del último
 * en los dos últimos índices; el último delante del primero en los dos primeros (con tres slides, solo en el extremo).
 */
export function parking(current: number, count: number): { first: 0 | 1; last: 0 | -1 } {
  if (!canPark(count)) return { first: 0, last: 0 };
  // Con tres slides la fórmula de la guía aparca los dos extremos en el del medio e invierte el orden visual: ahí el
  // aparcamiento espera al propio extremo (umbrales `max(count − 3, 1)` y `min(2, count − 2)`).
  const first = Math.max(0, Math.min(1, current - Math.max(count - 3, 1))) as 0 | 1;
  const last = -Math.max(0, Math.min(1, Math.min(2, count - 2) - current)) as 0 | -1;
  return { first, last: last === 0 ? 0 : -1 };
}

/** Índices originales en el orden en que se ven (orden de `order` y, a igualdad, del DOM). */
export function visualOrder(current: number | null, count: number): number[] {
  const ids = Array.from({ length: Math.max(0, count) }, (_, i) => i);
  if (current === null || !canPark(count)) return ids;
  const { first, last } = parking(current, count);
  const order = (i: number) => (i === 0 ? first : i === count - 1 ? last : 0);
  return ids.sort((a, b) => order(a) - order(b) || a - b);
}

/** Siguiente índice original en el bucle. */
export const wrap = (index: number, count: number) => (count > 0 ? ((index % count) + count) % count : 0);
