// Pinta un documento en el DOM con el comportamiento de `@zuccadev-labs/zuix-zui/dom`. Construye los nodos con la API
// del DOM (createElement, setAttribute, textContent y la API de estilos), así que no necesita Trusted Types ni
// `style-src-attr`: solo el marcado de los bloques `preset` (fijo, del contrato) pasa por la política `zuix-zui`.

import type { VNode } from "../core/vnode";
import { hydrate as hydrateAll, init as initAll } from "../dom/index";
import { fragment } from "../dom/shared";
import { BUILTIN_BLOCKS } from "./blocks";
import { type HtmlOptions, type RawHtml, registry, toTrees } from "./render";
import type { PageDocument } from "./types";

/** Prepara el comportamiento del marcado nuevo dentro de `root`. */
export type Hydrator = (root: HTMLElement) => void;

export interface DomOptions extends HtmlOptions {
  /**
   * Quién hidrata tras pintar. Por defecto, `init()` y `hydrate()` de `@zuccadev-labs/zuix-zui/dom` (todas las
   * familias). Los layouts de zout con comportamiento necesitan además el suyo:
   * `hydrate: [defaultHydrator, (root) => zoutInit()]`. `false` no hidrata (vista estática).
   */
  hydrate?: Hydrator[] | false;
}

export interface DomView {
  readonly container: HTMLElement;
  /** Elemento raíz de un nodo (con `ids`), o `null`. */
  elementOf(id: string): HTMLElement | null;
  /** Vuelve a pintar con otro documento. */
  update(doc: PageDocument): void;
  /** Vacía el contenedor. */
  destroy(): void;
}

/** Hidratador por defecto: el comportamiento completo de zui/dom. */
export const defaultHydrator: Hydrator = (root) => {
  initAll();
  hydrateAll(root);
};

const isRaw = (n: unknown): n is RawHtml => typeof n === "object" && n !== null && (n as RawHtml).slot === "html";

function build(node: VNode | RawHtml, doc: Document, ids: boolean): Node | null {
  if (node === null || node === undefined || node === false) return null;
  if (typeof node === "string") return doc.createTextNode(node);
  if (isRaw(node)) {
    const frag = fragment(node.html);
    // El marcado de un preset no lleva el id del nodo: se marca su primer elemento para el lienzo.
    if (ids) (frag.firstElementChild as HTMLElement | null)?.setAttribute("data-z-node", node.id);
    return frag;
  }
  if ("slot" in node) {
    if (node.slot !== "icon") return null;
    const icon = doc.createElement("z-icon");
    icon.setAttribute("name", String(node.p.name));
    icon.setAttribute("size", String(node.p.size));
    if (node.p.variant === "solid") icon.setAttribute("variant", "solid");
    return icon;
  }
  const el = doc.createElement(node.t);
  for (const [k, v] of Object.entries(node.a ?? {})) {
    if (v === null || v === undefined || v === false) continue;
    el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const [k, v] of Object.entries(node.s ?? {})) el.style.setProperty(k, String(v));
  for (const child of node.c ?? []) {
    const built = build(child as VNode | RawHtml, doc, ids);
    if (built) el.append(built);
  }
  return el;
}

/** Nodos del DOM de un documento, sin insertarlos. */
export function toDOM(doc: PageDocument, owner: Document, o: HtmlOptions = {}): DocumentFragment {
  const blocks = registry([...BUILTIN_BLOCKS, ...(o.blocks ?? [])]);
  const frag = owner.createDocumentFragment();
  for (const tree of toTrees(doc.body, blocks, o)) {
    const built = build(tree as VNode | RawHtml, owner, Boolean(o.ids));
    if (built) frag.append(built);
  }
  return frag;
}

/**
 * Pinta el documento dentro de `container` (que pasa a llevar `data-z-dom`) e hidrata su comportamiento. El idioma y
 * la dirección del documento se escriben en el contenedor.
 */
export function renderToDOM(doc: PageDocument, container: HTMLElement, o: DomOptions = {}): DomView {
  const owner = container.ownerDocument;
  const hydrators = o.hydrate === false ? [] : (o.hydrate ?? [defaultHydrator]);
  container.setAttribute("data-z-dom", "");
  const paint = (d: PageDocument) => {
    if (d.lang) container.setAttribute("lang", d.lang);
    else container.removeAttribute("lang");
    if (d.dir) container.setAttribute("dir", d.dir);
    else container.removeAttribute("dir");
    container.replaceChildren(toDOM(d, owner, o));
    for (const h of hydrators) h(container);
  };
  paint(doc);
  return {
    container,
    elementOf: (id) => {
      for (const el of container.querySelectorAll<HTMLElement>("[data-z-node]")) if (el.getAttribute("data-z-node") === id) return el;
      return null;
    },
    update: paint,
    destroy: () => container.replaceChildren(),
  };
}
