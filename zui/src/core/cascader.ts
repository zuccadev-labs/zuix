// Lógica de Cascader sin documento: opciones en árbol que se recorren por columnas (país › región › ciudad), hijos
// que llegan más tarde (`loadChildren`), búsqueda por la ruta completa y el valor como ruta de valores. La selección
// múltiple reutiliza las casillas en cascada de ./tree a través de ./tree-select, con el id de cada nodo igual a su ruta.
import { fold } from "./search";
import type { ShowStrategy, TreeShape } from "./tree-select";

export interface CascaderOption {
  value: string;
  label: string;
  disabled?: boolean;
  /** Hijos ya conocidos. */
  children?: ReadonlyArray<CascaderOption>;
  /** `false`: rama cuyos hijos llegan con `loadChildren` al abrirla. Sin `children`, una opción es hoja. */
  isLeaf?: boolean;
}

/** Hijos cargados más tarde, por clave de ruta. */
export type LoadedChildren = Readonly<Record<string, ReadonlyArray<CascaderOption>>>;

/** Clave estable de una ruta (los valores pueden llevar cualquier carácter). */
export const pathKey = (path: ReadonlyArray<string>) => JSON.stringify(path);

/** Hijos de un nodo: los suyos o los cargados. `undefined` si todavía no se sabe (carga diferida pendiente). */
export function childrenOf(
  node: CascaderOption,
  path: ReadonlyArray<string>,
  loaded: LoadedChildren,
): ReadonlyArray<CascaderOption> | undefined {
  if (node.children) return node.children;
  return loaded[pathKey(path)];
}

/** Tiene (o puede tener) hijos. */
export function isBranch(node: CascaderOption, path: ReadonlyArray<string>, loaded: LoadedChildren, lazy: boolean): boolean {
  const kids = childrenOf(node, path, loaded);
  if (kids) return kids.length > 0;
  return lazy && node.isLeaf === false;
}

/** Nodos de la ruta, o null si alguno no existe (todavía). */
export function nodesOf(
  options: ReadonlyArray<CascaderOption>,
  path: ReadonlyArray<string>,
  loaded: LoadedChildren,
): CascaderOption[] | null {
  const out: CascaderOption[] = [];
  let list: ReadonlyArray<CascaderOption> | undefined = options;
  for (let i = 0; i < path.length; i++) {
    const node: CascaderOption | undefined = list?.find((o) => o.value === path[i]);
    if (!node) return null;
    out.push(node);
    list = childrenOf(node, path.slice(0, i + 1), loaded);
  }
  return out;
}

/** Columnas que se ven con una ruta abierta: la raíz y los hijos de cada nodo de la ruta que ya se conocen. */
export function columnsOf(
  options: ReadonlyArray<CascaderOption>,
  open: ReadonlyArray<string>,
  loaded: LoadedChildren,
): ReadonlyArray<CascaderOption>[] {
  const columns: ReadonlyArray<CascaderOption>[] = [options];
  let list: ReadonlyArray<CascaderOption> = options;
  for (let i = 0; i < open.length; i++) {
    const node = list.find((o) => o.value === open[i]);
    if (!node) break;
    const kids = childrenOf(node, open.slice(0, i + 1), loaded);
    if (!kids?.length) break;
    columns.push(kids);
    list = kids;
  }
  return columns;
}

export interface CascaderMatch {
  path: string[];
  labels: string[];
  disabled: boolean;
}

/**
 * Rutas cuya cadena de etiquetas contiene la búsqueda (sin mayúsculas ni acentos), en el orden del árbol. Solo hojas,
 * o también ramas con `changeOnSelect`. Lo que aún no se ha cargado no se busca.
 */
export function searchPaths(
  options: ReadonlyArray<CascaderOption>,
  query: string,
  loaded: LoadedChildren,
  { changeOnSelect = false, lazy = false, limit = 50, separator = " / " } = {},
): CascaderMatch[] {
  const q = fold(query.trim());
  if (!q) return [];
  const out: CascaderMatch[] = [];
  const walk = (list: ReadonlyArray<CascaderOption>, path: string[], labels: string[], disabled: boolean) => {
    for (const node of list) {
      if (out.length >= limit) return;
      const p = [...path, node.value];
      const l = [...labels, node.label];
      const off = disabled || Boolean(node.disabled);
      const kids = childrenOf(node, p, loaded);
      const branch = isBranch(node, p, loaded, lazy);
      if ((!branch || changeOnSelect) && fold(l.join(separator)).includes(q)) out.push({ path: p, labels: l, disabled: off });
      if (kids?.length) walk(kids, p, l, off);
    }
  };
  walk(options, [], [], false);
  return out;
}

/** Ruta → texto del formulario (`es/madrid/alcala`). */
export const pathText = (path: ReadonlyArray<string>, separator = "/") => path.join(separator);

/** Texto del formulario → ruta. */
export const parsePath = (text: string | null | undefined, separator = "/") => (text ? text.split(separator).filter(Boolean) : []);

/** Árbol de ./tree con el id de cada nodo igual a la clave de su ruta (casillas de la selección múltiple). */
export function cascaderShape(options: ReadonlyArray<CascaderOption>, loaded: LoadedChildren, path: string[] = []): TreeShape[] {
  return options.map((node) => {
    const p = [...path, node.value];
    const kids = childrenOf(node, p, loaded);
    return { id: pathKey(p), disabled: node.disabled, children: kids?.length ? cascaderShape(kids, loaded, p) : undefined };
  });
}

/** Rutas → claves y vuelta. */
export const keysOf = (paths: ReadonlyArray<ReadonlyArray<string>>) => paths.map((p) => pathKey(p));
export const pathsOf = (keys: ReadonlyArray<string>) => keys.map((k) => JSON.parse(k) as string[]);

export type { ShowStrategy };
