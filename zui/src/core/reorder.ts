// Reordenar elementos de una rejilla (las miniaturas de FileUpload): mover uno de sitio, el destino de una flecha en una
// rejilla que fluye por filas (también de derecha a izquierda), las columnas que caben, la casilla más cercana al puntero
// y los textos del anuncio. Lógica pura, sin documento: el binding de React y el modo DOM la comparten.

/** Copia de `list` con el elemento de `from` llevado a `to` (los demás conservan su orden relativo). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const out = [...list];
  if (from < 0 || from >= out.length) return out;
  const target = Math.max(0, Math.min(out.length - 1, to));
  const [item] = out.splice(from, 1);
  out.splice(target, 0, item as T);
  return out;
}

/**
 * Destino de una tecla para el elemento de `index` en una rejilla de `count` elementos y `columns` columnas que se llena
 * por filas. Las flechas laterales siguen la dirección visual (en RTL, la derecha es «antes»); arriba y abajo saltan
 * una fila; Inicio y Fin van a los extremos. `null` si la tecla no mueve o el elemento ya está en ese borde.
 */
export function gridTarget(index: number, key: string, o: { count: number; columns: number; rtl?: boolean }): number | null {
  const columns = Math.max(1, Math.floor(o.columns));
  const last = o.count - 1;
  if (index < 0 || index > last) return null;
  let to: number;
  if (key === "ArrowRight") to = index + (o.rtl ? -1 : 1);
  else if (key === "ArrowLeft") to = index + (o.rtl ? 1 : -1);
  else if (key === "ArrowDown") to = index + columns;
  else if (key === "ArrowUp") to = index - columns;
  else if (key === "Home") to = 0;
  else if (key === "End") to = last;
  else return null;
  // Abajo desde la última fila incompleta no hay casilla: se queda en el último sitio (si no está ya en él).
  if (key === "ArrowDown" && to > last) to = Math.floor(index / columns) < Math.floor(last / columns) ? last : index;
  if (to < 0 || to > last || to === index) return null;
  return to;
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Columnas de una rejilla medida: cuántas casillas comparten la fila de la primera. */
export function columnsOf(rects: readonly Rect[]): number {
  if (!rects.length) return 1;
  const top = rects[0]!.top;
  let n = 0;
  for (const r of rects) {
    if (Math.abs(r.top - top) > Math.max(1, r.height / 2)) break;
    n += 1;
  }
  return Math.max(1, n);
}

/**
 * Casilla de destino para un puntero en (x, y): la que lo contiene o, si cae en un hueco, la de centro más cercano.
 * Se mide con las casillas en reposo (sin el desplazamiento del arrastre), así que no salta mientras se mueve.
 */
export function nearestIndex(x: number, y: number, rects: readonly Rect[]): number {
  let best = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const [i, r] of rects.entries()) {
    if (x >= r.left && x <= r.left + r.width && y >= r.top && y <= r.top + r.height) return i;
    const dx = x - (r.left + r.width / 2);
    const dy = y - (r.top + r.height / 2);
    const d = dx * dx + dy * dy;
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  }
  return best;
}

export interface ReorderLabels {
  /** Nombre del asa: «Reorder {name}». */
  handle: string;
  /** Instrucciones del asa (descripción). */
  hint: string;
  grabbed: string;
  moved: string;
  dropped: string;
  cancelled: string;
  /** Portada: «Cover». */
  cover: string;
  /** «Make {name} the cover» */
  makeCover: string;
  /** «{name} is now the cover» */
  coverChanged: string;
}

export const REORDER_LABELS: ReorderLabels = {
  handle: "Reorder {name}",
  hint: "Press Space to pick up, arrow keys to move, Space to drop, Escape to cancel.",
  grabbed: "{name} picked up. Position {position} of {count}. Use the arrow keys to move, Space to drop, Escape to cancel.",
  moved: "{name}, position {position} of {count}.",
  dropped: "{name} dropped at position {position} of {count}.",
  cancelled: "Reorder cancelled. {name} is back at position {position} of {count}.",
  cover: "Cover",
  makeCover: "Make {name} the cover",
  coverChanged: "{name} is now the cover.",
};
