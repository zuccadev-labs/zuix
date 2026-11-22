// Filtro de una consola de logs: por niveles y por texto, con contadores por nivel (lo que muestran los filtros) y
// los tramos que coinciden en cada mensaje (lo que se resalta). Sin mayúsculas en la búsqueda. Puro y sin documento.

export type LogLevel = "debug" | "info" | "warn" | "error";
export const LOG_LEVELS: readonly LogLevel[] = ["debug", "info", "warn", "error"];

export interface LogEntry {
  /** Identificador estable (clave de la fila). Sin él, la posición. */
  id?: string | number;
  /** Instante: ISO, ms o Date. */
  time?: number | string | Date;
  level?: LogLevel;
  /** Origen (servicio, módulo). */
  source?: string;
  message: string;
}

export const levelOf = (entry: Pick<LogEntry, "level">): LogLevel =>
  entry.level && (LOG_LEVELS as readonly string[]).includes(entry.level) ? entry.level : "info";

export interface LogFilter {
  levels?: ReadonlySet<LogLevel> | readonly LogLevel[];
  query?: string;
}

export interface FilteredLog {
  /** Posiciones de las entradas que pasan el filtro. */
  rows: number[];
  /** Entradas por nivel que pasan el texto (sin contar el filtro de niveles: es lo que dice cada filtro). */
  counts: Record<LogLevel, number>;
  /** Entradas que pasan los dos filtros. */
  matches: number;
}

const lower = (s: string) => s.toLowerCase();

/** ¿Contiene el texto la consulta (sin mayúsculas)? Una consulta vacía coincide con todo. */
export const logMatches = (entry: Pick<LogEntry, "message" | "source">, query: string) => {
  const q = lower(query.trim());
  return !q || lower(entry.message).includes(q) || (entry.source !== undefined && lower(entry.source).includes(q));
};

export function filterLogs(entries: readonly LogEntry[], { levels, query = "" }: LogFilter = {}): FilteredLog {
  const wanted = levels ? new Set(levels) : null;
  const counts: Record<LogLevel, number> = { debug: 0, info: 0, warn: 0, error: 0 };
  const rows: number[] = [];
  entries.forEach((entry, i) => {
    if (!logMatches(entry, query)) return;
    const level = levelOf(entry);
    counts[level]++;
    if (!wanted || wanted.has(level)) rows.push(i);
  });
  return { rows, counts, matches: rows.length };
}

/**
 * Tramos `[inicio, fin)` de `text` que coinciden con la consulta (sin mayúsculas, sin solaparse). Si pasar a
 * minúsculas cambia la longitud del texto (algunas letras fuera del latín), no se resalta: las posiciones no casarían.
 */
export function matchRanges(text: string, query: string): [number, number][] {
  const q = lower(query.trim());
  if (!q) return [];
  const hay = lower(text);
  if (hay.length !== text.length) return [];
  const out: [number, number][] = [];
  let from = 0;
  for (;;) {
    const at = hay.indexOf(q, from);
    if (at < 0) break;
    out.push([at, at + q.length]);
    from = at + q.length;
  }
  return out;
}

/** Trozos de un texto marcando las coincidencias (para pintar `<mark>` sin escribir marcado). */
export function markParts(text: string, query: string): { text: string; match: boolean }[] {
  const ranges = matchRanges(text, query);
  if (!ranges.length) return [{ text, match: false }];
  const parts: { text: string; match: boolean }[] = [];
  let at = 0;
  for (const [start, end] of ranges) {
    if (start > at) parts.push({ text: text.slice(at, start), match: false });
    parts.push({ text: text.slice(start, end), match: true });
    at = end;
  }
  if (at < text.length) parts.push({ text: text.slice(at), match: false });
  return parts;
}

/** Línea de texto plano de una entrada (copiar y descargar): `hora nivel [origen] mensaje`. */
export const logLine = (entry: LogEntry, time = "") =>
  [time, levelOf(entry).toUpperCase().padEnd(5), entry.source ? `[${entry.source}]` : "", entry.message].filter(Boolean).join(" ");
