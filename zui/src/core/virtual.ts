// Ventana virtual de una lista o rejilla con filas de alto fijo o variable: qué filas pintar para una posición de
// desplazamiento, con un margen por encima y por debajo, y el relleno que sustituye a las que no se pintan. Puro: la
// vía que pinta mide (y cachea) las alturas y llama aquí con cada desplazamiento.

export interface VirtualInput {
  count: number;
  /** Alto de cada fila: un número (fijo) o una función (medida o estimada). */
  size: number | ((index: number) => number);
  /** Desplazamiento y alto visibles del contenedor, en px. */
  scroll: number;
  viewport: number;
  /** Filas de más a cada lado. */
  overscan?: number;
}

export interface VirtualWindow {
  /** Primera fila pintada y la siguiente a la última (exclusiva). */
  start: number;
  end: number;
  /** Relleno antes y después de lo pintado, en px. */
  before: number;
  after: number;
  total: number;
}

/** Posiciones acumuladas (`offsets[i]` = inicio de la fila `i`; `offsets[count]` = total). */
export function offsets(count: number, size: number | ((index: number) => number)): number[] {
  const out = new Array<number>(count + 1);
  out[0] = 0;
  for (let i = 0; i < count; i++) out[i + 1] = out[i]! + Math.max(0, typeof size === "number" ? size : size(i));
  return out;
}

/** Fila que contiene la posición `y` (búsqueda binaria sobre `offsets`). */
export function indexAt(positions: number[], y: number): number {
  const count = positions.length - 1;
  if (count <= 0) return 0;
  let lo = 0;
  let hi = count - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (positions[mid]! <= y) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Ventana visible. Con alto fijo es un cálculo directo; con alto variable, una búsqueda binaria. */
export function virtualWindow({ count, size, scroll, viewport, overscan = 3 }: VirtualInput): VirtualWindow {
  if (count <= 0) return { start: 0, end: 0, before: 0, after: 0, total: 0 };
  const top = Math.max(0, scroll);
  if (typeof size === "number") {
    const row = Math.max(1, size);
    const total = row * count;
    const first = Math.min(count - 1, Math.floor(top / row));
    const last = Math.min(count, Math.ceil((top + Math.max(0, viewport)) / row));
    const start = Math.max(0, first - overscan);
    const end = Math.min(count, Math.max(last, first + 1) + overscan);
    return { start, end, before: start * row, after: total - end * row, total };
  }
  const pos = offsets(count, size);
  const total = pos[count]!;
  const first = indexAt(pos, top);
  const last = indexAt(pos, top + Math.max(0, viewport) - 1);
  const start = Math.max(0, first - overscan);
  const end = Math.min(count, last + 1 + overscan);
  return { start, end, before: pos[start]!, after: total - pos[end]!, total };
}
