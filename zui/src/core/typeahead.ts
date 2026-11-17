import { fold } from "./search";

export interface Typeahead {
  /** Índice de la etiqueta a la que lleva la tecla, o -1. `current` es el índice activo (-1 si no hay). */
  (labels: ReadonlyArray<string>, key: string, current: number): number;
  /** Verdadero mientras hay una búsqueda en curso: el espacio cuenta como carácter y no como activación. */
  pending(): boolean;
  reset(): void;
}

/**
 * Búsqueda por letra (APG): lo tecleado dentro de `timeout` ms forma el prefijo; repetir una letra recorre las
 * etiquetas que empiezan por ella. Compara sin mayúsculas ni acentos.
 */
export function createTypeahead(timeout = 1000, now: () => number = Date.now): Typeahead {
  let typed = "";
  let at = 0;
  const pending = () => typed !== "" && now() - at <= timeout;
  const search = ((labels, key, current) => {
    typed = pending() ? typed + fold(key) : fold(key);
    at = now();
    const repeated = [...typed].every((ch) => ch === typed[0]);
    const query = repeated ? typed[0]! : typed;
    // Una letra (o la misma repetida) avanza desde la siguiente; una palabra busca desde la actual.
    const from = repeated ? current + 1 : Math.max(current, 0);
    const count = labels.length;
    for (let moved = 0; moved < count; moved++) {
      const index = (from + moved) % count;
      if (fold(labels[index]!.trim()).startsWith(query)) return index;
    }
    return -1;
  }) as Typeahead;
  search.pending = pending;
  search.reset = () => {
    typed = "";
  };
  return search;
}

/** Tecla que escribe un carácter (sin modificadores de atajo). */
export const isPrintable = (event: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean }) =>
  typeof event.key === "string" && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
