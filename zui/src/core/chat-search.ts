// Búsqueda en una conversación (ChatSearch): las coincidencias de una consulta en una lista de textos (sin mayúsculas
// y, si se pide, sin acentos), el paso a la siguiente o la anterior dando la vuelta y el texto del contador. Puro.
import { highlightParts } from "./format";

export interface TextMatch {
  /** Índice del texto (el mensaje) en la lista. */
  index: number;
  /** Posición en el texto (unidades de UTF-16, como `Range`), fin exclusivo. */
  start: number;
  end: number;
}

export interface MatchOptions {
  ignoreAccents?: boolean;
  matchCase?: boolean;
}

/** Coincidencias de `query` en cada texto, en orden de lectura. Vacía con una consulta en blanco. */
export function findMatches(texts: readonly string[], query: string, options: MatchOptions = {}): TextMatch[] {
  const q = query.trim();
  if (!q) return [];
  const out: TextMatch[] = [];
  texts.forEach((text, index) => {
    let at = 0;
    for (const part of highlightParts(text ?? "", q, { ignoreCase: !options.matchCase, ignoreAccents: options.ignoreAccents ?? true })) {
      if (part.match) out.push({ index, start: at, end: at + part.text.length });
      at += part.text.length;
    }
  });
  return out;
}

/** Siguiente (`+1`) o anterior (`-1`) coincidencia, dando la vuelta; -1 si no hay ninguna. */
export function stepMatch(current: number, total: number, delta: 1 | -1): number {
  if (total <= 0) return -1;
  if (current < 0 || current >= total) return delta > 0 ? 0 : total - 1;
  return (current + delta + total) % total;
}

/** Al cambiar la consulta, la coincidencia que se queda: la primera en el mensaje que se veía o tras él. */
export function nearestMatch(matches: readonly TextMatch[], fromIndex: number): number {
  if (!matches.length) return -1;
  const at = matches.findIndex((m) => m.index >= fromIndex);
  return Math.max(at, 0);
}

/** Contador «{current} of {total}» (con la plantilla dada) o el texto de sin resultados. */
export function countText(current: number, total: number, template: string, none: string): string {
  if (total <= 0) return none;
  return template.replace("{current}", String(Math.max(1, current + 1))).replace("{total}", String(total));
}
