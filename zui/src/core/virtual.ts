// Núcleo de virtualización de la suite: qué filas pintar para una posición de desplazamiento (alto fijo o medido), con
// un margen por encima y por debajo, el relleno que sustituye a las que no se pintan, las filas que no salen del
// documento (la del foco itinerante), el desplazamiento a un índice y la posición para los lectores. Puro: lo conectado
// al documento (desplazamiento, ResizeObserver, medida) está en ./virtual-runtime y ./virtual-widget, y lo usan el
// binding de React (primitives/virtual), las piezas de core/*-widget y el modo DOM.

export interface VirtualInput {
  count: number;
  /** Alto de cada fila: un número (fijo) o una función (medida o estimada). */
  size: number | ((index: number) => number);
  /** Desplazamiento y alto visibles del contenedor, en px. */
  scroll: number;
  viewport: number;
  /** Filas de más a cada lado. */
  overscan?: number;
  /** Posiciones acumuladas ya calculadas (`offsets`): con miles de filas de alto variable, se calculan una vez. */
  positions?: ReadonlyArray<number>;
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
export function virtualWindow({ count, size, scroll, viewport, overscan = 3, positions }: VirtualInput): VirtualWindow {
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
  const pos = positions && positions.length === count + 1 ? (positions as number[]) : offsets(count, size);
  const total = pos[count]!;
  const first = indexAt(pos, top);
  const last = indexAt(pos, top + Math.max(0, viewport) - 1);
  const start = Math.max(0, first - overscan);
  const end = Math.min(count, last + 1 + overscan);
  return { start, end, before: pos[start]!, after: total - pos[end]!, total };
}

/* ---------- Núcleo compartido: umbral, índices a pintar, medidas, desplazar a un índice, posición para lectores ---------- */

/**
 * ¿Se virtualiza? `option` es la prop de la pieza: `false` nunca, `true` siempre, un número es el umbral propio y sin
 * valor se usa el umbral por defecto de la pieza (`threshold`). Por debajo del umbral se pinta todo: la búsqueda del
 * navegador (Ctrl+F) y la lectura continua lo encuentran todo.
 */
export function wantsVirtual(option: boolean | number | undefined, count: number, threshold: number): boolean {
  if (option === false) return false;
  if (option === true) return count > 0;
  const limit = typeof option === "number" && Number.isFinite(option) ? Math.max(0, option) : threshold;
  return count > limit;
}

/** Lectura de `data-virtualize` del modo DOM: ausente, `""`/`"true"`, `"false"` o un umbral. */
export function virtualizeAttr(v: string | undefined): boolean | number | undefined {
  if (v === undefined) return undefined;
  if (v === "" || v === "true") return true;
  if (v === "false") return false;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Índices que se pintan: los de la ventana más los que deben seguir en el documento aunque estén fuera (la fila con
 * el foco itinerante, la que se edita, la que se arrastra), en orden y sin repetir. Así el foco sobrevive al reciclado.
 */
export function renderIndices(win: Pick<VirtualWindow, "start" | "end">, keep: ReadonlyArray<number> = []): number[] {
  const out: number[] = [];
  const extra = [...new Set(keep.filter((i) => Number.isInteger(i) && i >= 0 && (i < win.start || i >= win.end)))].sort((a, b) => a - b);
  let k = 0;
  while (k < extra.length && extra[k]! < win.start) out.push(extra[k++]!);
  for (let i = win.start; i < win.end; i++) out.push(i);
  while (k < extra.length) out.push(extra[k++]!);
  return out;
}

export type ScrollAlign = "start" | "center" | "end" | "nearest";

/**
 * Desplazamiento que deja a la vista la fila `index`. `nearest` no mueve si ya se ve entera; si no, la deja en el
 * borde más cercano. Devuelve el `scrollTop` nuevo (sin el desplazamiento propio de la lista dentro del contenedor).
 */
export function scrollForIndex(
  index: number,
  size: number | ((index: number) => number),
  count: number,
  scroll: number,
  viewport: number,
  align: ScrollAlign = "nearest",
  positions?: ReadonlyArray<number>,
): number {
  if (count <= 0) return 0;
  const i = Math.min(count - 1, Math.max(0, Math.floor(index)));
  let top: number;
  let height: number;
  let total: number;
  if (typeof size === "number") {
    height = Math.max(1, size);
    top = i * height;
    total = count * height;
  } else {
    const pos = positions && positions.length === count + 1 ? positions : offsets(count, size);
    top = pos[i]!;
    height = pos[i + 1]! - top;
    total = pos[count]!;
  }
  const max = Math.max(0, total - viewport);
  let next = scroll;
  if (align === "start") next = top;
  else if (align === "end") next = top + height - viewport;
  else if (align === "center") next = top + height / 2 - viewport / 2;
  else if (top < scroll) next = top;
  else if (top + height > scroll + viewport) next = top + height - viewport;
  return Math.round(Math.min(max, Math.max(0, next)));
}

/** Altos medidos por clave, con la estimación para lo que aún no se ha pintado (filas de alto variable). */
export interface SizeCache {
  /** Alto de la fila `index` con clave `key`: el medido o la estimación. */
  size(index: number, key: string): number;
  /** Guarda un alto medido. `true` si cambió (hay que recalcular la ventana). */
  set(key: string, height: number): boolean;
  has(key: string): boolean;
  clear(): void;
  readonly count: number;
}

export function createSizeCache(estimate: number | ((index: number) => number)): SizeCache {
  const known = new Map<string, number>();
  return {
    size: (index, key) => known.get(key) ?? (typeof estimate === "number" ? estimate : estimate(index)),
    set(key, height) {
      if (!(height > 0) || known.get(key) === height) return false;
      known.set(key, height);
      return true;
    },
    has: (key) => known.has(key),
    clear: () => known.clear(),
    get count() {
      return known.size;
    },
  };
}

/**
 * Posición de una fila para los lectores cuando no están todas en el documento. `row` (rejilla, treegrid, tabla):
 * `aria-rowindex` desde 1 más las filas de cabecera. `set` (listbox, árbol, lista): `aria-posinset` y `aria-setsize`.
 */
export function positionAttrs(kind: "row" | "set", index: number, count: number, headerRows = 1): Record<string, string> {
  return kind === "row"
    ? { "aria-rowindex": String(index + 1 + headerRows) }
    : { "aria-posinset": String(index + 1), "aria-setsize": String(count) };
}

export interface ListWindow extends VirtualWindow {
  /** Si se virtualiza (si no, `indices` son todas las filas y los rellenos valen 0). */
  virtual: boolean;
  /** Índices que se pintan, en orden (ventana más los fijados). */
  indices: number[];
}

/**
 * Lo que pinta una lista: con `virtual` falso, todas las filas; si no, la ventana visible más las filas fijadas
 * (`keep`). Es lo que usan el binding de React y el modo DOM de cada pieza virtualizada.
 */
export function listWindow(input: VirtualInput & { virtual: boolean; keep?: ReadonlyArray<number> }): ListWindow {
  const { virtual, keep, ...rest } = input;
  if (!virtual) {
    const all = Array.from({ length: Math.max(0, rest.count) }, (_, i) => i);
    return { virtual: false, indices: all, start: 0, end: all.length, before: 0, after: 0, total: 0 };
  }
  const win = virtualWindow(rest);
  return { ...win, virtual: true, indices: renderIndices(win, keep) };
}

/** Misma ventana (para no volver a pintar si el desplazamiento no la cambia). */
export const sameWindow = (a: VirtualWindow | null | undefined, b: VirtualWindow | null | undefined): boolean =>
  !!a && !!b && a.start === b.start && a.end === b.end && a.before === b.before && a.after === b.after;
