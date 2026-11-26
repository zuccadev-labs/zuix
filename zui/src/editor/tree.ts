// Operaciones sobre el árbol de un documento de página. Inmutables: cada una devuelve un documento nuevo y comparte
// los nodos que no cambian, así que el historial puede guardar instantáneas sin copiar el árbol entero. Puras y sin
// documento del navegador.

import { type AdaptiveOverride, type AdaptiveSpec, SIZE_CLASS_NAMES, type SizeClass, isSizeClass } from "./adaptive";
import {
  DOCUMENT_FORMAT,
  DOCUMENT_SCHEMA_VERSION,
  type ElementNode,
  type JsonValue,
  type NodeStyle,
  type PageDocument,
  type PageNode,
  isText,
} from "./types";

/** Dónde va un nodo: dentro de `parent` (o del cuerpo, con `null`), en el hueco `slot` (por defecto los hijos). */
export interface Location {
  parent: string | null;
  slot?: string;
  index: number;
}

/** Ruta de un nodo desde el cuerpo: los ids de sus antecesores y el suyo. */
export type NodePath = string[];

export const CHILDREN = "children";

/** Documento vacío. */
export function createDocument(init: Partial<Omit<PageDocument, "format" | "schemaVersion">> = {}): PageDocument {
  return { format: DOCUMENT_FORMAT, schemaVersion: DOCUMENT_SCHEMA_VERSION, ...init, body: init.body ?? [] };
}

/**
 * Generador de ids. Por defecto, `crypto.randomUUID` acortado; con `seed` es determinista (pruebas, salidas
 * reproducibles). Los ids solo identifican nodos dentro de un documento: no llevan significado.
 */
export function idGenerator(seed?: string): () => string {
  if (seed !== undefined) {
    let n = 0;
    return () => `${seed}${(n++).toString(36)}`;
  }
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  let fallback = 0;
  return () => (c?.randomUUID ? `n${c.randomUUID().replace(/-/g, "").slice(0, 12)}` : `n${(fallback++).toString(36)}`);
}

/** Hijos de un hueco de un nodo. */
export function slotOf(node: PageNode, slot = CHILDREN): PageNode[] {
  if (isText(node)) return [];
  return (slot === CHILDREN ? node.children : node.slots?.[slot]) ?? [];
}

/** Huecos de un nodo con sus hijos, el de por defecto primero. */
export function slotsOf(node: PageNode): [string, PageNode[]][] {
  if (isText(node)) return [];
  const out: [string, PageNode[]][] = [];
  if (node.children) out.push([CHILDREN, node.children]);
  for (const [name, list] of Object.entries(node.slots ?? {})) out.push([name, list]);
  return out;
}

/** Recorre el árbol en profundidad (padre antes que hijos). `visit` recibe el nodo, su ruta y dónde está. */
export function walk(
  list: readonly PageNode[],
  visit: (node: PageNode, path: NodePath, at: { parent: string | null; slot: string; index: number }) => void,
  parent: string | null = null,
  slot = CHILDREN,
  path: NodePath = [],
): void {
  list.forEach((node, index) => {
    const here = [...path, node.id];
    visit(node, here, { parent, slot, index });
    for (const [name, kids] of slotsOf(node)) walk(kids, visit, node.id, name, here);
  });
}

export function findNode(doc: PageDocument, id: string): PageNode | null {
  let found: PageNode | null = null;
  walk(doc.body, (node) => {
    if (!found && node.id === id) found = node;
  });
  return found;
}

/** Ruta de ids desde el cuerpo hasta el nodo, o `null`. */
export function pathTo(doc: PageDocument, id: string): NodePath | null {
  let found: NodePath | null = null;
  walk(doc.body, (node, path) => {
    if (!found && node.id === id) found = path;
  });
  return found;
}

/** Dónde está un nodo, o `null`. */
export function locate(doc: PageDocument, id: string): (Location & { slot: string }) | null {
  let found: (Location & { slot: string }) | null = null;
  walk(doc.body, (node, _path, at) => {
    if (!found && node.id === id) found = at;
  });
  return found;
}

/** Aplica `fn` a la lista del hueco indicado y devuelve el documento nuevo. Falla si el padre no existe. */
function editList(doc: PageDocument, parent: string | null, slot: string, fn: (list: PageNode[]) => PageNode[]): PageDocument {
  if (parent === null) {
    if (slot !== CHILDREN) throw new Error(`el cuerpo del documento no tiene el hueco "${slot}"`);
    return { ...doc, body: fn([...doc.body]) };
  }
  let hit = false;
  const body = mapTree(doc.body, (node) => {
    if (node.id !== parent) return node;
    if (isText(node)) throw new Error(`"${parent}" es un nodo de texto: no admite hijos`);
    hit = true;
    const next = fn([...slotOf(node, slot)]);
    if (slot === CHILDREN) return { ...node, children: next };
    return { ...node, slots: { ...node.slots, [slot]: next } };
  });
  if (!hit) throw new Error(`no existe el nodo "${parent}"`);
  return { ...doc, body };
}

/** Copia el árbol cambiando los nodos que `fn` devuelva distintos; el resto se comparte. */
export function mapTree(list: readonly PageNode[], fn: (node: PageNode) => PageNode): PageNode[] {
  let changed = false;
  const out = list.map((node) => {
    let next = fn(node);
    if (!isText(next)) {
      const el: ElementNode = next;
      let kids = el.children;
      if (kids) {
        const mapped = mapTree(kids, fn);
        if (mapped !== kids) kids = mapped;
      }
      let slots = el.slots;
      if (slots) {
        let slotChanged = false;
        const entries = Object.entries(slots).map(([k, v]) => {
          const mapped = mapTree(v, fn);
          if (mapped !== v) slotChanged = true;
          return [k, mapped] as const;
        });
        if (slotChanged) slots = Object.fromEntries(entries);
      }
      if (kids !== el.children || slots !== el.slots) next = { ...el, ...(kids ? { children: kids } : {}), ...(slots ? { slots } : {}) };
    }
    if (next !== node) changed = true;
    return next;
  });
  return changed ? out : (list as PageNode[]);
}

const clamp = (i: number, n: number) => Math.max(0, Math.min(n, Number.isFinite(i) ? Math.floor(i) : n));

/** Inserta un nodo. Falla si el id ya existe en el documento. */
export function insertNode(doc: PageDocument, node: PageNode, at: Location): PageDocument {
  const ids = new Set<string>();
  walk(doc.body, (n) => ids.add(n.id));
  walk([node], (n) => {
    if (ids.has(n.id)) throw new Error(`el id "${n.id}" ya existe en el documento`);
    ids.add(n.id);
  });
  return editList(doc, at.parent, at.slot ?? CHILDREN, (list) => {
    list.splice(clamp(at.index, list.length), 0, node);
    return list;
  });
}

/** Quita un nodo (y su subárbol). Sin cambios si no existe. */
export function removeNode(doc: PageDocument, id: string): PageDocument {
  const at = locate(doc, id);
  if (!at) return doc;
  return editList(doc, at.parent, at.slot, (list) => list.filter((n) => n.id !== id));
}

/**
 * Mueve un nodo. `at.index` es la posición en la lista de destino antes de quitar el nodo (como al soltar entre dos
 * hermanos); dentro de la misma lista se corrige. No puede ir dentro de sí mismo.
 */
export function moveNode(doc: PageDocument, id: string, at: Location): PageDocument {
  const from = locate(doc, id);
  const node = findNode(doc, id);
  if (!from || !node) throw new Error(`no existe el nodo "${id}"`);
  if (at.parent !== null && (at.parent === id || pathTo(doc, at.parent)?.includes(id)))
    throw new Error(`"${id}" no puede ir dentro de sí mismo`);
  const slot = at.slot ?? CHILDREN;
  let index = at.index;
  if (from.parent === at.parent && from.slot === slot && from.index < index) index -= 1;
  const without = removeNode(doc, id);
  return editList(without, at.parent, slot, (list) => {
    list.splice(clamp(index, list.length), 0, node);
    return list;
  });
}

/** Cambia props de un nodo: `undefined` en el parche quita la prop. */
export function updateProps(doc: PageDocument, id: string, patch: Record<string, JsonValue | undefined>): PageDocument {
  return editNode(doc, id, (node) => {
    const props: Record<string, JsonValue> = { ...node.props };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) delete props[k];
      else props[k] = v;
    }
    const next: ElementNode = { ...node, props };
    if (!Object.keys(props).length) delete next.props;
    return next;
  });
}

/** Cambia el estilo (tokens) de un nodo: `undefined` quita la propiedad. */
export function updateStyle(doc: PageDocument, id: string, patch: Record<string, string | undefined>): PageDocument {
  return editNode(doc, id, (node) => {
    const style: NodeStyle = { ...node.style };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) delete style[k];
      else style[k] = v;
    }
    const next: ElementNode = { ...node, style };
    if (!Object.keys(style).length) delete next.style;
    return next;
  });
}

/** Cambia lo adaptativo de un nodo en una clase: `null` quita el campo; sin campos, la clase desaparece. */
export function updateAdaptive(
  doc: PageDocument,
  id: string,
  cls: SizeClass,
  patch: { [K in keyof AdaptiveOverride]?: AdaptiveOverride[K] | null },
): PageDocument {
  if (!isSizeClass(cls)) throw new Error(`«${String(cls)}» no es una clase de tamaño (${SIZE_CLASS_NAMES.join(", ")})`);
  return editNode(doc, id, (node) => {
    const current: Record<string, unknown> = { ...node.adaptive?.[cls] };
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined) delete current[k];
      else current[k] = v;
    }
    const adaptive: AdaptiveSpec = { ...node.adaptive };
    if (Object.keys(current).length) adaptive[cls] = current as AdaptiveOverride;
    else delete adaptive[cls];
    const next: ElementNode = { ...node, adaptive };
    if (!Object.keys(adaptive).length) delete next.adaptive;
    return next;
  });
}

/** Cambia el texto de un nodo `#text`. */
export function updateText(doc: PageDocument, id: string, text: string): PageDocument {
  let hit = false;
  const body = mapTree(doc.body, (node) => {
    if (node.id !== id) return node;
    if (!isText(node)) throw new Error(`"${id}" no es un nodo de texto`);
    hit = true;
    return { ...node, text };
  });
  if (!hit) throw new Error(`no existe el nodo "${id}"`);
  return { ...doc, body };
}

function editNode(doc: PageDocument, id: string, fn: (node: ElementNode) => ElementNode): PageDocument {
  let hit = false;
  const body = mapTree(doc.body, (node) => {
    if (node.id !== id) return node;
    if (isText(node)) throw new Error(`"${id}" es un nodo de texto`);
    hit = true;
    return fn(node);
  });
  if (!hit) throw new Error(`no existe el nodo "${id}"`);
  return { ...doc, body };
}

/** Copia profunda de un subárbol con ids nuevos (duplicar, insertar un preset). */
export function withNewIds(node: PageNode, nextId: () => string): PageNode {
  if (isText(node)) return { ...node, id: nextId() };
  const out: ElementNode = { ...node, id: nextId() };
  if (node.children) out.children = node.children.map((c) => withNewIds(c, nextId));
  if (node.slots) out.slots = Object.fromEntries(Object.entries(node.slots).map(([k, v]) => [k, v.map((c) => withNewIds(c, nextId))]));
  return out;
}

/** Texto plano de un subárbol (para nombres accesibles y comprobaciones). */
export function textOf(node: PageNode): string {
  if (isText(node)) return node.text;
  return slotOf(node).map(textOf).join("");
}
