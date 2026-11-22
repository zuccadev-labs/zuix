// Contenido sin framework: JsonTree y Stepper con paneles. Todo dentro de `[data-z-dom]`; el texto de la aplicación entra
// siempre como texto (textContent), nunca como marcado.
//
// JsonTree   <div class="z-jsontree"> con un hijo <script type="application/json" data-value> (o setJsonTreeValue(el,
//            valor) para Map, Set, fechas…). Atributos: data-label, data-expand-depth, data-max-string-length,
//            data-root-name, data-copy-path, data-copied-label. Pinta el árbol de .z-tree (su teclado es el de Tree) y
//            emite z:select { value: ruta } al activar un nodo; con data-copy-path copia la ruta y emite z:copy.
// Stepper    <div class="z-stepper-panels" data-current="1"> con la lista .z-stepper, los .z-stepper__panel y los botones
//            [data-step="prev|next"]: Anterior y Siguiente cambian de paso, el foco va al panel nuevo y se emite
//            z:change { value }. data-label-next / data-label-finish y data-status-complete|current|upcoming para los
//            textos. setStep(el, índice) lo hace desde código.
import { iconSvg, registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { check } from "@zuccadev-labs/zuix-zicon/icons/check";
import { chevronRight } from "@zuccadev-labs/zuix-zicon/icons/chevron-right";
import { announceText, copyText } from "../core/clipboard";
import { jsonNodes, type JsonNode } from "../core/json-tree";
import { idsToDepth } from "../core/tree";
import { emit, inDom } from "./forms-popup";
import { fragment, setMarkup, type Listen } from "./shared";

registerIcons([check, chevronRight]);

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

/* ---------- Stepper con paneles ---------- */

const markerNodes = new WeakMap<Element, Node[]>();

/** Lleva un Stepper con paneles del modo DOM al paso `index` (igual a `pasos` = todo completo). */
export function setStep(root: HTMLElement, index: number, focus = false): void {
  const steps = [...root.querySelectorAll<HTMLElement>(":scope > .z-stepper > .z-stepper__step")];
  const panels = [...root.querySelectorAll<HTMLElement>(":scope > .z-stepper__panels > .z-stepper__panel:not([data-completed])")];
  const current = Math.max(0, Math.min(steps.length, Math.round(index)));
  const data = root.dataset;
  const status = {
    complete: data.statusComplete ?? "Completed",
    current: data.statusCurrent ?? "Current",
    upcoming: data.statusUpcoming ?? "Upcoming",
  };
  root.dataset.current = String(current);
  steps.forEach((step, i) => {
    const state = i < current ? "complete" : i === current ? "current" : "upcoming";
    step.dataset.state = state;
    if (state === "current") step.setAttribute("aria-current", "step");
    else step.removeAttribute("aria-current");
    const marker = step.querySelector<HTMLElement>(".z-stepper__marker");
    if (marker && !marker.hasAttribute("data-loading")) {
      if (!markerNodes.has(marker))
        markerNodes.set(
          marker,
          [...marker.childNodes].map((node) => node.cloneNode(true)),
        );
      // La marca de hecho es marcado propio; el número o el icono del paso son nodos de la página, guardados al
      // empezar y devueltos como copias: no vuelven a pasar por una cadena de marcado.
      if (state === "complete") setMarkup(marker, iconSvg("check", { size: 14 }));
      else marker.replaceChildren(...(markerNodes.get(marker) ?? []).map((node) => node.cloneNode(true)));
    }
    const sr = step.querySelector<HTMLElement>(".z-stepper__text > .z-sr-only");
    if (sr) sr.textContent = status[state];
  });
  panels.forEach((panel, i) => {
    panel.hidden = i !== current;
  });
  const done = current >= steps.length;
  const finished = root.querySelector<HTMLElement>(":scope > .z-stepper__panels > .z-stepper__panel[data-completed]");
  if (finished) finished.hidden = !done;
  const nav = root.querySelector<HTMLElement>(":scope > .z-stepper__nav");
  if (nav) nav.hidden = done;
  const prev = root.querySelector<HTMLButtonElement>(':scope > .z-stepper__nav [data-step="prev"]');
  const next = root.querySelector<HTMLButtonElement>(':scope > .z-stepper__nav [data-step="next"]');
  if (prev) prev.disabled = current <= 0;
  if (next) next.textContent = current >= steps.length - 1 ? (data.labelFinish ?? "Finish") : (data.labelNext ?? "Next");
  if (focus) (done ? finished : panels[current])?.focus();
}

export function setup(on: Listen): void {
  on(document, "click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const stepButton = target.closest<HTMLButtonElement>(".z-stepper-panels > .z-stepper__nav [data-step]");
    const stepper = stepButton?.closest<HTMLElement>(".z-stepper-panels");
    if (stepButton && stepper && inDom(stepper) && !stepButton.disabled) {
      const at = Number(stepper.dataset.current ?? 0);
      const index = stepButton.dataset.step === "prev" ? at - 1 : at + 1;
      setStep(stepper, index, true);
      emit(stepper, "change", { value: Number(stepper.dataset.current) });
      return;
    }
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
