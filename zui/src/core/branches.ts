// Árbol de una conversación con ramas: editar un mensaje o regenerar una respuesta crea un hermano, y la conversación
// visible es el camino que eligen las ramas activas. Aquí los nodos (padre → hijos), los hermanos de un nodo con su
// posición («2 / 3»), el camino activo y el cambio de rama. Puro e inmutable: cada operación devuelve datos nuevos.

export interface BranchNode {
  id: string;
  parentId: string | null;
}

/** Rama elegida en cada bifurcación: id del padre (o `""` para la raíz) → id del hijo activo. */
export type BranchSelection = Readonly<Record<string, string>>;

const parentKey = (id: string | null) => id ?? "";

/** Hijos de un nodo (o de la raíz con `null`), en orden de llegada. */
export function childrenOf<N extends BranchNode>(nodes: readonly N[], parentId: string | null): N[] {
  return nodes.filter((n) => n.parentId === parentId);
}

/** Hermanos de un nodo (él incluido) y su posición entre ellos. */
export function siblings<N extends BranchNode>(nodes: readonly N[], id: string): { list: N[]; index: number } {
  const node = nodes.find((n) => n.id === id);
  if (!node) return { list: [], index: -1 };
  const list = childrenOf(nodes, node.parentId);
  return { list, index: list.findIndex((n) => n.id === id) };
}

/**
 * Camino activo desde la raíz: en cada bifurcación, el hijo elegido o, si no hay elección (o ya no existe), el más
 * reciente. Un ciclo en los datos no cuelga: un nodo no se visita dos veces.
 */
export function activePath<N extends BranchNode>(nodes: readonly N[], selection: BranchSelection = {}): N[] {
  const path: N[] = [];
  const seen = new Set<string>();
  let parent: string | null = null;
  for (;;) {
    const kids = childrenOf(nodes, parent);
    if (!kids.length) break;
    const chosen: N = kids.find((k) => k.id === selection[parentKey(parent)]) ?? kids[kids.length - 1]!;
    if (seen.has(chosen.id)) break;
    seen.add(chosen.id);
    path.push(chosen);
    parent = chosen.id;
  }
  return path;
}

/** Elige la rama de `id` (y deja el resto como estaba). */
export function selectBranch<N extends BranchNode>(nodes: readonly N[], selection: BranchSelection, id: string): BranchSelection {
  const node = nodes.find((n) => n.id === id);
  if (!node) return selection;
  return { ...selection, [parentKey(node.parentId)]: id };
}

/** Pasa a la rama hermana anterior (`-1`) o siguiente (`1`) de `id`, sin dar la vuelta. */
export function stepBranch<N extends BranchNode>(
  nodes: readonly N[],
  selection: BranchSelection,
  id: string,
  delta: number,
): BranchSelection {
  const { list, index } = siblings(nodes, id);
  if (index < 0) return selection;
  const next = list[Math.max(0, Math.min(list.length - 1, index + Math.sign(delta)))]!;
  return selectBranch(nodes, selection, next.id);
}

/** Añade un nodo como hermano nuevo (editar, regenerar) o como hijo, y lo deja como rama activa. */
export function addBranch<N extends BranchNode>(
  nodes: readonly N[],
  selection: BranchSelection,
  node: N,
): { nodes: N[]; selection: BranchSelection } {
  const next = [...nodes.filter((n) => n.id !== node.id), node];
  return { nodes: next, selection: { ...selection, [parentKey(node.parentId)]: node.id } };
}

/** Posición «index / count» de un nodo entre sus hermanos (1-based), o `null` si no tiene hermanos. */
export function branchInfo<N extends BranchNode>(nodes: readonly N[], id: string): { index: number; count: number } | null {
  const { list, index } = siblings(nodes, id);
  return list.length > 1 && index >= 0 ? { index: index + 1, count: list.length } : null;
}
