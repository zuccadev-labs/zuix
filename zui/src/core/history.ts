// Historial de órdenes de una terminal: ↑ y ↓ lo recorren y lo que la persona estaba escribiendo (el borrador) se
// conserva para volver a él al bajar del todo. Una orden igual a la anterior no se repite; las vacías no se guardan.
// Puro y sin documento: guarda su estado en el objeto que devuelve.

export interface CommandHistory {
  /** Guarda una orden ejecutada y vuelve al final (al borrador). */
  push(command: string): void;
  /** Orden anterior; la primera vez guarda `draft`. `null` si ya está en la más antigua. */
  previous(draft: string): string | null;
  /** Orden siguiente o, al pasar de la más reciente, el borrador. `null` si ya está en el borrador. */
  next(): string | null;
  /** Vuelve al final sin cambiar nada (la persona editó el texto). */
  reset(): void;
  readonly items: readonly string[];
  /** Posición actual: `items.length` es el borrador. */
  readonly index: number;
}

export function createHistory(initial: readonly string[] = [], max = 200): CommandHistory {
  const size = Math.max(1, Math.floor(max) || 200);
  let items = initial.filter((c) => c.trim()).slice(-size);
  let index = items.length;
  let draft = "";
  return {
    push(command) {
      if (command.trim() && items[items.length - 1] !== command) items = [...items, command].slice(-size);
      index = items.length;
      draft = "";
    },
    previous(current) {
      if (index === 0) return null;
      if (index === items.length) draft = current;
      index -= 1;
      return items[index]!;
    },
    next() {
      if (index >= items.length) return null;
      index += 1;
      return index === items.length ? draft : items[index]!;
    },
    reset() {
      index = items.length;
    },
    get items() {
      return items;
    },
    get index() {
      return index;
    },
  };
}

/** Prefijo común más largo de varias opciones (lo que Tab completa cuando hay más de una). */
export function commonPrefix(options: readonly string[]): string {
  if (!options.length) return "";
  let prefix = options[0]!;
  for (const o of options.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < o.length && prefix[i] === o[i]) i++;
    prefix = prefix.slice(0, i);
    if (!prefix) break;
  }
  return prefix;
}

/**
 * Qué hace Tab con lo escrito y las opciones de completado: una sola opción la escribe; varias, el prefijo común
 * (si alarga lo escrito) y la lista para mostrarla.
 */
export function completeInput(input: string, options: readonly string[]): { value: string; list: string[] } {
  const unique = [...new Set(options.filter(Boolean))];
  if (!unique.length) return { value: input, list: [] };
  if (unique.length === 1) return { value: unique[0]!, list: [] };
  const prefix = commonPrefix(unique);
  return { value: prefix.length > input.length && prefix.startsWith(input) ? prefix : input, list: unique };
}
