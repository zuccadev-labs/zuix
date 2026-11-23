// Deshacer y rehacer por instantáneas: se guarda el estado anterior a cada cambio (con un modelo inmutable cuesta
// poco, porque los nodos que no cambian se comparten). Los cambios seguidos con la misma clave dentro de una ventana
// de tiempo (mover con el teclado, teclear una etiqueta) se funden en uno. Puro, con reloj inyectable.

export interface UndoStack<T> {
  /** Guarda `before` (el estado previo a un cambio). Vacía lo rehacible. */
  record(before: T, key?: string): void;
  /** Devuelve el estado al que volver y guarda `current` para rehacer; `null` si no hay nada. */
  undo(current: T): T | null;
  /** Devuelve el estado rehecho y guarda `current` para deshacer; `null` si no hay nada. */
  redo(current: T): T | null;
  /** Corta la fusión: el próximo `record` abre un paso nuevo aunque lleve la misma clave. */
  seal(): void;
  clear(): void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly size: number;
}

export interface UndoOptions {
  /** Pasos guardados como máximo. Por defecto 100. */
  limit?: number;
  /** Ventana de fusión en ms. Por defecto 800. */
  merge?: number;
  now?: () => number;
}

export function createUndoStack<T>(o: UndoOptions = {}): UndoStack<T> {
  const limit = Math.max(1, Math.floor(o.limit ?? 100) || 100);
  const merge = Math.max(0, o.merge ?? 800);
  const now = o.now ?? (() => Date.now());
  let past: T[] = [];
  let future: T[] = [];
  let lastKey: string | undefined;
  let lastAt = Number.NEGATIVE_INFINITY;
  return {
    record(before, key) {
      const t = now();
      const fuse = key !== undefined && key === lastKey && t - lastAt <= merge && past.length > 0;
      if (!fuse) {
        past.push(before);
        if (past.length > limit) past = past.slice(past.length - limit);
      }
      future = [];
      lastKey = key;
      lastAt = t;
    },
    undo(current) {
      const prev = past.pop();
      if (prev === undefined) return null;
      future.push(current);
      lastKey = undefined;
      return prev;
    },
    redo(current) {
      const next = future.pop();
      if (next === undefined) return null;
      past.push(current);
      lastKey = undefined;
      return next;
    },
    seal() {
      lastKey = undefined;
    },
    clear() {
      past = [];
      future = [];
      lastKey = undefined;
    },
    get canUndo() {
      return past.length > 0;
    },
    get canRedo() {
      return future.length > 0;
    },
    get size() {
      return past.length;
    },
  };
}
