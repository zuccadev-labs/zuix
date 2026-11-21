// Lógica del árbol (Tree y JsonTree) sin documento: casillas en cascada con estado mixto, rangos de selección sobre
// las filas visibles y la ruta de un nodo. La comparten el binding de React y el modo DOM (que arma la forma del árbol
// leyendo el marcado).

export interface TreeShape {
  id: string;
  disabled?: boolean;
  children?: ReadonlyArray<TreeShape>;
}

export type CheckState = "true" | "false" | "mixed";

/** Estado de cada nodo a partir de los ids marcados: una rama vale `true` si lo están todos sus hijos habilitados,
 *  `false` si ninguno y `mixed` en otro caso. Una hoja (o una rama sin hijos) vale lo que diga el conjunto. */
export function checkStates(nodes: ReadonlyArray<TreeShape>, checked: Iterable<string>): Map<string, CheckState> {
  const set = new Set(checked);
  const out = new Map<string, CheckState>();
  const walk = (node: TreeShape): CheckState => {
    const kids = node.children ?? [];
    if (!kids.length) {
      const state: CheckState = set.has(node.id) ? "true" : "false";
      out.set(node.id, state);
      return state;
    }
    const states = kids.map(walk);
    const counted = kids.map((k, i) => ({ k, s: states[i]! })).filter(({ k }) => !k.disabled);
    const pool = counted.length ? counted.map((c) => c.s) : states;
    const state: CheckState = pool.every((s) => s === "true") ? "true" : pool.every((s) => s === "false") ? "false" : "mixed";
    out.set(node.id, state);
    return state;
  };
  for (const node of nodes) walk(node);
  return out;
}

function find(nodes: ReadonlyArray<TreeShape>, id: string): TreeShape | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = find(node.children ?? [], id);
    if (hit) return hit;
  }
  return undefined;
}

/** Ids de las hojas habilitadas bajo un nodo (él mismo si es hoja). */
function leaves(node: TreeShape, out: string[] = []): string[] {
  if (node.disabled) return out;
  const kids = node.children ?? [];
  if (!kids.length) out.push(node.id);
  else for (const kid of kids) leaves(kid, out);
  return out;
}

/** Marca o desmarca un nodo y todo lo que cuelga de él. Si estaba `true`, desmarca; si no (`false` o `mixed`),
 *  marca. Devuelve los ids que quedan en `true` (ramas incluidas), en el orden del árbol. */
export function toggleCheck(nodes: ReadonlyArray<TreeShape>, checked: Iterable<string>, id: string): string[] {
  const node = find(nodes, id);
  const states = checkStates(nodes, checked);
  if (!node || node.disabled) return fullyChecked(nodes, states);
  const on = states.get(id) !== "true";
  // Conjunto de hojas marcadas (las ramas se deducen).
  const set = new Set<string>();
  for (const [key, state] of states) if (state === "true" && !find(nodes, key)?.children?.length) set.add(key);
  for (const leaf of leaves(node)) {
    if (on) set.add(leaf);
    else set.delete(leaf);
  }
  return fullyChecked(nodes, checkStates(nodes, set));
}

function fullyChecked(nodes: ReadonlyArray<TreeShape>, states: Map<string, CheckState>): string[] {
  const out: string[] = [];
  const walk = (list: ReadonlyArray<TreeShape>) => {
    for (const node of list) {
      if (states.get(node.id) === "true") out.push(node.id);
      walk(node.children ?? []);
    }
  };
  walk(nodes);
  return out;
}

/** Filas entre dos ids de la lista visible (ambos incluidos, en el orden de la lista). Vacía si falta alguno. */
export function rangeIds(visible: ReadonlyArray<string>, from: string, to: string): string[] {
  const a = visible.indexOf(from);
  const b = visible.indexOf(to);
  if (a < 0 || b < 0) return [];
  return visible.slice(Math.min(a, b), Math.max(a, b) + 1);
}

/** Ids de los nodos hasta una profundidad dada (1 = solo la raíz), para `defaultExpandDepth`. */
export function idsToDepth(nodes: ReadonlyArray<TreeShape>, depth: number, level = 1, out: string[] = []): string[] {
  if (level > depth) return out;
  for (const node of nodes) {
    if (node.children?.length) {
      out.push(node.id);
      idsToDepth(node.children, depth, level + 1, out);
    }
  }
  return out;
}
