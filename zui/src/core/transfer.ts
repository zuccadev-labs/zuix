// Lista de transferencia (TransferList): dos listas, la de disponibles y la de elegidos, y mover entre ellas lo
// marcado o todo lo visible. El valor es la lista de elegidos, en el orden en que llegaron. Puro, sin documento.

import { fold } from "./search";

export interface TransferItem {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

/** Disponibles (en el orden de `items`) y elegidos (en el orden de `value`); un valor que no está en `items` se ignora. */
export function splitTransfer(
  items: readonly TransferItem[],
  value: readonly string[],
): { source: TransferItem[]; target: TransferItem[] } {
  const chosen = new Set(value);
  const byValue = new Map(items.map((i) => [i.value, i]));
  return {
    source: items.filter((i) => !chosen.has(i.value)),
    target: [...new Set(value)].map((v) => byValue.get(v)).filter((i): i is TransferItem => !!i),
  };
}

/** Lo que muestra una lista con el filtro `query` (sin acentos ni mayúsculas, en la etiqueta y la descripción). */
export function filterTransfer(list: readonly TransferItem[], query: string): TransferItem[] {
  const q = fold(query.trim());
  if (!q) return [...list];
  return list.filter((i) => fold(`${i.label} ${i.description ?? ""}`).includes(q));
}

/**
 * Mueve `keys` hacia la lista de elegidos (`"target"`) o de vuelta a disponibles (`"source"`). Los deshabilitados no
 * se mueven. Lo que se elige se añade al final, en el orden de `items`.
 */
export function moveTransfer(
  items: readonly TransferItem[],
  value: readonly string[],
  keys: Iterable<string>,
  to: "source" | "target",
): string[] {
  const movable = new Set([...keys].filter((k) => items.some((i) => i.value === k && !i.disabled)));
  const current = splitTransfer(items, value).target.map((i) => i.value);
  if (to === "source") return current.filter((v) => !movable.has(v));
  const have = new Set(current);
  return [...current, ...items.filter((i) => movable.has(i.value) && !have.has(i.value)).map((i) => i.value)];
}

/** Marcar con Mayús: el rango entre el ancla y `to` en el orden visible (sin los deshabilitados). */
export function rangeTransfer(visible: readonly TransferItem[], anchor: string | null, to: string): string[] {
  const a = anchor ? visible.findIndex((i) => i.value === anchor) : -1;
  const b = visible.findIndex((i) => i.value === to);
  if (b < 0) return [];
  const [from, end] = a < 0 ? [b, b] : [Math.min(a, b), Math.max(a, b)];
  return visible
    .slice(from, end + 1)
    .filter((i) => !i.disabled)
    .map((i) => i.value);
}
