// Comportamiento sin framework de CommandPalette, Tree, DataTable (orden) y Pagination.
// `setup()` conecta los listeners delegados una vez; `hydrate(root)` prepara marcado nuevo.
//
// CommandPalette  <dialog class="z-liquid z-palette" data-z-hotkey="mod+k">: se abre con data-z-open="#id", con el
//                 atajo o con openPalette(el). Filtra por etiqueta, detalle, data-keywords="a,b" y cabecera de grupo.
//                 Emite z:select (detail.value) en el comando elegido. data-keep-open: no cierra al elegir.
// Command         .z-palette.z-command (sin diálogo): la misma lista en línea, siempre a la vista. Mismas teclas;
//                 Escape vacía la búsqueda. z:select en el comando elegido.
// Tree            [data-z-dom] .z-tree: expandir, seleccionar y teclado de árbol. z:change { value, expanded }.
//                 aria-multiselectable="true": Ctrl/Cmd y Mayús con el puntero, Espacio, Mayús+flechas y Ctrl+A
//                 (detail.values). data-checkable: casillas .z-tree__check con aria-checked en cascada (detail.checked).
//                 data-renamable: F2 o doble clic en la etiqueta; z:rename { value, label } (cancelable).
// DataTable       [data-z-dom] .z-table__sort: ordena las filas presentes. En el <th>: data-sort="number|text|date",
//                 data-key; en el <td>: data-sort-value. En la tabla: data-manual-sort (solo avisa). z:sort.
// Pagination      [data-z-dom] .z-pagination: data-page-count, data-siblings, data-page-label="Page {page}".
//                 z:change { value }.
// data-z-hotkey   "mod+k" (mod = Ctrl o Cmd), "ctrl+shift+p", varias separadas por espacio. En un <dialog> lo
//                 alterna; en cualquier otro elemento equivale a pulsarlo.
import { localize } from "../core/locale";
import { localeOf } from "./locale";
import { iconSvg, registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { arrowDown } from "@zuccadev-labs/zuix-zicon/icons/arrow-down";
import { arrowUp } from "@zuccadev-labs/zuix-zicon/icons/arrow-up";
import { chevronRight } from "@zuccadev-labs/zuix-zicon/icons/chevron-right";
import { announce } from "../core/announcer";
import { compare, parseNumber } from "../core/compare";
import {
  TREE_DRAG_LABELS,
  checkStates,
  dropSlots,
  rangeIds,
  toggleCheck,
  validDrop,
  type TreeDragLabels,
  type TreeDrop,
  type TreeShape,
} from "../core/tree";
import { bindTreeDrag } from "../core/tree-drag";
import { fill } from "../core/vnode";
import { bodyRowsOf, setBodyRows } from "./table-store";
import { clampPage, pageRange, pageTotal } from "../core/pagination";
import { score } from "../core/search";
import { closeDialog, openDialog } from "./core";
import { logicalKey, pressedOnBackdrop, setMarkup, type Listen } from "./shared";

registerIcons([arrowUp, arrowDown, chevronRight]);

function emit(el: Element, name: string, detail?: unknown): boolean {
  return el.dispatchEvent(new CustomEvent(`z:${name}`, { bubbles: true, cancelable: true, detail }));
}

const inDom = (el: Element) => el.closest("[data-z-dom]") !== null;
const isDisabled = (el: Element) =>
  el.getAttribute("aria-disabled") === "true" || el.hasAttribute("data-disabled") || (el as HTMLButtonElement).disabled === true;

/* ---------- Paleta de comandos: <dialog class="z-liquid z-palette"> ---------- */

const PALETTE = "dialog.z-palette";
// Paleta o comando en línea: comparten búsqueda, teclas y elección.
const COMMAND = "dialog.z-palette, .z-command";
let paletteId = 0;
const order = new WeakMap<Element, number>();

const paletteInput = (dialog: Element) => dialog.querySelector<HTMLInputElement>(".z-palette__input");
const paletteItems = (dialog: Element) => [...dialog.querySelectorAll<HTMLElement>(".z-palette__item")];
const paletteVisible = (dialog: Element) => paletteItems(dialog).filter((item) => !item.hidden);
const paletteIndex = (dialog: Element) =>
  Math.max(
    0,
    paletteVisible(dialog).findIndex((item) => item.getAttribute("aria-selected") === "true"),
  );
const text = (el: Element | null | undefined) => el?.textContent?.trim() ?? "";

function preparePalette(dialog: HTMLElement): void {
  if (!dialog.id) dialog.id = `z-palette-${++paletteId}`;
  const list = dialog.querySelector<HTMLElement>(".z-palette__list");
  const input = paletteInput(dialog);
  if (list && !list.id) list.id = `${dialog.id}-list`;
  if (list && input && !input.hasAttribute("aria-controls")) input.setAttribute("aria-controls", list.id);
  paletteItems(dialog).forEach((item, i) => {
    if (!order.has(item)) order.set(item, i);
    if (!item.id) item.id = `${dialog.id}-option-${order.get(item)}`;
  });
}

function setPaletteActive(dialog: HTMLElement, index: number, scroll = true): void {
  const visible = paletteVisible(dialog);
  const active = visible[Math.min(Math.max(index, 0), visible.length - 1)];
  for (const item of paletteItems(dialog)) item.setAttribute("aria-selected", String(item === active));
  visible.forEach((item, i) => {
    item.dataset.index = String(i);
  });
  const input = paletteInput(dialog);
  if (active) input?.setAttribute("aria-activedescendant", active.id);
  else input?.removeAttribute("aria-activedescendant");
  if (scroll) active?.scrollIntoView({ block: "nearest" });
}

function filterPalette(dialog: HTMLElement, scroll = true): void {
  preparePalette(dialog);
  const list = dialog.querySelector<HTMLElement>(".z-palette__list");
  const q = (paletteInput(dialog)?.value ?? "").trim();
  const groups = [...dialog.querySelectorAll<HTMLElement>(".z-palette__group")];
  // Comandos sueltos, sin grupo: la lista hace de grupo.
  const loose = paletteItems(dialog).filter((item) => !item.closest(".z-palette__group"));
  const sets: Array<[HTMLElement | null, HTMLElement[], string]> = groups.map((group) => [
    group,
    [...group.querySelectorAll<HTMLElement>(".z-palette__item")],
    text(group.querySelector(".z-palette__heading")) || (group.getAttribute("aria-label") ?? ""),
  ]);
  if (loose.length) sets.push([null, loose, ""]);
  let shown = 0;
  for (const [group, items, heading] of sets) {
    const scored = items.map((item) => {
      const keywords = (item.dataset.keywords ?? "")
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
      const s = !q
        ? 1
        : Math.max(
            score(q, text(item.querySelector(".z-palette__item-label")) || text(item)),
            score(q, text(item.querySelector(".z-palette__item-hint"))) * 0.9,
            ...keywords.map((k) => score(q, k) * 0.8),
            score(q, heading) * 0.5,
          );
      item.hidden = s <= 0;
      return { item, s: q ? s : 0 };
    });
    // Mejor coincidencia primero; sin consulta, el orden del marcado.
    scored.sort((a, b) => b.s - a.s || order.get(a.item)! - order.get(b.item)!);
    const parent = group ?? list;
    if (parent && scored.some((entry, i) => entry.item !== items[i])) parent.append(...scored.map((entry) => entry.item));
    const visible = scored.filter((entry) => entry.s > 0 || !q).length;
    if (group) group.hidden = visible === 0;
    shown += visible;
  }
  let empty = dialog.querySelector<HTMLElement>(".z-palette__empty");
  if (!empty && shown === 0 && list) {
    empty = document.createElement("div");
    empty.className = "z-palette__empty";
    empty.setAttribute("role", "status");
    empty.textContent = dialog.dataset.emptyLabel ?? "No results";
    list.prepend(empty);
  }
  if (empty) empty.hidden = shown > 0;
  setPaletteActive(dialog, 0, scroll);
}

function resetPalette(dialog: HTMLElement): void {
  const input = paletteInput(dialog);
  if (input) input.value = "";
  filterPalette(dialog);
  const list = dialog.querySelector(".z-palette__list");
  if (list) list.scrollTop = 0;
  input?.focus({ preventScroll: true });
}

/** Abre una paleta de comandos: consulta vacía, primer comando activo y foco en el campo. */
export function openPalette(dialog: HTMLDialogElement): void {
  if (dialog.open) return;
  openDialog(dialog);
  resetPalette(dialog);
}

function runCommand(dialog: HTMLElement, item: HTMLElement | undefined): void {
  if (!item || isDisabled(item)) return;
  if (dialog instanceof HTMLDialogElement && !dialog.hasAttribute("data-keep-open")) closeDialog(dialog, item.dataset.value ?? item.id);
  emit(item, "select", { value: item.dataset.value ?? item.id });
}

function onPaletteKey(dialog: HTMLElement, event: KeyboardEvent): void {
  const last = paletteVisible(dialog).length - 1;
  const index = paletteIndex(dialog);
  if (event.key === "Escape") {
    if (!(dialog instanceof HTMLDialogElement)) {
      // En línea: Escape vacía la búsqueda (si la hay); si no, sigue su curso.
      const input = paletteInput(dialog);
      if (!input?.value) return;
      event.preventDefault();
      input.value = "";
      filterPalette(dialog);
      return;
    }
    event.preventDefault();
    if (!dialog.hasAttribute("data-z-static")) closeDialog(dialog);
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    setPaletteActive(dialog, Math.min(last, index + 1));
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    setPaletteActive(dialog, Math.max(0, index - 1));
  } else if (event.key === "Home" && last >= 0) {
    event.preventDefault();
    setPaletteActive(dialog, 0);
  } else if (event.key === "End" && last >= 0) {
    event.preventDefault();
    setPaletteActive(dialog, last);
  } else if (event.key === "Enter") {
    event.preventDefault();
    runCommand(dialog, paletteVisible(dialog)[index]);
  }
}

/* ---------- Atajos declarados: data-z-hotkey ---------- */

const EDITABLE = "input, textarea, select, [contenteditable]:not([contenteditable='false'])";

function matchesHotkey(event: KeyboardEvent, spec: string): boolean {
  const parts = spec.toLowerCase().split("+");
  const key = parts.pop();
  const has = (name: string) => parts.includes(name);
  if (!key || event.key.toLowerCase() !== key) return false;
  if (has("mod") ? !(event.ctrlKey || event.metaKey) : event.ctrlKey !== has("ctrl") || event.metaKey !== (has("meta") || has("cmd")))
    return false;
  if (event.altKey !== has("alt")) return false;
  // Sin modificadores, la tecla no debe robarse a un campo de texto; Mayús solo cuenta si se declara con otros.
  if (parts.length === 0) return !(event.target instanceof Element && event.target.closest(EDITABLE));
  return event.shiftKey === has("shift");
}

function onHotkey(event: KeyboardEvent): boolean {
  // El autocompletado del navegador emite `keydown` sin `key`.
  if (typeof event.key !== "string") return false;
  for (const el of document.querySelectorAll<HTMLElement>("[data-z-hotkey]")) {
    if (!(el.dataset.zHotkey ?? "").split(/\s+/).some((spec) => spec && matchesHotkey(event, spec))) continue;
    if (isDisabled(el)) continue;
    event.preventDefault();
    if (el instanceof HTMLDialogElement) {
      if (el.open) closeDialog(el);
      else if (el.matches(PALETTE)) openPalette(el);
      else openDialog(el);
    } else el.click();
    return true;
  }
  return false;
}

/* ---------- Árbol: .z-tree ---------- */

// `data-widget`: el árbol de otra pieza (el panel de TreeSelect), que atiende su propio campo.
const treeOf = (item: Element) => {
  const tree = item.closest<HTMLElement>('[role="tree"]');
  return tree?.hasAttribute("data-widget") ? null : tree;
};
const treeItems = (tree: Element) => [...tree.querySelectorAll<HTMLElement>('[role="treeitem"]')].filter((item) => treeOf(item) === tree);
const treeVisible = (tree: Element) => treeItems(tree).filter((item) => !item.parentElement?.closest(".z-tree__group[hidden]"));
const treeGroup = (item: Element) => item.querySelector<HTMLElement>(":scope > .z-tree__group");
/** Rama: con grupo de hijos o con `data-has-children` (carga diferida, aún sin hijos en el marcado). */
const treeBranch = (item: Element) => treeGroup(item) !== null || item.hasAttribute("data-has-children");
const treeLabel = (item: Element) => text(item.querySelector(":scope > .z-tree__row .z-tree__label"));
const treeValue = (item: HTMLElement) => item.dataset.value ?? (item.id || treeLabel(item));
const treeMulti = (tree: Element) => tree.getAttribute("aria-multiselectable") === "true";
const treeCheckable = (tree: Element) => tree.hasAttribute("data-checkable");
const treeAnchor = new WeakMap<Element, HTMLElement>();

/** Forma del árbol leída del marcado (ids = data-value), para la cascada de casillas de core/tree. */
function treeShape(tree: Element): TreeShape[] {
  const read = (list: Element): TreeShape[] =>
    [...list.children]
      .filter((el): el is HTMLElement => el instanceof HTMLElement && el.getAttribute("role") === "treeitem")
      .map((item) => {
        const group = treeGroup(item);
        return { id: treeValue(item), disabled: isDisabled(item), children: group ? read(group) : undefined };
      });
  return read(tree);
}

function paintChecks(tree: HTMLElement, ids: Iterable<string>): void {
  const states = checkStates(treeShape(tree), ids);
  for (const item of treeItems(tree)) {
    const state = states.get(treeValue(item)) ?? "false";
    item.setAttribute("aria-checked", state);
    const box = item.querySelector<HTMLElement>(":scope > .z-tree__row > .z-tree__check");
    if (box) box.dataset.state = state === "true" ? "checked" : state === "mixed" ? "indeterminate" : "unchecked";
  }
}

const checkedValues = (tree: HTMLElement) =>
  treeItems(tree)
    .filter((item) => item.getAttribute("aria-checked") === "true")
    .map(treeValue);

function setExpanded(item: HTMLElement, open: boolean): void {
  const group = treeGroup(item);
  if (!group) return;
  item.setAttribute("aria-expanded", String(open));
  group.hidden = !open;
  const toggle = item.querySelector<HTMLElement>(":scope > .z-tree__row > .z-tree__toggle");
  if (toggle) toggle.dataset.state = open ? "open" : "closed";
}

function focusTreeItem(tree: Element, item: HTMLElement | null | undefined): void {
  if (!item) return;
  for (const other of treeItems(tree)) other.tabIndex = other === item ? 0 : -1;
  item.focus();
}

function emitTree(tree: HTMLElement): void {
  const items = treeItems(tree);
  const selected = items.filter((item) => item.getAttribute("aria-selected") === "true");
  emit(tree, "change", {
    value: selected[0] ? treeValue(selected[0]) : null,
    ...(treeMulti(tree) ? { values: selected.map(treeValue) } : {}),
    ...(treeCheckable(tree) ? { checked: checkedValues(tree) } : {}),
    expanded: items.filter((item) => item.getAttribute("aria-expanded") === "true").map(treeValue),
  });
}

/** Nodos de una rama que llegan por carga diferida (`setTreeLoader`). El texto va como texto, nunca como marcado. */
export interface TreeNodeData {
  id: string;
  label: string;
  disabled?: boolean;
  hasChildren?: boolean;
  children?: TreeNodeData[];
}

const loaders = new WeakMap<HTMLElement, (value: string) => Promise<TreeNodeData[]>>();

/**
 * Carga diferida: al expandir un nodo con `data-has-children` y sin grupo, el árbol llama a `loader(value)` y pinta
 * los hijos que devuelve (aria-busy mientras tanto). Si falla, la rama se cierra y se anuncia
 * `data-load-error-label` del árbol.
 */
export function setTreeLoader(tree: HTMLElement, loader: (value: string) => Promise<TreeNodeData[]>): void {
  loaders.set(tree, loader);
}

function buildTreeItems(nodes: ReadonlyArray<TreeNodeData>, level: number, checkable: boolean): HTMLElement[] {
  return nodes.map((node, i) => {
    const li = document.createElement("li");
    li.setAttribute("role", "treeitem");
    li.className = "z-tree__item";
    li.dataset.value = node.id;
    li.tabIndex = -1;
    li.setAttribute("aria-selected", "false");
    li.setAttribute("aria-level", String(level));
    li.setAttribute("aria-setsize", String(nodes.length));
    li.setAttribute("aria-posinset", String(i + 1));
    if (node.disabled) li.setAttribute("aria-disabled", "true");
    if (checkable) li.setAttribute("aria-checked", "false");
    const row = document.createElement("div");
    row.className = "z-tree__row";
    row.style.setProperty("--z-tree-level", String(level - 1));
    const toggle = document.createElement("span");
    toggle.className = "z-tree__toggle";
    toggle.dataset.state = "closed";
    toggle.setAttribute("aria-hidden", "true");
    const kids = node.children?.length ? node.children : null;
    if (kids || node.hasChildren) setMarkup(toggle, iconSvg("chevron-right", { size: 12 }));
    row.append(toggle);
    if (checkable) {
      const box = document.createElement("span");
      box.className = "z-check__box z-tree__check";
      box.dataset.state = "unchecked";
      box.setAttribute("aria-hidden", "true");
      const mark = document.createElement("span");
      mark.className = "z-check__mark";
      box.append(mark);
      row.append(box);
    }
    const label = document.createElement("span");
    label.className = "z-tree__label";
    label.textContent = node.label;
    row.append(label);
    li.append(row);
    if (kids) {
      li.setAttribute("aria-expanded", "false");
      const group = document.createElement("ul");
      group.setAttribute("role", "group");
      group.className = "z-tree__group";
      group.hidden = true;
      group.append(...buildTreeItems(kids, level + 1, checkable));
      li.append(group);
    } else if (node.hasChildren) {
      li.setAttribute("aria-expanded", "false");
      li.setAttribute("data-has-children", "");
    }
    return li;
  });
}

function loadTreeChildren(tree: HTMLElement, item: HTMLElement): void {
  const loader = loaders.get(tree);
  if (!loader || item.getAttribute("aria-busy") === "true") return;
  item.setAttribute("aria-busy", "true");
  const toggle = item.querySelector<HTMLElement>(":scope > .z-tree__row > .z-tree__toggle");
  toggle?.setAttribute("data-loading", "");
  const restore = () => {
    item.removeAttribute("aria-busy");
    toggle?.removeAttribute("data-loading");
  };
  loader(treeValue(item)).then(
    (nodes) => {
      restore();
      item.removeAttribute("data-has-children");
      const level = Number(item.getAttribute("aria-level")) || 1;
      const group = document.createElement("ul");
      group.setAttribute("role", "group");
      group.className = "z-tree__group";
      group.append(...buildTreeItems(nodes, level + 1, treeCheckable(tree)));
      item.append(group);
      setExpanded(item, true);
      emitTree(tree);
    },
    () => {
      restore();
      item.setAttribute("aria-expanded", "false");
      if (toggle) toggle.dataset.state = "closed";
      announce(tree.dataset.loadErrorLabel ?? "Couldn't load this folder", { source: tree });
    },
  );
}

/** Expande o pliega un nodo del árbol. */
export function toggleTreeItem(item: HTMLElement, open = item.getAttribute("aria-expanded") !== "true"): void {
  const tree = treeOf(item);
  if (!tree || !treeBranch(item)) return;
  if (!treeGroup(item)) {
    // Carga diferida: los hijos aún no están en el marcado.
    if (open) {
      item.setAttribute("aria-expanded", "true");
      const toggle = item.querySelector<HTMLElement>(":scope > .z-tree__row > .z-tree__toggle");
      if (toggle) toggle.dataset.state = "open";
      loadTreeChildren(tree, item);
    }
    return;
  }
  setExpanded(item, open);
  // El foco itinerante no puede quedar en un nodo oculto.
  if (!open && !treeVisible(tree).some((other) => other.tabIndex === 0))
    for (const other of treeItems(tree)) other.tabIndex = other === item ? 0 : -1;
  emitTree(tree);
}

function setSelection(tree: HTMLElement, chosen: HTMLElement[]): void {
  const set = new Set(chosen.filter((item) => !isDisabled(item)));
  for (const other of treeItems(tree)) other.setAttribute("aria-selected", String(set.has(other)));
}

/** Selecciona un nodo del árbol (solo él, también en selección múltiple). */
export function selectTreeItem(item: HTMLElement): void {
  const tree = treeOf(item);
  if (!tree || isDisabled(item)) return;
  setSelection(tree, [item]);
  treeAnchor.set(tree, item);
  emitTree(tree);
}

/** Marca o desmarca la casilla de un nodo (con cascada a hijos y estado mixto en los padres). */
export function checkTreeItem(item: HTMLElement): void {
  const tree = treeOf(item);
  if (!tree || isDisabled(item) || !treeCheckable(tree)) return;
  paintChecks(tree, toggleCheck(treeShape(tree), checkedValues(tree), treeValue(item)));
  emitTree(tree);
}

function togglePicked(tree: HTMLElement, item: HTMLElement): void {
  if (isDisabled(item)) return;
  item.setAttribute("aria-selected", String(item.getAttribute("aria-selected") !== "true"));
  treeAnchor.set(tree, item);
  emitTree(tree);
}

function extendTree(tree: HTMLElement, item: HTMLElement): void {
  const rows = treeVisible(tree);
  const from = treeAnchor.get(tree);
  const start = from && rows.includes(from) ? from : item;
  treeAnchor.set(tree, start);
  const ids = new Set(rangeIds(rows.map(treeValue), treeValue(start), treeValue(item)));
  setSelection(
    tree,
    rows.filter((row) => ids.has(treeValue(row))),
  );
  emitTree(tree);
}

// Clic, Intro o Espacio: alterna si tiene hijos y selecciona. Un solo z:change.
function activateTreeItem(tree: HTMLElement, item: HTMLElement): void {
  if (isDisabled(item)) return;
  if (treeGroup(item)) setExpanded(item, item.getAttribute("aria-expanded") !== "true");
  else if (treeBranch(item)) toggleTreeItem(item);
  setSelection(tree, [item]);
  treeAnchor.set(tree, item);
  emitTree(tree);
}

/** Abre el campo de renombrar de un nodo (F2 o doble clic con data-renamable en el árbol). Emite z:rename
 *  { value, label } al confirmar; si nadie lo cancela con preventDefault, la etiqueta pasa a mostrar el texto nuevo. */
export function renameTreeItem(item: HTMLElement): void {
  const tree = treeOf(item);
  const labelEl = item.querySelector<HTMLElement>(":scope > .z-tree__row .z-tree__label");
  if (!tree || !labelEl || isDisabled(item) || item.querySelector(":scope > .z-tree__row > .z-tree__rename")) return;
  const input = document.createElement("input");
  input.className = "z-tree__rename";
  input.value = text(labelEl);
  input.setAttribute("aria-label", tree.dataset.renameLabel ?? "Rename");
  labelEl.hidden = true;
  labelEl.after(input);
  let done = false;
  const finish = (keep: boolean) => {
    if (done) return;
    done = true;
    const next = input.value.trim();
    input.remove();
    labelEl.hidden = false;
    if (keep && next && next !== text(labelEl) && emit(tree, "rename", { value: treeValue(item), label: next })) labelEl.textContent = next;
    focusTreeItem(tree, item);
  };
  input.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      finish(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      finish(false);
    }
  });
  input.addEventListener("click", (event) => event.stopPropagation());
  input.addEventListener("blur", () => finish(true));
  input.focus();
  input.select();
}

/* ---------- Árbol: mover nodos (data-draggable) ---------- */

const dragLabels = (tree: HTMLElement, base = localize("treeDrag", TREE_DRAG_LABELS, localeOf(tree))): TreeDragLabels => ({
  grabbed: tree.dataset.dragGrabbedLabel ?? base.grabbed,
  before: tree.dataset.dragBeforeLabel ?? base.before,
  inside: tree.dataset.dragInsideLabel ?? base.inside,
  after: tree.dataset.dragAfterLabel ?? base.after,
  dropped: tree.dataset.dragDroppedLabel ?? base.dropped,
  cancelled: tree.dataset.dragCancelledLabel ?? base.cancelled,
});
const itemByValue = (tree: HTMLElement, value: string) => treeItems(tree).find((item) => treeValue(item) === value);

/** Niveles, posiciones y conmutadores tras mover: cada rama vacía deja de serlo. */
function renumberTree(tree: HTMLElement): void {
  const walk = (list: Element, level: number) => {
    const items = [...list.children].filter((el): el is HTMLElement => el instanceof HTMLElement && el.getAttribute("role") === "treeitem");
    items.forEach((item, i) => {
      item.setAttribute("aria-level", String(level));
      item.setAttribute("aria-setsize", String(items.length));
      item.setAttribute("aria-posinset", String(i + 1));
      item.querySelector<HTMLElement>(":scope > .z-tree__row")?.style.setProperty("--z-tree-level", String(level - 1));
      const group = treeGroup(item);
      const toggle = item.querySelector<HTMLElement>(":scope > .z-tree__row > .z-tree__toggle");
      if (group && !group.children.length) {
        group.remove();
        item.removeAttribute("aria-expanded");
        if (toggle) {
          toggle.textContent = "";
          toggle.dataset.state = "closed";
        }
      } else if (group) {
        if (toggle && !toggle.firstElementChild) setMarkup(toggle, iconSvg("chevron-right", { size: 12 }));
        walk(group, level + 1);
      }
    });
  };
  walk(tree, 1);
}

/**
 * Mueve un nodo del árbol (delante, dentro como último hijo o detrás de otro). Emite `z:move` { value, target,
 * position } cancelable: si la aplicación lo cancela, el marcado no cambia. Devuelve si se movió.
 */
export function moveTreeItem(tree: HTMLElement, drop: TreeDrop): boolean {
  const item = itemByValue(tree, drop.id);
  const target = itemByValue(tree, drop.target);
  if (!item || !target || !validDrop(treeShape(tree), drop)) return false;
  if (!emit(tree, "move", { value: drop.id, target: drop.target, position: drop.position })) return false;
  if (drop.position === "before") target.before(item);
  else if (drop.position === "after") target.after(item);
  else {
    let group = treeGroup(target);
    if (!group) {
      group = document.createElement("ul");
      group.setAttribute("role", "group");
      group.className = "z-tree__group";
      target.append(group);
      target.removeAttribute("data-has-children");
    }
    group.append(item);
    setExpanded(target, true);
  }
  renumberTree(tree);
  announce(fill(dragLabels(tree).dropped, { name: treeLabel(item) }), { source: tree });
  focusTreeItem(tree, item);
  return true;
}

const grabs = new WeakMap<HTMLElement, { id: string; slots: TreeDrop[]; at: number }>();

function paintGrab(tree: HTMLElement): void {
  for (const el of tree.querySelectorAll("[data-drop]")) el.removeAttribute("data-drop");
  for (const el of tree.querySelectorAll("[data-grabbed]")) el.removeAttribute("data-grabbed");
  const g = grabs.get(tree);
  tree.toggleAttribute("data-grabbing", Boolean(g));
  if (!g) return;
  itemByValue(tree, g.id)?.setAttribute("data-grabbed", "");
  const slot = g.slots[g.at];
  if (slot) itemByValue(tree, slot.target)?.querySelector(":scope > .z-tree__row")?.setAttribute("data-drop", slot.position);
}

/** Arrastre con teclado: Ctrl/⌘+X coge, ↑/↓ eligen el sitio, Intro o Ctrl/⌘+V sueltan, Escape cancela. */
function onTreeGrabKey(tree: HTMLElement, item: HTMLElement, event: KeyboardEvent): boolean {
  if (!tree.hasAttribute("data-draggable")) return false;
  const mod = event.ctrlKey || event.metaKey;
  const labels = dragLabels(tree);
  const g = grabs.get(tree);
  if (!g) {
    if (!(mod && !event.altKey && event.key.toLowerCase() === "x") || isDisabled(item)) return false;
    const rows = treeVisible(tree);
    const shape = treeShape(tree);
    const list = rows.map((row) => ({
      id: treeValue(row),
      level: Number(row.getAttribute("aria-level")) || 1,
      last: row.nextElementSibling?.getAttribute("role") !== "treeitem",
      disabled: isDisabled(row),
    }));
    const slots = dropSlots(list, shape, treeValue(item)).filter((d) => validDrop(shape, d));
    const next = rows.slice(rows.indexOf(item) + 1).find((row) => slots.some((s) => s.target === treeValue(row)));
    grabs.set(tree, {
      id: treeValue(item),
      slots,
      at: Math.max(
        0,
        slots.findIndex((s) => next && s.target === treeValue(next)),
      ),
    });
    paintGrab(tree);
    announce(fill(labels.grabbed, { name: treeLabel(item) }), { source: tree });
    event.preventDefault();
    return true;
  }
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    g.at = Math.max(0, Math.min(g.slots.length - 1, g.at + (event.key === "ArrowDown" ? 1 : -1)));
    paintGrab(tree);
    const slot = g.slots[g.at];
    const target = slot ? itemByValue(tree, slot.target) : undefined;
    if (slot && target) announce(fill(labels[slot.position], { name: treeLabel(target) }), { source: tree });
  } else if (event.key === "Enter" || (mod && event.key.toLowerCase() === "v")) {
    const slot = g.slots[g.at];
    grabs.delete(tree);
    paintGrab(tree);
    if (slot) moveTreeItem(tree, slot);
  } else if (event.key === "Escape" || event.key === "Tab") {
    grabs.delete(tree);
    paintGrab(tree);
    announce(labels.cancelled, { source: tree });
    if (event.key === "Tab") return true;
  }
  event.preventDefault();
  event.stopPropagation();
  return true;
}

const draggableTrees = new WeakSet<HTMLElement>();
function bindDomTreeDrag(tree: HTMLElement): void {
  if (draggableTrees.has(tree) || !tree.hasAttribute("data-draggable")) return;
  draggableTrees.add(tree);
  bindTreeDrag(tree, {
    canDrop: (drop) => validDrop(treeShape(tree), drop),
    onDrop: (drop) => void moveTreeItem(tree, drop),
    onStart: (id) => {
      const item = itemByValue(tree, id);
      if (item) announce(fill(dragLabels(tree).grabbed, { name: treeLabel(item) }), { source: tree });
    },
    onCancel: () => announce(dragLabels(tree).cancelled, { source: tree }),
  });
}

function onTreeKey(tree: HTMLElement, item: HTMLElement, event: KeyboardEvent): void {
  if (onTreeGrabKey(tree, item, event)) return;
  const multi = treeMulti(tree);
  const mod = event.ctrlKey || event.metaKey;
  if (multi && mod && !event.altKey && event.key.toLowerCase() === "a") {
    setSelection(tree, treeVisible(tree));
    emitTree(tree);
    event.preventDefault();
    return;
  }
  if (event.altKey || mod) return;
  const rows = treeVisible(tree);
  const at = rows.indexOf(item);
  const hasChildren = treeBranch(item);
  const open = item.getAttribute("aria-expanded") === "true";
  const move = (target: HTMLElement | undefined) => {
    if (!target) return;
    // Sin Mayús, el nodo al que se llega es el ancla del próximo rango; con Mayús, el rango va del ancla a él.
    if (multi && event.shiftKey && !treeAnchor.has(tree)) treeAnchor.set(tree, item);
    focusTreeItem(tree, target);
    if (multi && event.shiftKey) extendTree(tree, target);
    else treeAnchor.set(tree, target);
  };
  // En RTL la flecha que apunta hacia el final de la línea (izquierda) expande.
  switch (logicalKey(event.key, tree)) {
    case "ArrowDown":
      move(rows[at + 1]);
      break;
    case "ArrowUp":
      move(rows[at - 1]);
      break;
    case "Home":
      move(rows[0]);
      break;
    case "End":
      move(rows[rows.length - 1]);
      break;
    case "ArrowRight":
      if (hasChildren && !open) toggleTreeItem(item, true);
      else if (hasChildren) focusTreeItem(tree, rows[at + 1]);
      break;
    case "ArrowLeft":
      if (hasChildren && open) toggleTreeItem(item, false);
      else focusTreeItem(tree, item.parentElement?.closest<HTMLElement>('[role="treeitem"]'));
      break;
    case "F2":
      if (!tree.hasAttribute("data-renamable")) return;
      renameTreeItem(item);
      break;
    case "Enter":
      activateTreeItem(tree, item);
      break;
    case " ":
      if (treeCheckable(tree)) checkTreeItem(item);
      else if (multi) togglePicked(tree, item);
      else activateTreeItem(tree, item);
      break;
    default: {
      // Letra: salta al siguiente nodo visible cuyo nombre empieza por ella.
      if (event.key.length !== 1) return;
      const letter = event.key.toLowerCase();
      const next = [...rows.slice(at + 1), ...rows.slice(0, at)].find((row) => treeLabel(row).toLowerCase().startsWith(letter));
      if (!next) return;
      focusTreeItem(tree, next);
    }
  }
  event.preventDefault();
}

function onTreeClick(tree: HTMLElement, item: HTMLElement, event: MouseEvent): void {
  focusTreeItem(tree, item);
  if ((event.target as Element).closest(".z-tree__check")) checkTreeItem(item);
  else if (treeMulti(tree) && (event.ctrlKey || event.metaKey)) togglePicked(tree, item);
  else if (treeMulti(tree) && event.shiftKey) extendTree(tree, item);
  else activateTreeItem(tree, item);
}

function hydrateTree(tree: HTMLElement): void {
  const items = treeItems(tree);
  bindDomTreeDrag(tree);
  // Árbol largo del servidor: las filas fuera de la vista no se pintan (content-visibility), pero siguen en el documento.
  tree.toggleAttribute("data-deferred", tree.dataset.virtualize !== "false" && items.length > 200);
  for (const item of items) if (treeGroup(item)) setExpanded(item, item.getAttribute("aria-expanded") === "true");
  // Casillas: las hojas mandan; las ramas se recalculan (estado mixto).
  if (treeCheckable(tree))
    paintChecks(tree, items.filter((item) => item.getAttribute("aria-checked") === "true" && !treeGroup(item)).map(treeValue));
  const visible = treeVisible(tree);
  const stop =
    visible.find((item) => item.tabIndex === 0) ?? visible.find((item) => item.getAttribute("aria-selected") === "true") ?? visible[0];
  for (const item of items) item.tabIndex = item === stop ? 0 : -1;
}

/* ---------- Tabla de datos: orden por columna ---------- */

export type SortDirection = "asc" | "desc";
type SortValue = number | string | null;
const rowOrder = new WeakMap<HTMLTableRowElement, number>();
let rowSeq = 0;

function cellValue(cell: HTMLElement | undefined, type: string | undefined): SortValue {
  const raw = (cell?.dataset.sortValue ?? cell?.textContent ?? "").trim();
  if (!raw) return null;
  if (type === "number") {
    // Sin ninguna cifra («n/d», «—») cuenta como vacío, no como cero.
    return parseNumber(raw);
  }
  if (type === "date") {
    const t = Date.parse(raw);
    return Number.isNaN(t) ? null : t;
  }
  return raw;
}

const sortKey = (th: HTMLTableCellElement) => th.dataset.key ?? String(th.cellIndex);

/** Ordena una tabla por la columna de `th`; `direction` null devuelve el orden original. Emite z:sort. */
export function sortTable(th: HTMLTableCellElement, direction: SortDirection | null): void {
  const table = th.closest("table");
  if (!table) return;
  for (const other of table.querySelectorAll<HTMLTableCellElement>("thead th[aria-sort]")) {
    const dir = other === th ? direction : null;
    other.setAttribute("aria-sort", dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none");
    const button = other.querySelector<HTMLElement>(".z-table__sort");
    if (!button) continue;
    button.toggleAttribute("data-active", dir !== null);
    // Icono: flecha abajo solo en descendente, como el binding de React.
    const name = dir === "desc" ? "arrow-down" : "arrow-up";
    const element = button.querySelector("z-icon");
    const svg = button.querySelector("svg.z-icon");
    if (element) {
      if (element.getAttribute("name") !== name) element.setAttribute("name", name);
    } else if (svg && svg.getAttribute("data-icon") !== name) {
      const holder = document.createElement("span");
      setMarkup(holder, iconSvg(name, { size: svg.getAttribute("width") ?? 12 }));
      svg.replaceWith(...holder.childNodes);
    }
  }
  const body = table.tBodies[0];
  if (body && !table.hasAttribute("data-manual-sort")) {
    // Las filas de detalle van con su fila (no se ordenan por su cuenta); con ventana virtual, también las de fuera.
    const all = bodyRowsOf(table);
    const details = new Map<string, HTMLTableRowElement[]>();
    for (const row of all) {
      const of = row.dataset.detailOf;
      if (of !== undefined) details.set(of, [...(details.get(of) ?? []), row]);
    }
    const rows = all.filter((row) => row.dataset.detailOf === undefined);
    // Orden original: el del marcado la primera vez que se ve cada fila.
    for (const row of rows) if (!rowOrder.has(row)) rowOrder.set(row, rowSeq++);
    const factor = direction === "desc" ? -1 : 1;
    const entries = rows.map((row, index) => ({
      row,
      index: rowOrder.get(row) ?? index,
      value: direction ? cellValue(row.cells[th.cellIndex], th.dataset.sort) : null,
    }));
    entries.sort((x, y) => {
      if (!direction) return x.index - y.index;
      // Los vacíos quedan al final en ambos sentidos; el orden original desempata.
      if (x.value === null || y.value === null) return compare(x.value, y.value) || x.index - y.index;
      return compare(x.value, y.value) * factor || x.index - y.index;
    });
    if (entries.some((entry, i) => entry.row !== rows[i]))
      setBodyRows(
        table,
        entries.flatMap((entry) => [entry.row, ...(details.get(entry.row.dataset.rowKey ?? "\u0000") ?? [])]),
      );
  }
  emit(table, "sort", { key: sortKey(th), direction, column: th.cellIndex });
}

/* ---------- Paginación: .z-pagination ---------- */

function pagination(nav: HTMLElement) {
  const buttons = [...nav.querySelectorAll<HTMLButtonElement>(":scope > .z-pagination__btn")];
  const pages = buttons.slice(1, -1);
  const numbers = pages.map((button) => Number(text(button)));
  const count = pageTotal(Number(nav.dataset.pageCount) || Math.max(1, ...numbers.filter(Number.isFinite)));
  const current = Number(text(nav.querySelector(':scope > [aria-current="page"]'))) || 1;
  return { previous: buttons[0], next: buttons[buttons.length - 1], pages, count, current: clampPage(current, count) };
}

function setPageQuiet(nav: HTMLElement, page: number): boolean {
  const { previous, next, pages, count, current } = pagination(nav);
  // Una página que no es un número (NaN) deja la actual.
  const target = clampPage(page, count, current);
  if (!previous || !next || previous === next) return false;
  const hadFocus = nav.contains(document.activeElement);
  const wanted = pageRange(target, count, Math.max(0, Number(nav.dataset.siblings ?? 1) || 0));
  const template = pages[0];
  const byNumber = new Map(pages.map((button) => [Number(text(button)), button]));
  // Solo se toca lo que cambia: se retiran huecos y páginas que ya no van, y se insertan las que faltan.
  for (const gap of nav.querySelectorAll(":scope > .z-pagination__gap")) gap.remove();
  for (const [n, button] of byNumber) if (!wanted.includes(n)) button.remove();
  let cursor: Element | null = previous.nextElementSibling;
  for (const n of wanted) {
    let node: HTMLElement | undefined = n === 0 ? undefined : byNumber.get(n);
    if (node && node === cursor) {
      cursor = node.nextElementSibling;
    } else {
      if (!node && n === 0) {
        node = document.createElement("span");
        node.className = "z-pagination__gap";
        node.setAttribute("aria-hidden", "true");
        node.textContent = "…";
      } else if (!node) {
        node = (template ? template.cloneNode(false) : document.createElement("button")) as HTMLButtonElement;
        node.className = template?.className ?? "z-pagination__btn";
        node.setAttribute("type", "button");
        node.textContent = String(n);
        const old = text(template);
        const label =
          nav.dataset.pageLabel?.replace("{page}", String(n)) ??
          (template?.getAttribute("aria-label")?.includes(old) ? template.getAttribute("aria-label")!.replace(old, String(n)) : String(n));
        node.setAttribute("aria-label", label);
      }
      nav.insertBefore(node, cursor ?? next);
    }
    if (n !== 0) {
      if (n === target) node!.setAttribute("aria-current", "page");
      else node!.removeAttribute("aria-current");
    }
  }
  previous.disabled = target <= 1;
  next.disabled = target >= count;
  const active = document.activeElement as HTMLButtonElement | null;
  if (hadFocus && (!active || !nav.contains(active) || active.disabled))
    nav.querySelector<HTMLElement>(':scope > [aria-current="page"]')?.focus();
  return target !== current;
}

/** Cambia la página actual (desde 1), recalcula el rango y emite z:change con detail.value. */
export function setPage(nav: HTMLElement, page: number): void {
  if (setPageQuiet(nav, page)) emit(nav, "change", { value: pagination(nav).current });
}

/* ---------- Delegación ---------- */

function onClick(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) return;

  // Clic en el velo de la paleta: el objetivo es el propio diálogo.
  if (target instanceof HTMLDialogElement && target.matches(PALETTE)) {
    if (!target.hasAttribute("data-z-static") && pressedOnBackdrop(target, event)) closeDialog(target);
    return;
  }
  const command = target.closest<HTMLElement>(".z-palette__item");
  const owner = command?.closest<HTMLElement>(COMMAND);
  if (command && owner) {
    runCommand(owner, command);
    return;
  }

  if (!inDom(target)) return;

  const row = target.closest<HTMLElement>(".z-tree__row");
  const item = row?.parentElement;
  const tree = item && treeOf(item);
  if (item && tree) {
    if (!target.closest(".z-tree__rename")) onTreeClick(tree, item, event);
    return;
  }

  const sorter = target.closest<HTMLElement>(".z-table__sort");
  const th = sorter?.closest("th");
  if (th) {
    // Ciclo: ascendente, descendente, sin orden.
    const now = th.getAttribute("aria-sort");
    sortTable(th, now === "ascending" ? "desc" : now === "descending" ? null : "asc");
    return;
  }

  const button = target.closest<HTMLButtonElement>(".z-pagination > .z-pagination__btn");
  if (button && !button.disabled) {
    const nav = button.parentElement!;
    const { previous, next, current } = pagination(nav);
    setPage(nav, button === previous ? current - 1 : button === next ? current + 1 : Number(text(button)));
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.defaultPrevented || typeof event.key !== "string") return;
  if (onHotkey(event)) return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  const palette = target.closest<HTMLElement>(COMMAND);
  if (palette && (palette instanceof HTMLDialogElement || target.matches(".z-palette__input"))) {
    onPaletteKey(palette, event);
    return;
  }
  if (!inDom(target) || !target.matches('[role="treeitem"]')) return;
  const tree = treeOf(target);
  if (tree) onTreeKey(tree, target as HTMLElement, event);
}

export function setup(on: Listen): void {
  on(document, "click", onClick);
  on(document, "dblclick", (event) => {
    const target = event.target as Element;
    const label = target.closest?.(".z-tree__label");
    const item = label?.closest<HTMLElement>('[role="treeitem"]');
    const tree = item && treeOf(item);
    if (item && tree && inDom(tree) && tree.hasAttribute("data-renamable")) renameTreeItem(item);
  });
  on(document, "keydown", onKeydown);
  on(document, "input", (event) => {
    const palette = (event.target as Element).closest?.<HTMLElement>(COMMAND);
    if (palette && (event.target as Element).matches(".z-palette__input")) filterPalette(palette);
  });
  on(document, "pointermove", (event) => {
    const item = (event.target as Element).closest?.<HTMLElement>(".z-palette__item");
    const owner = item?.closest<HTMLElement>(COMMAND);
    if (item && owner && item.getAttribute("aria-selected") !== "true") setPaletteActive(owner, paletteVisible(owner).indexOf(item), false);
  });
  // Abierta con data-z-open: empieza limpia igual que con openPalette().
  on(document, "z:open", (event) => {
    if ((event.target as Element).matches?.(PALETTE)) resetPalette(event.target as HTMLElement);
  });
  // Cierre pedido por el navegador (Escape, gesto atrás): pasa por la animación de salida.
  on(
    document,
    "cancel",
    (event) => {
      const dialog = event.target as HTMLDialogElement;
      if (!dialog.matches?.(PALETTE)) return;
      event.preventDefault();
      if (!dialog.hasAttribute("data-z-static")) closeDialog(dialog);
    },
    true,
  );
}

export function hydrate(root: ParentNode): void {
  for (const dialog of root.querySelectorAll<HTMLElement>(PALETTE)) preparePalette(dialog);
  // En línea, a la vista desde el principio: con su primer comando activo.
  for (const command of root.querySelectorAll<HTMLElement>(".z-command")) {
    preparePalette(command);
    filterPalette(command, false);
  }
  for (const tree of root.querySelectorAll<HTMLElement>("[data-z-dom] .z-tree, .z-tree[data-z-dom]"))
    if (!tree.hasAttribute("data-widget")) hydrateTree(tree);
}
