// Selección de filas (DataTable): alternar una, rango con Mayús, seleccionar todo lo visible y estado de la casilla de
// cabecera. Claves como cadenas o números; el orden de la selección es el de las filas. La misma aritmética para React y
// para el modo DOM. Sin documento.

export type RowKey = string | number;
export type HeaderState = "checked" | "unchecked" | "indeterminate";

/** Selección ordenada según `order` (las claves que no están en `order` van al final, en su orden). */
function ordered(selected: Iterable<RowKey>, order: ReadonlyArray<RowKey>): RowKey[] {
  const set = new Set(selected);
  const out = order.filter((k) => set.has(k));
  for (const k of set) if (!order.includes(k)) out.push(k);
  return out;
}

/** Alterna una clave. */
export function toggleKey(selected: ReadonlyArray<RowKey>, key: RowKey, order: ReadonlyArray<RowKey> = []): RowKey[] {
  const set = new Set(selected);
  if (set.has(key)) set.delete(key);
  else set.add(key);
  return ordered(set, order);
}

/**
 * Rango con Mayús: marca (o desmarca, si `target` estaba marcada) todas las claves entre `anchor` y `target` en el orden
 * visible, solo las seleccionables. Sin ancla visible, equivale a alternar `target`.
 */
export function rangeKeys(
  selected: ReadonlyArray<RowKey>,
  order: ReadonlyArray<RowKey>,
  anchor: RowKey | null | undefined,
  target: RowKey,
  selectable: (key: RowKey) => boolean = () => true,
): RowKey[] {
  const from = anchor === null || anchor === undefined ? -1 : order.indexOf(anchor);
  const to = order.indexOf(target);
  if (from < 0 || to < 0) return toggleKey(selected, target, order);
  const turnOn = !selected.includes(target);
  const set = new Set(selected);
  for (let i = Math.min(from, to); i <= Math.max(from, to); i++) {
    const k = order[i]!;
    if (!selectable(k)) continue;
    if (turnOn) set.add(k);
    else set.delete(k);
  }
  return ordered(set, order);
}

/** Estado de la casilla «seleccionar todo» frente a las filas visibles y seleccionables. */
export function headerState(visible: ReadonlyArray<RowKey>, selected: ReadonlyArray<RowKey>): HeaderState {
  if (!visible.length) return "unchecked";
  const set = new Set(selected);
  const on = visible.filter((k) => set.has(k)).length;
  return on === 0 ? "unchecked" : on === visible.length ? "checked" : "indeterminate";
}

/**
 * La casilla de cabecera: si todas las visibles están marcadas, las desmarca; si no, las marca todas. Lo seleccionado
 * fuera de lo visible (otras páginas) se conserva.
 */
export function toggleAll(selected: ReadonlyArray<RowKey>, visible: ReadonlyArray<RowKey>, order: ReadonlyArray<RowKey> = []): RowKey[] {
  const set = new Set(selected);
  if (headerState(visible, selected) === "checked") for (const k of visible) set.delete(k);
  else for (const k of visible) set.add(k);
  return ordered(set, order.length ? order : [...new Set([...selected, ...visible])]);
}

/** Filas de una página (desde 1) y el rango «desde–hasta» (desde 1; 0–0 sin filas). */
export function pageSlice(total: number, page: number, size: number): { start: number; end: number; from: number; to: number } {
  const per = Number.isFinite(size) && size > 0 ? Math.floor(size) : Math.max(0, total);
  if (!per || total <= 0) return { start: 0, end: 0, from: 0, to: 0 };
  const pages = Math.max(1, Math.ceil(total / per));
  const p = Math.min(Math.max(1, Math.round(Number.isFinite(page) ? page : 1)), pages);
  const start = (p - 1) * per;
  const end = Math.min(total, start + per);
  return { start, end, from: start + 1, to: end };
}

/** Número de páginas para `total` filas de `size` (al menos 1). */
export function pageCountOf(total: number, size: number): number {
  return Number.isFinite(size) && size > 0 && total > 0 ? Math.ceil(total / Math.floor(size)) : 1;
}
