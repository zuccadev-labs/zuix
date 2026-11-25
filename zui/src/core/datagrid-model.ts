// Modelo de filas de DataTable para las capacidades de rejilla: agrupación por columna con agregados, datos en árbol,
// fila de detalle desplegable, orden de columnas, columnas fijadas a los dos lados, validación de la edición y el
// formato de las fechas con el idioma de la tabla. Puro y sin documento: lo usan el binding de React y el modo DOM, y
// la ventana virtual recorre las filas planas que salen de aquí.

export type RowKey = string | number;
export type Primitive = string | number | boolean | Date | null | undefined;
export type AggregateKind = "sum" | "avg" | "min" | "max" | "count";

/** Una fila pintable de la tabla, en orden: cabecera de grupo, fila de datos o su detalle. */
export type GridRow<T> =
  | {
      kind: "group";
      key: string;
      depth: number;
      /** Columna y valor por los que se agrupa. */
      column: string;
      value: Primitive;
      rows: T[];
      expanded: boolean;
    }
  | {
      kind: "row";
      key: RowKey;
      row: T;
      depth: number;
      /** Con datos en árbol: si tiene hijos, si están abiertos y quién es su padre. */
      hasChildren: boolean;
      expanded: boolean;
      parent: RowKey | null;
      /** Posición entre sus hermanos (aria-posinset) y cuántos son (aria-setsize). */
      pos: number;
      size: number;
    }
  | { kind: "detail"; key: string; rowKey: RowKey; row: T };

/** Valor numérico de un agregado (o `null` si no hay números). `count` cuenta las filas. */
export function aggregate(values: ReadonlyArray<Primitive>, kind: AggregateKind): number | null {
  if (kind === "count") return values.length;
  const nums = values
    .map((v) =>
      v instanceof Date ? v.getTime() : typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : Number.NaN,
    )
    .filter((n) => Number.isFinite(n));
  if (!nums.length) return null;
  if (kind === "sum") return nums.reduce((a, b) => a + b, 0);
  if (kind === "avg") return nums.reduce((a, b) => a + b, 0) / nums.length;
  if (kind === "min") return Math.min(...nums);
  return Math.max(...nums);
}

const groupId = (path: ReadonlyArray<Primitive>) =>
  path.map((v) => (v instanceof Date ? v.toISOString() : v === null || v === undefined ? "∅" : String(v))).join("␟");

export interface FlattenInput<T> {
  rows: ReadonlyArray<T>;
  keyOf: (row: T) => RowKey;
  /** Columnas por las que se agrupa, de fuera a dentro. */
  groupBy?: ReadonlyArray<string>;
  /** Valor de una fila en una columna (para agrupar). */
  valueOf?: (row: T, column: string) => Primitive;
  /** Grupos plegados (por su clave de `GridRow`); por defecto todos abiertos. */
  collapsedGroups?: ReadonlySet<string>;
  /** Hijos de una fila (datos en árbol). */
  childrenOf?: (row: T) => ReadonlyArray<T> | undefined;
  /** Filas del árbol abiertas. */
  expandedRows?: ReadonlySet<RowKey>;
  /** Filas con el detalle abierto. */
  openDetails?: ReadonlySet<RowKey>;
}

/**
 * Filas planas en orden de lectura: grupos (con sus filas debajo si están abiertos), filas del árbol (con sus hijos si
 * están abiertas) y, tras cada fila con el detalle abierto, su detalle. Lo que no se ve (un grupo plegado, una rama
 * cerrada) no está: es la lista que recorre la ventana virtual y el teclado.
 */
export function flattenGrid<T>(input: FlattenInput<T>): GridRow<T>[] {
  const out: GridRow<T>[] = [];
  const groups = input.groupBy?.filter(Boolean) ?? [];
  const value = input.valueOf ?? (() => undefined);
  const pushRows = (list: ReadonlyArray<T>, depth: number, parent: RowKey | null) => {
    list.forEach((row, i) => {
      const key = input.keyOf(row);
      const kids = input.childrenOf?.(row);
      const hasChildren = Boolean(kids?.length);
      const expanded = hasChildren && Boolean(input.expandedRows?.has(key));
      out.push({ kind: "row", key, row, depth, hasChildren, expanded, parent, pos: i + 1, size: list.length });
      if (input.openDetails?.has(key)) out.push({ kind: "detail", key: `${key}:detail`, rowKey: key, row });
      if (expanded && kids) pushRows(kids, depth + 1, key);
    });
  };
  const walk = (list: ReadonlyArray<T>, level: number, path: Primitive[]) => {
    if (level >= groups.length) {
      pushRows(list, level, null);
      return;
    }
    const column = groups[level]!;
    const buckets = new Map<string, { value: Primitive; rows: T[] }>();
    for (const row of list) {
      const v = value(row, column);
      const id = groupId([v]);
      let b = buckets.get(id);
      if (!b) {
        b = { value: v, rows: [] };
        buckets.set(id, b);
      }
      b.rows.push(row);
    }
    for (const b of buckets.values()) {
      const key = `group:${groupId([...path, b.value])}`;
      const expanded = !input.collapsedGroups?.has(key);
      out.push({ kind: "group", key, depth: level, column, value: b.value, rows: b.rows, expanded });
      if (expanded) walk(b.rows, level + 1, [...path, b.value]);
    }
  };
  walk(input.rows, 0, []);
  return out;
}

/** Orden de columnas: el guardado (sin claves que ya no existen) y las nuevas al final, en su orden. */
export function orderColumns(keys: ReadonlyArray<string>, order: ReadonlyArray<string> | null | undefined): string[] {
  if (!order?.length) return [...keys];
  const known = new Set(keys);
  const kept = order.filter((k) => known.has(k));
  const seen = new Set(kept);
  return [...kept, ...keys.filter((k) => !seen.has(k))];
}

/** Mueve una columna a la posición `to` (0 es la primera). */
export function moveColumn(order: ReadonlyArray<string>, key: string, to: number): string[] {
  const from = order.indexOf(key);
  if (from < 0) return [...order];
  const next = order.filter((k) => k !== key);
  next.splice(Math.max(0, Math.min(next.length, Math.round(to))), 0, key);
  return next;
}

export type Pin = "start" | "end" | undefined;

/**
 * Desplazamiento (px) de cada columna fijada: las del inicio suman los anchos de las fijadas al inicio anteriores; las
 * del final, los de las fijadas al final posteriores. `edge` marca la última del inicio y la primera del final (la
 * sombra que separa lo fijo de lo que desplaza).
 */
export function pinLayout(widths: ReadonlyArray<number>, pins: ReadonlyArray<Pin>): { offset: number[]; edge: boolean[] } {
  const offset = widths.map(() => 0);
  const edge = widths.map(() => false);
  let x = 0;
  let lastStart = -1;
  for (let i = 0; i < widths.length; i++) {
    if (pins[i] !== "start") continue;
    offset[i] = x;
    x += widths[i]!;
    lastStart = i;
  }
  let y = 0;
  let firstEnd = -1;
  for (let i = widths.length - 1; i >= 0; i--) {
    if (pins[i] !== "end") continue;
    offset[i] = y;
    y += widths[i]!;
    firstEnd = i;
  }
  if (lastStart >= 0) edge[lastStart] = true;
  if (firstEnd >= 0) edge[firstEnd] = true;
  return { offset, edge };
}

/** Columnas fijadas a los lados y las demás en medio, sin cambiar el orden relativo de cada parte. */
export function pinOrder<C extends { key: string; pinned?: Pin }>(columns: ReadonlyArray<C>): C[] {
  return [
    ...columns.filter((c) => c.pinned === "start"),
    ...columns.filter((c) => !c.pinned),
    ...columns.filter((c) => c.pinned === "end"),
  ];
}

export interface CellRules {
  required?: boolean;
  /** Para números (y fechas como `YYYY-MM-DD`). */
  min?: number | string;
  max?: number | string;
  /** Expresión regular del texto completo. */
  pattern?: string;
  type?: "text" | "number" | "date" | "select";
  /** Valores permitidos (editor `select`). */
  options?: ReadonlyArray<string>;
}

export interface CellMessages {
  required: string;
  number: string;
  min: string;
  max: string;
  pattern: string;
  option: string;
}

export const CELL_MESSAGES: CellMessages = {
  required: "Required",
  number: "Enter a number",
  min: "Must be at least {min}",
  max: "Must be at most {max}",
  pattern: "Invalid format",
  option: "Choose one of the options",
};

/** Error de validación de un valor editado, o `null` si vale. Los mensajes llevan `{min}` y `{max}`. */
export function validateCell(value: string, rules: CellRules, messages: CellMessages = CELL_MESSAGES): string | null {
  const v = value.trim();
  if (!v) return rules.required ? messages.required : null;
  if (rules.type === "number") {
    const n = Number(v.replace(",", "."));
    if (!Number.isFinite(n)) return messages.number;
    if (rules.min !== undefined && n < Number(rules.min)) return messages.min.replace("{min}", String(rules.min));
    if (rules.max !== undefined && n > Number(rules.max)) return messages.max.replace("{max}", String(rules.max));
  } else if (rules.type === "date") {
    if (rules.min !== undefined && v < String(rules.min)) return messages.min.replace("{min}", String(rules.min));
    if (rules.max !== undefined && v > String(rules.max)) return messages.max.replace("{max}", String(rules.max));
  }
  if (rules.options && !rules.options.includes(v)) return messages.option;
  if (rules.pattern) {
    let re: RegExp | null = null;
    try {
      re = new RegExp(`^(?:${rules.pattern})$`, "u");
    } catch {
      re = null;
    }
    if (re && !re.test(v)) return messages.pattern;
  }
  return null;
}

const dateFormats = new Map<string, Intl.DateTimeFormat>();

/**
 * Fecha de una celda con el idioma de la tabla (no el del entorno): `locale` y opciones de Intl. Sin opciones,
 * `dateStyle: "medium"`. Un idioma no válido cae al del entorno sin lanzar.
 */
const optionKeys = new WeakMap<object, string>();
const DEFAULT_DATE: Intl.DateTimeFormatOptions = { dateStyle: "medium" };
export function formatDateCell(value: Date, locale?: string, options?: Intl.DateTimeFormatOptions): string {
  if (Number.isNaN(value.getTime())) return "";
  const opts = options ?? DEFAULT_DATE;
  // La clave de las opciones se calcula una vez por objeto (miles de celdas por pintado).
  let optKey = optionKeys.get(opts);
  if (optKey === undefined) {
    optKey = JSON.stringify(opts);
    optionKeys.set(opts, optKey);
  }
  const key = `${locale ?? ""}|${optKey}`;
  let f = dateFormats.get(key);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat(locale, opts);
    } catch {
      f = new Intl.DateTimeFormat(undefined, opts);
    }
    dateFormats.set(key, f);
  }
  return f.format(value);
}

/** Número de un agregado con el idioma de la tabla. */
export function formatNumberCell(value: number, locale?: string, options?: Intl.NumberFormatOptions): string {
  try {
    return new Intl.NumberFormat(locale, options ?? { maximumFractionDigits: 2 }).format(value);
  } catch {
    return String(value);
  }
}

export interface CellPos {
  row: number;
  col: number;
}

/**
 * Movimiento del foco en la rejilla (patrón APG «data grid»): flechas, Inicio/Fin en la fila, Ctrl+Inicio/Fin en la
 * rejilla y RePág/AvPág por `page` filas. `null` si la tecla no navega o ya está en el borde (la página puede desplazar).
 */
export function gridMove(pos: CellPos, key: string, rows: number, cols: number, o: { ctrl?: boolean; page?: number } = {}): CellPos | null {
  if (rows <= 0 || cols <= 0) return null;
  const page = Math.max(1, o.page ?? 10);
  let { row, col } = pos;
  switch (key) {
    case "ArrowDown":
      row++;
      break;
    case "ArrowUp":
      row--;
      break;
    case "ArrowRight":
      col++;
      break;
    case "ArrowLeft":
      col--;
      break;
    case "Home":
      col = 0;
      if (o.ctrl) row = 0;
      break;
    case "End":
      col = cols - 1;
      if (o.ctrl) row = rows - 1;
      break;
    case "PageDown":
      row += page;
      break;
    case "PageUp":
      row -= page;
      break;
    default:
      return null;
  }
  row = Math.max(0, Math.min(rows - 1, row));
  col = Math.max(0, Math.min(cols - 1, col));
  if (row === pos.row && col === pos.col) return null;
  return { row, col };
}

/** Claves entre el ancla y el destino (ambos incluidos), en el orden de las filas. */
export function keyRange<K>(order: ReadonlyArray<K>, from: K, to: K): K[] {
  const a = order.indexOf(from);
  const b = order.indexOf(to);
  if (a < 0 || b < 0) return [];
  return order.slice(Math.min(a, b), Math.max(a, b) + 1);
}
