// JSON Tree View sin documento: convierte un valor de JavaScript (objetos, arrays, Map, Set, fechas, bigint…) en
// nodos de árbol con su tipo, una vista previa y una ruta (`$.users[0].name`). La pintan el binding de React (sobre
// Tree) y el modo DOM (marcado de z-tree); el texto siempre como texto.

export type JsonKind =
  | "object"
  | "array"
  | "map"
  | "set"
  | "string"
  | "number"
  | "bigint"
  | "boolean"
  | "null"
  | "undefined"
  | "date"
  | "function"
  | "symbol"
  | "circular";

export interface JsonNode {
  /** Ruta del nodo; también su id en el árbol. */
  id: string;
  /** Clave en su padre (`null` en la raíz). */
  key: string | null;
  kind: JsonKind;
  /** Texto del valor: el literal en una hoja, el resumen en una rama (`Array(3)`, `{2}`, `Map(1)`). */
  preview: string;
  /** Texto completo cuando `preview` va truncado. */
  full?: string;
  /** Número de hijos de una rama. */
  size?: number;
  children?: JsonNode[];
  /** Valor original (para `onSelect`). */
  value: unknown;
}

export interface JsonTreeOptions {
  /** Longitud máxima de una cadena antes de truncarla con «…». */
  maxStringLength?: number;
  /** Nombre de la raíz en las rutas. */
  rootName?: string;
}

const IDENT = /^[A-Za-z_$][\w$]*$/;

/** Segmento de ruta para una clave: `.name`, `[0]` o `["with space"]`. */
export function pathSegment(key: string | number, container: JsonKind): string {
  if (container === "array" || container === "set" || typeof key === "number") return `[${key}]`;
  if (container === "map") return `.get(${JSON.stringify(key)})`;
  return IDENT.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`;
}

export function jsonKind(value: unknown): JsonKind {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (value instanceof Map) return "map";
  if (value instanceof Set) return "set";
  if (value instanceof Date) return "date";
  const t = typeof value;
  if (t === "object") return "object";
  return t as JsonKind;
}

function leafText(value: unknown, kind: JsonKind): string {
  switch (kind) {
    case "string":
      return JSON.stringify(value);
    case "bigint":
      return `${String(value)}n`;
    case "date":
      return Number.isNaN((value as Date).getTime()) ? "Invalid Date" : (value as Date).toISOString();
    case "function":
      return `ƒ ${(value as { name?: string }).name || "anonymous"}()`;
    case "symbol":
      return String(value);
    default:
      return String(value);
  }
}

const entriesOf = (value: unknown, kind: JsonKind): [string | number, unknown][] => {
  if (kind === "array") return (value as unknown[]).map((v, i) => [i, v]);
  if (kind === "set") return [...(value as Set<unknown>)].map((v, i) => [i, v]);
  if (kind === "map") return [...(value as Map<unknown, unknown>)].map(([k, v]) => [typeof k === "string" ? k : String(k), v]);
  return Object.entries(value as Record<string, unknown>);
};

function branchPreview(kind: JsonKind, size: number): string {
  if (kind === "array") return `Array(${size})`;
  if (kind === "map") return `Map(${size})`;
  if (kind === "set") return `Set(${size})`;
  return `{${size}}`;
}

/** Nodos del árbol para un valor. La raíz es un solo nodo con clave `null`. Las referencias circulares se cortan. */
export function jsonNodes(value: unknown, options: JsonTreeOptions = {}): JsonNode[] {
  const max = Math.max(4, options.maxStringLength ?? 120);
  const seen = new WeakSet<object>();
  const build = (v: unknown, key: string | null, path: string): JsonNode => {
    const kind = jsonKind(v);
    if (kind === "object" || kind === "array" || kind === "map" || kind === "set") {
      if (seen.has(v as object)) return { id: path, key, kind: "circular", preview: "[Circular]", value: v };
      seen.add(v as object);
      const entries = entriesOf(v, kind);
      const children = entries.map(([k, child]) => build(child, String(k), path + pathSegment(k, kind)));
      seen.delete(v as object);
      return { id: path, key, kind, preview: branchPreview(kind, entries.length), size: entries.length, children, value: v };
    }
    const text = leafText(v, kind);
    if (kind === "string" && text.length > max)
      return { id: path, key, kind, preview: `${text.slice(0, max - 2)}…"`, full: text, value: v };
    return { id: path, key, kind, preview: text, value: v };
  };
  return [build(value, null, options.rootName ?? "$")];
}
