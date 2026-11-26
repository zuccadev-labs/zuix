// Lógica de TreeSelect (y de la selección múltiple de Cascader) sin documento. Las casillas en cascada y el estado
// mixto son los de ./tree (los mismos que Tree); aquí va lo que añade un select: qué ids salen como valor según la
// estrategia (`all`, `parent` o `child`), cómo se vuelve de un valor a las casillas, las filas visibles y la búsqueda
// que expande lo que coincide.
import { fold } from "./search";
import { checkStates, toggleCheck, type CheckState, type TreeShape } from "./tree";

export type { CheckState, TreeShape };

export interface TreeSelectNode {
  value: string;
  label: string;
  disabled?: boolean;
  children?: ReadonlyArray<TreeSelectNode>;
}

/** Qué ids forman el valor con casillas: todos los marcados, solo el padre cuando lo están todos sus hijos, o solo hojas. */
export type ShowStrategy = "all" | "parent" | "child";

/** Nodos con `value` → forma de ./tree (`id`). */
export function toShape(nodes: ReadonlyArray<TreeSelectNode>): TreeShape[] {
  return nodes.map((node) => ({
    id: node.value,
    disabled: node.disabled,
    children: node.children?.length ? toShape(node.children) : undefined,
  }));
}

export function walkTree<T extends { children?: ReadonlyArray<T> }>(
  nodes: ReadonlyArray<T>,
  visit: (node: T, parent: T | null, level: number) => void,
  parent: T | null = null,
  level = 1,
): void {
  for (const node of nodes) {
    visit(node, parent, level);
    if (node.children?.length) walkTree(node.children, visit, node, level + 1);
  }
}

/** Padre de cada id. */
export function parentsOf(nodes: ReadonlyArray<TreeShape>): Map<string, string | null> {
  const out = new Map<string, string | null>();
  walkTree(nodes, (node, parent) => out.set(node.id, parent?.id ?? null));
  return out;
}

/** Ids marcados del todo (ramas incluidas) a partir de las hojas marcadas. */
export function fullyChecked(nodes: ReadonlyArray<TreeShape>, leaves: Iterable<string>): string[] {
  const states = checkStates(nodes, leaves);
  const out: string[] = [];
  walkTree(nodes, (node) => {
    if (states.get(node.id) === "true") out.push(node.id);
  });
  return out;
}

/** Hojas habilitadas bajo un nodo (él mismo si es hoja). */
function leavesUnder(node: TreeShape, out: string[] = []): string[] {
  if (node.disabled) return out;
  if (!node.children?.length) out.push(node.id);
  else for (const kid of node.children) leavesUnder(kid, out);
  return out;
}

/** Valor (en cualquier estrategia) → ids marcados del todo. Un id de rama marca todas sus hojas. */
export function checkedFromValue(nodes: ReadonlyArray<TreeShape>, value: Iterable<string>): string[] {
  const wanted = new Set(value);
  const leaves = new Set<string>();
  walkTree(nodes, (node) => {
    if (!wanted.has(node.id)) return;
    if (node.children?.length) for (const leaf of leavesUnder(node)) leaves.add(leaf);
    else leaves.add(node.id);
  });
  return fullyChecked(nodes, leaves);
}

/** Ids marcados del todo → valor según la estrategia, en el orden del árbol. */
export function strategyValue(nodes: ReadonlyArray<TreeShape>, checked: Iterable<string>, strategy: ShowStrategy): string[] {
  const set = new Set(checked);
  const out: string[] = [];
  walkTree(nodes, (node, parent) => {
    if (!set.has(node.id)) return;
    const leaf = !node.children?.length;
    if (strategy === "all" || (strategy === "child" && leaf) || (strategy === "parent" && !(parent && set.has(parent.id))))
      out.push(node.id);
  });
  return out;
}

/** Marca o desmarca `id` sobre un valor y devuelve el valor nuevo en la misma estrategia. */
export function toggleValue(nodes: ReadonlyArray<TreeShape>, value: Iterable<string>, id: string, strategy: ShowStrategy): string[] {
  const next = toggleCheck(nodes, checkedFromValue(nodes, value), id);
  return strategyValue(nodes, next, strategy);
}

/** Estado de cada casilla para un valor. */
export const valueStates = (nodes: ReadonlyArray<TreeShape>, value: Iterable<string>) => checkStates(nodes, checkedFromValue(nodes, value));

export interface TreeRow<T> {
  node: T;
  level: number;
  parent: string | null;
  posinset: number;
  setsize: number;
}

/** Filas visibles en orden con los ids expandidos (y, si se filtra, solo las que quedan). */
export function visibleRows<T extends TreeSelectNode>(
  nodes: ReadonlyArray<T>,
  expanded: ReadonlySet<string>,
  keep?: ReadonlySet<string> | null,
): TreeRow<T>[] {
  const out: TreeRow<T>[] = [];
  const walk = (list: ReadonlyArray<T>, level: number, parent: string | null) => {
    const shown = keep ? list.filter((n) => keep.has(n.value)) : list;
    shown.forEach((node, i) => {
      out.push({ node, level, parent, posinset: i + 1, setsize: shown.length });
      if (node.children?.length && expanded.has(node.value)) walk(node.children as ReadonlyArray<T>, level + 1, node.value);
    });
  };
  walk(nodes, 1, null);
  return out;
}

export interface TreeFilter {
  /** Nodos cuya etiqueta contiene la búsqueda. */
  matches: Set<string>;
  /** Lo que se pinta: las coincidencias, sus antepasados y lo que cuelga de una rama que coincide. */
  keep: Set<string>;
  /** Antepasados de las coincidencias: se expanden para que se vean. */
  expand: Set<string>;
}

/** Búsqueda sin mayúsculas ni acentos. `null` con la búsqueda vacía (se ve todo). */
export function filterTree(nodes: ReadonlyArray<TreeSelectNode>, query: string): TreeFilter | null {
  const q = fold(query.trim());
  if (!q) return null;
  const matches = new Set<string>();
  const keep = new Set<string>();
  const expand = new Set<string>();
  const addAll = (node: TreeSelectNode) => {
    keep.add(node.value);
    for (const kid of node.children ?? []) addAll(kid);
  };
  const walk = (node: TreeSelectNode, trail: string[]) => {
    if (fold(node.label).includes(q)) {
      matches.add(node.value);
      addAll(node);
      for (const id of trail) {
        keep.add(id);
        expand.add(id);
      }
    }
    for (const kid of node.children ?? []) walk(kid, [...trail, node.value]);
  };
  for (const node of nodes) walk(node, []);
  return { matches, keep, expand };
}

/** Nodo por valor. */
export function findNode<T extends TreeSelectNode>(nodes: ReadonlyArray<T>, value: string): T | undefined {
  for (const node of nodes) {
    if (node.value === value) return node;
    const hit = node.children?.length ? findNode(node.children as ReadonlyArray<T>, value) : undefined;
    if (hit) return hit;
  }
  return undefined;
}

/** Etiquetas desde la raíz hasta el nodo. */
export function labelPath(nodes: ReadonlyArray<TreeSelectNode>, value: string): string[] {
  const trail: string[] = [];
  const walk = (list: ReadonlyArray<TreeSelectNode>): boolean => {
    for (const node of list) {
      trail.push(node.label);
      if (node.value === value || walk(node.children ?? [])) return true;
      trail.pop();
    }
    return false;
  };
  return walk(nodes) ? trail : [];
}

/**
 * Tecla sobre la fila activa (patrón APG «tree view», con el foco en el campo y la fila por aria-activedescendant).
 * Devuelve la fila que pasa a estar activa y si hay que expandir o contraer la actual.
 */
export function treeKey<T extends TreeSelectNode>(
  rows: ReadonlyArray<TreeRow<T>>,
  active: string | null,
  key: string,
  expanded: ReadonlySet<string>,
): { active: string | null; expand?: string; collapse?: string } | null {
  const at = rows.findIndex((r) => r.node.value === active);
  const row = rows[at];
  switch (key) {
    case "ArrowDown":
      return { active: (rows[at + 1] ?? rows[Math.max(at, 0)])?.node.value ?? null };
    case "ArrowUp":
      return { active: (at < 0 ? rows[rows.length - 1] : (rows[at - 1] ?? row))?.node.value ?? null };
    case "Home":
      return { active: rows[0]?.node.value ?? null };
    case "End":
      return { active: rows[rows.length - 1]?.node.value ?? null };
    case "ArrowRight": {
      if (!row?.node.children?.length) return null;
      if (!expanded.has(row.node.value)) return { active: row.node.value, expand: row.node.value };
      return { active: rows[at + 1]?.node.value ?? row.node.value };
    }
    case "ArrowLeft": {
      if (!row) return null;
      if (row.node.children?.length && expanded.has(row.node.value)) return { active: row.node.value, collapse: row.node.value };
      return row.parent ? { active: row.parent } : null;
    }
    default:
      return null;
  }
}
