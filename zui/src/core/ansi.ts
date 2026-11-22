// Salida de terminal con secuencias ANSI: un analizador de SGR (colores de 16, 256 y 24 bits, negrita, atenuado,
// cursiva, subrayado, inverso, tachado), enlaces OSC 8 (solo http y https), retorno de carro (reescribe la línea: barras
// de progreso), borrado de línea (`ESC[2K`, `ESC[K`) y una pantalla de líneas con límite que recibe la salida a trozos
// (una secuencia partida entre dos trozos se completa con el siguiente). El resto de secuencias se descarta sin
// pintar. Devuelve datos (trozos con estilo); quien pinta construye nodos, nunca marcado. Puro y sin documento.

/** Color ANSI: índice de la paleta (0–255) o RGB de 24 bits. */
export type AnsiColor = number | readonly [number, number, number];

export interface AnsiStyle {
  fg?: AnsiColor;
  bg?: AnsiColor;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  inverse?: boolean;
  strike?: boolean;
  /** Destino de un enlace OSC 8 (solo http y https). */
  link?: string;
}

export interface AnsiSpan {
  text: string;
  style: AnsiStyle;
}

export interface AnsiLine {
  /** Identificador estable (crece con cada línea nueva): clave para pintar y memorizar. */
  id: number;
  spans: AnsiSpan[];
}

const EMPTY: AnsiStyle = Object.freeze({});

/** RGB de un índice de la paleta de 256 (16–231 cubo 6×6×6, 232–255 grises). `null` para 0–15 (van por tokens). */
export function paletteRgb(index: number): [number, number, number] | null {
  if (!Number.isInteger(index) || index < 16 || index > 255) return null;
  if (index >= 232) {
    const v = 8 + (index - 232) * 10;
    return [v, v, v];
  }
  const i = index - 16;
  const level = (n: number) => (n === 0 ? 0 : 55 + n * 40);
  return [level(Math.floor(i / 36)), level(Math.floor(i / 6) % 6), level(i % 6)];
}

const safeLink = (url: string) => {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : undefined;
  } catch {
    return undefined;
  }
};

const byte = (n: number | undefined) => (n !== undefined && Number.isInteger(n) && n >= 0 && n <= 255 ? n : null);

/** Aplica los parámetros de una secuencia SGR (`ESC[…m`) a un estilo. Devuelve un estilo nuevo. */
export function applySgr(style: AnsiStyle, params: readonly number[]): AnsiStyle {
  const next: AnsiStyle = { ...style };
  const list = params.length ? params : [0];
  for (let i = 0; i < list.length; i++) {
    const p = list[i]!;
    if (p === 0) {
      for (const key of Object.keys(next) as (keyof AnsiStyle)[]) if (key !== "link") delete next[key];
    } else if (p === 1) next.bold = true;
    else if (p === 2) next.dim = true;
    else if (p === 3) next.italic = true;
    else if (p === 4) next.underline = true;
    else if (p === 7) next.inverse = true;
    else if (p === 9) next.strike = true;
    else if (p === 22) {
      delete next.bold;
      delete next.dim;
    } else if (p === 23) delete next.italic;
    else if (p === 24) delete next.underline;
    else if (p === 27) delete next.inverse;
    else if (p === 29) delete next.strike;
    else if (p >= 30 && p <= 37) next.fg = p - 30;
    else if (p >= 90 && p <= 97) next.fg = p - 90 + 8;
    else if (p === 39) delete next.fg;
    else if (p >= 40 && p <= 47) next.bg = p - 40;
    else if (p >= 100 && p <= 107) next.bg = p - 100 + 8;
    else if (p === 49) delete next.bg;
    else if (p === 38 || p === 48) {
      const key = p === 38 ? "fg" : "bg";
      if (list[i + 1] === 5) {
        const n = byte(list[i + 2]);
        if (n !== null) next[key] = n;
        i += 2;
      } else if (list[i + 1] === 2) {
        const [r, g, b] = [byte(list[i + 2]), byte(list[i + 3]), byte(list[i + 4])];
        if (r !== null && g !== null && b !== null) next[key] = [r, g, b];
        i += 4;
      }
    }
  }
  return next;
}

/** Clave de un estilo para comparar y fusionar trozos vecinos. */
export const styleKey = (s: AnsiStyle) =>
  [
    s.fg === undefined ? "" : String(s.fg),
    s.bg === undefined ? "" : String(s.bg),
    s.bold ? "b" : "",
    s.dim ? "d" : "",
    s.italic ? "i" : "",
    s.underline ? "u" : "",
    s.inverse ? "r" : "",
    s.strike ? "s" : "",
    s.link ?? "",
  ].join("|");

interface Cell {
  ch: string;
  style: AnsiStyle;
}

/** Celdas de la línea en curso → trozos con estilo (fusiona los vecinos iguales). */
function toSpans(cells: readonly Cell[]): AnsiSpan[] {
  const spans: AnsiSpan[] = [];
  let key = "";
  for (const cell of cells) {
    const k = styleKey(cell.style);
    const last = spans[spans.length - 1];
    if (last && k === key) last.text += cell.ch;
    else {
      spans.push({ text: cell.ch, style: cell.style });
      key = k;
    }
  }
  return spans;
}

export interface AnsiScreen {
  /** Añade un trozo de salida (puede cortar una línea o una secuencia por la mitad). */
  write(chunk: string): void;
  /** Líneas terminadas más la que está en curso (si tiene algo). */
  lines(): AnsiLine[];
  /** Texto plano de todo lo que hay en pantalla. */
  text(): string;
  clear(): void;
  /** Líneas que se descartaron por el límite desde la última limpieza. */
  readonly dropped: number;
}

/**
 * Pantalla de líneas con límite (`maxLines`, por defecto 5000; las más antiguas se descartan). `\n` cierra la
 * línea, `\r` vuelve al principio (lo que se escribe después pisa lo anterior), `\b` retrocede una celda, `\t`
 * avanza a la siguiente columna múltiplo de 8 y `ESC[2K`/`ESC[K` borran la línea o el resto de ella.
 */
export function createAnsiScreen(maxLines = 5000): AnsiScreen {
  const limit = Math.max(1, Math.floor(maxLines) || 5000);
  let done: AnsiLine[] = [];
  let cells: Cell[] = [];
  let cursor = 0;
  let style: AnsiStyle = EMPTY;
  let pending = "";
  let seq = 0;
  let dropped = 0;
  // La línea en curso se reconstruye solo si cambió (pintar no repite el trabajo).
  let current: AnsiLine | null = null;
  let currentId = seq++;

  const put = (ch: string) => {
    const cell = { ch, style };
    if (cursor < cells.length) cells[cursor] = cell;
    else {
      while (cells.length < cursor) cells.push({ ch: " ", style: EMPTY });
      cells.push(cell);
    }
    cursor++;
    current = null;
  };
  const newline = () => {
    done.push({ id: currentId, spans: toSpans(cells) });
    currentId = seq++;
    cells = [];
    cursor = 0;
    current = null;
    // Se recorta por tandas (no en cada línea): con miles de líneas por segundo, copiar la lista entera en cada salto
    // de línea sería cuadrático. `lines()` devuelve siempre como mucho `limit`.
    if (done.length > limit + Math.max(64, limit >> 2)) {
      const extra = done.length - limit;
      done = done.slice(extra);
      dropped += extra;
    }
  };

  const write = (chunk: string) => {
    const text = pending + chunk;
    pending = "";
    let i = 0;
    while (i < text.length) {
      const ch = text[i]!;
      if (ch === "\x1b") {
        const next = text[i + 1];
        if (next === undefined) {
          pending = text.slice(i);
          return;
        }
        if (next === "[") {
          // CSI: parámetros y un byte final entre @ y ~.
          let j = i + 2;
          while (j < text.length && !/[@-~]/.test(text[j]!)) j++;
          if (j >= text.length) {
            pending = text.slice(i);
            return;
          }
          const body = text.slice(i + 2, j);
          const final = text[j]!;
          if (final === "m" && /^[\d;:]*$/.test(body))
            style = applySgr(style, body === "" ? [] : body.split(/[;:]/).map((n) => (n === "" ? 0 : Number(n))));
          else if (final === "K") {
            const mode = body === "" ? 0 : Number(body);
            if (mode === 2) cells = [];
            else if (mode === 1) cells = cells.map((c, k) => (k < cursor ? { ch: " ", style: EMPTY } : c));
            else cells = cells.slice(0, cursor);
            current = null;
          } else if (final === "G") cursor = Math.max(0, (Number(body) || 1) - 1);
          i = j + 1;
          continue;
        }
        if (next === "]") {
          // OSC: hasta BEL o ESC \ (ST).
          let j = i + 2;
          let end = -1;
          let size = 0;
          while (j < text.length) {
            if (text[j] === "\x07") {
              end = j;
              size = 1;
              break;
            }
            if (text[j] === "\x1b" && text[j + 1] === "\\") {
              end = j;
              size = 2;
              break;
            }
            if (text[j] === "\x1b" && text[j + 1] === undefined) break;
            j++;
          }
          if (end < 0) {
            pending = text.slice(i);
            return;
          }
          const body = text.slice(i + 2, end);
          const m = /^8;[^;]*;(.*)$/s.exec(body);
          if (m) {
            const url = m[1] ? safeLink(m[1]) : undefined;
            style = { ...style };
            if (url) style.link = url;
            else delete style.link;
          }
          i = end + size;
          continue;
        }
        // Otra secuencia de dos bytes (ESC 7, ESC c…): se descarta.
        i += 2;
        continue;
      }
      if (ch === "\n") newline();
      else if (ch === "\r") {
        if (text[i + 1] === "\n") {
          i++;
          newline();
        } else cursor = 0;
      } else if (ch === "\b") cursor = Math.max(0, cursor - 1);
      else if (ch === "\t") {
        const to = (Math.floor(cursor / 8) + 1) * 8;
        while (cursor < to) put(" ");
      } else if (ch === "\x07" || (ch < " " && ch !== "\t")) {
        // Otros caracteres de control: no se pintan.
      } else put(ch);
      i++;
    }
  };

  return {
    write,
    lines() {
      const kept = done.length > limit ? done.slice(done.length - limit) : done;
      if (!cells.length) return kept;
      current ??= { id: currentId, spans: toSpans(cells) };
      return [...kept, current];
    },
    text() {
      const kept = done.length > limit ? done.slice(done.length - limit) : done;
      const all = cells.length ? [...kept, { id: currentId, spans: toSpans(cells) }] : kept;
      return all.map((l) => l.spans.map((s) => s.text).join("")).join("\n");
    },
    clear() {
      done = [];
      cells = [];
      cursor = 0;
      current = null;
      dropped = 0;
      currentId = seq++;
    },
    get dropped() {
      return dropped + Math.max(0, done.length - limit);
    },
  };
}

/** Trozos con estilo de un texto completo (cada línea, sus trozos). */
export function parseAnsi(text: string): AnsiSpan[][] {
  const screen = createAnsiScreen(Number.MAX_SAFE_INTEGER);
  screen.write(text);
  return screen.lines().map((l) => l.spans);
}

/** Texto sin secuencias ANSI. */
export const stripAnsi = (text: string) =>
  parseAnsi(text)
    .map((spans) => spans.map((s) => s.text).join(""))
    .join("\n");
