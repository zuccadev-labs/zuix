// Contenido sin framework, oleada 5: JsonTree. Todo dentro de `[data-z-dom]`; el texto de la aplicación entra
// siempre como texto (textContent), nunca como marcado.
//
// JsonTree   <div class="z-jsontree"> con un hijo <script type="application/json" data-value> (o setJsonTreeValue(el,
//            valor) para Map, Set, fechas…). Atributos: data-label, data-expand-depth, data-max-string-length,
//            data-root-name, data-copy-path, data-copied-label. Pinta el árbol de .z-tree (su teclado es el de Tree) y
//            emite z:select { value: ruta } al activar un nodo; con data-copy-path copia la ruta y emite z:copy.
import { iconSvg, registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { chevronRight } from "@zuccadev-labs/zuix-zicon/icons/chevron-right";
import { announceText, copyText } from "../core/clipboard";
import { jsonNodes, type JsonNode } from "../core/json-tree";
import { idsToDepth } from "../core/tree";
import { emit, inDom } from "./forms-popup";
import { fragment, type Listen } from "./shared";

registerIcons([chevronRight]);

/* ---------- JsonTree ---------- */

const jsonValues = new WeakMap<HTMLElement, unknown>();

function readJson(el: HTMLElement): unknown {
  if (jsonValues.has(el)) return jsonValues.get(el);
  const script = el.querySelector<HTMLScriptElement>(':scope > script[type="application/json"][data-value]');
  if (!script?.textContent) return null;
  try {
    return JSON.parse(script.textContent) as unknown;
  } catch {
    return null;
  }
}

function jsonItem(node: JsonNode, level: number, index: number, size: number, open: Set<string>, doc: Document): HTMLLIElement {
  const li = doc.createElement("li");
  li.className = "z-tree__item";
  li.setAttribute("role", "treeitem");
  li.dataset.value = node.id;
  const branch = Boolean(node.children?.length);
  const isOpen = branch && open.has(node.id);
  if (branch) li.setAttribute("aria-expanded", String(isOpen));
  li.setAttribute("aria-selected", "false");
  li.setAttribute("aria-level", String(level));
  li.setAttribute("aria-setsize", String(size));
  li.setAttribute("aria-posinset", String(index + 1));
  li.tabIndex = -1;
  const row = doc.createElement("div");
  row.className = "z-tree__row";
  row.style.setProperty("--z-tree-level", String(level - 1));
  const toggle = doc.createElement("span");
  toggle.className = "z-tree__toggle";
  toggle.dataset.state = isOpen ? "open" : "closed";
  toggle.setAttribute("aria-hidden", "true");
  if (branch) toggle.append(fragment(iconSvg("chevron-right", { size: 12 })));
  const label = doc.createElement("span");
  label.className = "z-tree__label";
  if (node.key !== null) {
    const key = doc.createElement("span");
    key.className = "z-jsontree__key";
    key.textContent = node.key;
    const sep = doc.createElement("span");
    sep.className = "z-jsontree__sep";
    sep.textContent = ": ";
    label.append(key, sep);
  }
  const value = doc.createElement("span");
  value.className = "z-jsontree__value";
  value.dataset.type = node.kind;
  value.textContent = node.preview;
  if (node.full) value.title = node.full;
  label.append(value);
  row.append(toggle, label);
  li.append(row);
  if (branch) {
    const group = doc.createElement("ul");
    group.className = "z-tree__group";
    group.setAttribute("role", "group");
    group.hidden = !isOpen;
    node.children!.forEach((child, i) => {
      group.append(jsonItem(child, level + 1, i, node.children!.length, open, doc));
    });
    li.append(group);
  }
  return li;
}

/** Pinta (o vuelve a pintar) un JsonTree del modo DOM. */
export function renderJsonTree(el: HTMLElement): void {
  const data = el.dataset;
  const nodes = jsonNodes(readJson(el), {
    maxStringLength: data.maxStringLength ? Number(data.maxStringLength) : undefined,
    rootName: data.rootName,
  });
  const depth = data.expandDepth !== undefined && data.expandDepth !== "" ? Number(data.expandDepth) : 1;
  const open = new Set(idsToDepth(nodes, Number.isFinite(depth) ? depth : 1));
  const doc = el.ownerDocument;
  const tree = doc.createElement("ul");
  tree.className = "z-tree";
  tree.setAttribute("role", "tree");
  tree.setAttribute("aria-label", data.label ?? "JSON");
  nodes.forEach((node, i) => {
    tree.append(jsonItem(node, 1, i, nodes.length, open, doc));
  });
  const first = tree.querySelector<HTMLElement>('[role="treeitem"]');
  if (first) first.tabIndex = 0;
  for (const old of el.querySelectorAll(":scope > .z-tree, :scope > .z-jsontree__status")) old.remove();
  el.append(tree);
  if (el.hasAttribute("data-copy-path")) {
    const status = doc.createElement("span");
    status.className = "z-sr-only z-jsontree__status";
    status.setAttribute("role", "status");
    el.append(status);
  }
}

/** Cambia el valor de un JsonTree del modo DOM (admite Map, Set, fechas y lo que JSON no expresa). */
export function setJsonTreeValue(el: HTMLElement, value: unknown): void {
  jsonValues.set(el, value);
  renderJsonTree(el);
}

function activateJson(item: HTMLElement): void {
  const host = item.closest<HTMLElement>(".z-jsontree");
  if (!host || !inDom(host)) return;
  const path = item.dataset.value ?? "";
  emit(host, "select", { value: path });
  if (!host.hasAttribute("data-copy-path")) return;
  void copyText(path).then((ok) => {
    if (!ok) return;
    emit(host, "copy", { value: path });
    const status = host.querySelector<HTMLElement>(":scope > .z-jsontree__status");
    if (status) status.textContent = announceText((host.dataset.copiedLabel ?? "Copied {path}").replace("{path}", path));
  });
}

export function setup(on: Listen): void {
  on(document, "click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const row = target.closest(".z-jsontree .z-tree__row");
    if (row?.parentElement) activateJson(row.parentElement);
  });
  on(document, "keydown", (event) => {
    const target = event.target;
    if (event.key !== "Enter" || !(target instanceof HTMLElement) || !target.matches('.z-jsontree [role="treeitem"]')) return;
    activateJson(target);
  });
}

export function hydrate(root: ParentNode): void {
  const list = [...root.querySelectorAll<HTMLElement>(".z-jsontree")];
  if (root instanceof HTMLElement && root.matches(".z-jsontree")) list.unshift(root);
  for (const el of list) if (inDom(el) && !el.querySelector(":scope > .z-tree")) renderJsonTree(el);
}
