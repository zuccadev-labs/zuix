// Paginación: página acotada y rango con huecos. La misma aritmética para React y para el modo DOM.

/** Total de páginas válido: entero ≥ 1 (un valor no numérico cuenta como una sola página). */
export function pageTotal(count: number): number {
  return Number.isFinite(count) ? Math.max(1, Math.floor(count)) : 1;
}

/** Página dentro de [1, count], redondeada; un valor no numérico devuelve `fallback` (acotado). */
export function clampPage(page: number, count: number, fallback = 1): number {
  const total = pageTotal(count);
  const wanted = Number.isFinite(page)
    ? Math.round(page)
    : page === Number.POSITIVE_INFINITY
      ? total
      : Number.isFinite(fallback)
        ? Math.round(fallback)
        : 1;
  return Math.min(Math.max(1, wanted), total);
}

/** Rango con huecos: 1 … 4 5 6 … 20. Un hueco se representa con 0. */
export function pageRange(page: number, count: number, siblings: number): number[] {
  const slots = siblings * 2 + 5;
  if (count <= slots) return Array.from({ length: count }, (_, i) => i + 1);
  const left = Math.max(page - siblings, 1);
  const right = Math.min(page + siblings, count);
  const edge = siblings * 2 + 3;
  if (!(left > 2)) return [...Array.from({ length: edge }, (_, i) => i + 1), 0, count];
  if (!(right < count - 1)) return [1, 0, ...Array.from({ length: edge }, (_, i) => count - edge + 1 + i)];
  return [1, 0, ...Array.from({ length: right - left + 1 }, (_, i) => left + i), 0, count];
}
