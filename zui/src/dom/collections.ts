// Comportamiento sin framework de CommandPalette, Tree, DataTable (orden) y Pagination.
// `setup()` conecta los listeners delegados una vez; `hydrate(root)` prepara marcado nuevo.
//
// CommandPalette  <dialog class="z-liquid z-palette" data-z-hotkey="mod+k">: se abre con data-z-open="#id", con el
//                 atajo o con openPalette(el). Filtra por etiqueta, detalle, data-keywords="a,b" y cabecera de grupo.
//                 Emite z:select (detail.value) en el comando elegido. data-keep-open: no cierra al elegir.
// Tree            [data-z-dom] .z-tree: expandir, seleccionar y teclado de árbol. z:change { value, expanded }.
// DataTable       [data-z-dom] .z-table__sort: ordena las filas presentes. En el <th>: data-sort="number|text|date",
//                 data-key; en el <td>: data-sort-value. En la tabla: data-manual-sort (solo avisa). z:sort.
// Pagination      [data-z-dom] .z-pagination: data-page-count, data-siblings, data-page-label="Page {page}".
//                 z:change { value }.
// data-z-hotkey   "mod+k" (mod = Ctrl o Cmd), "ctrl+shift+p", varias separadas por espacio. En un <dialog> lo
//                 alterna; en cualquier otro elemento equivale a pulsarlo.
import { iconSvg, registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { arrowDown } from "@zuccadev-labs/zuix-zicon/icons/arrow-down";
import { arrowUp } from "@zuccadev-labs/zuix-zicon/icons/arrow-up";
import { compare, parseNumber } from "../core/compare";
import { clampPage, pageRange, pageTotal } from "../core/pagination";
import { score } from "../core/search";
import { closeDialog, openDialog } from "./index";
import { logicalKey, pressedOnBackdrop, setMarkup, type Listen } from "./shared";

registerIcons([arrowUp, arrowDown]);

function emit(el: Element, name: string, detail?: unknown): boolean {
  return el.dispatchEvent(new CustomEvent(`z:${name}`, { bubbles: true, cancelable: true, detail }));
}

const inDom = (el: Element) => el.closest("[data-z-dom]") !== null;
const isDisabled = (el: Element) => el.getAttribute("aria-disabled") === "true" || el.hasAttribute("data-disabled") || (el as HTMLButtonElement).disabled === true;

/* ---------- Paleta de comandos: <dialog class="z-liquid z-palette"> ---------- */

const PALETTE = "dialog.z-palette";
let paletteId = 0;
const order = new WeakMap<Element, number>();

const paletteInput = (dialog: Element) => dialog.querySelector<HTMLInputElement>(".z-palette__input");
const paletteItems = (dialog: Element) => [...dialog.querySelectorAll<HTMLElement>(".z-palette__item")];
const paletteVisible = (dialog: Element) => paletteItems(dialog).filter((item) => !item.hidden);
const paletteIndex = (dialog: Element) => Math.max(0, paletteVisible(dialog).findIndex((item) => item.getAttribute("aria-selected") === "true"));
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
  visible.forEach((item, i) => (item.dataset.index = String(i)));
  const input = paletteInput(dialog);
  if (active) input?.setAttribute("aria-activedescendant", active.id);
  else input?.removeAttribute("aria-activedescendant");
  if (scroll) active?.scrollIntoView({ block: "nearest" });
}

function filterPalette(dialog: HTMLElement): void {
  preparePalette(dialog);
  const list = dialog.querySelector<HTMLElement>(".z-palette__list");
  const q = (paletteInput(dialog)?.value ?? "").trim();
  const groups = [...dialog.querySelectorAll<HTMLElement>(".z-palette__group")];
  // Comandos sueltos, sin grupo: la lista hace de grupo.
  const loose = paletteItems(dialog).filter((item) => !item.closest(".z-palette__group"));
  const sets: Array<[HTMLElement | null, HTMLElement[], string]> = groups.map((group) => [group, [...group.querySelectorAll<HTMLElement>(".z-palette__item")], text(group.querySelector(".z-palette__heading")) || (group.getAttribute("aria-label") ?? "")]);
  if (loose.length) sets.push([null, loose, ""]);
  let shown = 0;
  for (const [group, items, heading] of sets) {
    const scored = items.map((item) => {
      const keywords = (item.dataset.keywords ?? "").split(",").map((k) => k.trim()).filter(Boolean);
      const s = !q ? 1 : Math.max(score(q, text(item.querySelector(".z-palette__item-label")) || text(item)), score(q, text(item.querySelector(".z-palette__item-hint"))) * 0.9, ...keywords.map((k) => score(q, k) * 0.8), score(q, heading) * 0.5);
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
  setPaletteActive(dialog, 0);
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

function runCommand(dialog: HTMLDialogElement, item: HTMLElement | undefined): void {
  if (!item || isDisabled(item)) return;
  if (!dialog.hasAttribute("data-keep-open")) closeDialog(dialog, item.dataset.value ?? item.id);
  emit(item, "select", { value: item.dataset.value ?? item.id });
}

function onPaletteKey(dialog: HTMLDialogElement, event: KeyboardEvent): void {
  const last = paletteVisible(dialog).length - 1;
  const index = paletteIndex(dialog);
  if (event.key === "Escape") {
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
  if (has("mod") ? !(event.ctrlKey || event.metaKey) : event.ctrlKey !== has("ctrl") || event.metaKey !== (has("meta") || has("cmd"))) return false;
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

const treeOf = (item: Element) => item.closest<HTMLElement>('[role="tree"]');
const treeItems = (tree: Element) => [...tree.querySelectorAll<HTMLElement>('[role="treeitem"]')].filter((item) => treeOf(item) === tree);
const treeVisible = (tree: Element) => treeItems(tree).filter((item) => !item.parentElement?.closest(".z-tree__group[hidden]"));
const treeGroup = (item: Element) => item.querySelector<HTMLElement>(":scope > .z-tree__group");
const treeLabel = (item: Element) => text(item.querySelector(":scope > .z-tree__row .z-tree__label"));
const treeValue = (item: HTMLElement) => item.dataset.value ?? (item.id || treeLabel(item));

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
  const selected = items.find((item) => item.getAttribute("aria-selected") === "true");
  emit(tree, "change", { value: selected ? treeValue(selected) : null, expanded: items.filter((item) => item.getAttribute("aria-expanded") === "true").map(treeValue) });
}

/** Expande o pliega un nodo del árbol. */
export function toggleTreeItem(item: HTMLElement, open = item.getAttribute("aria-expanded") !== "true"): void {
  const tree = treeOf(item);
  if (!tree || !treeGroup(item)) return;
  setExpanded(item, open);
  // El foco itinerante no puede quedar en un nodo oculto.
  if (!open && !treeVisible(tree).some((other) => other.tabIndex === 0)) for (const other of treeItems(tree)) other.tabIndex = other === item ? 0 : -1;
  emitTree(tree);
}

/** Selecciona un nodo del árbol. */
export function selectTreeItem(item: HTMLElement): void {
  const tree = treeOf(item);
  if (!tree || isDisabled(item)) return;
  for (const other of treeItems(tree)) other.setAttribute("aria-selected", String(other === item));
  emitTree(tree);
}

// Clic, Intro o Espacio: alterna si tiene hijos y selecciona. Un solo z:change.
function activateTreeItem(tree: HTMLElement, item: HTMLElement): void {
  if (isDisabled(item)) return;
  if (treeGroup(item)) setExpanded(item, item.getAttribute("aria-expanded") !== "true");
  for (const other of treeItems(tree)) other.setAttribute("aria-selected", String(other === item));
  emitTree(tree);
}

function onTreeKey(tree: HTMLElement, item: HTMLElement, event: KeyboardEvent): void {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const rows = treeVisible(tree);
  const at = rows.indexOf(item);
  const hasChildren = treeGroup(item) !== null;
  const open = item.getAttribute("aria-expanded") === "true";
  // En RTL la flecha que apunta hacia el final de la línea (izquierda) expande.
  switch (logicalKey(event.key, tree)) {
    case "ArrowDown":
      focusTreeItem(tree, rows[at + 1]);
      break;
    case "ArrowUp":
      focusTreeItem(tree, rows[at - 1]);
      break;
    case "Home":
      focusTreeItem(tree, rows[0]);
      break;
    case "End":
      focusTreeItem(tree, rows[rows.length - 1]);
      break;
    case "ArrowRight":
      if (hasChildren && !open) toggleTreeItem(item, true);
      else if (hasChildren) focusTreeItem(tree, rows[at + 1]);
      break;
    case "ArrowLeft":
      if (hasChildren && open) toggleTreeItem(item, false);
      else focusTreeItem(tree, item.parentElement?.closest<HTMLElement>('[role="treeitem"]'));
      break;
    case "Enter":
    case " ":
      activateTreeItem(tree, item);
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

function hydrateTree(tree: HTMLElement): void {
  const items = treeItems(tree);
  for (const item of items) if (treeGroup(item)) setExpanded(item, item.getAttribute("aria-expanded") === "true");
  const visible = treeVisible(tree);
  const stop = visible.find((item) => item.tabIndex === 0) ?? visible.find((item) => item.getAttribute("aria-selected") === "true") ?? visible[0];
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
    const rows = [...body.rows].filter((row) => !row.querySelector(":scope > .z-table__empty"));
    // Orden original: el del marcado la primera vez que se ve cada fila.
    for (const row of rows) if (!rowOrder.has(row)) rowOrder.set(row, rowSeq++);
    const factor = direction === "desc" ? -1 : 1;
    const entries = rows.map((row, index) => ({ row, index: rowOrder.get(row) ?? index, value: direction ? cellValue(row.cells[th.cellIndex], th.dataset.sort) : null }));
    entries.sort((x, y) => {
      if (!direction) return x.index - y.index;
      // Los vacíos quedan al final en ambos sentidos; el orden original desempata.
      if (x.value === null || y.value === null) return compare(x.value, y.value) || x.index - y.index;
      return compare(x.value, y.value) * factor || x.index - y.index;
    });
    if (entries.some((entry, i) => entry.row !== rows[i])) body.append(...entries.map((entry) => entry.row));
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
        const label = nav.dataset.pageLabel?.replace("{page}", String(n)) ?? (template?.getAttribute("aria-label")?.includes(old) ? template.getAttribute("aria-label")!.replace(old, String(n)) : String(n));
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
  if (hadFocus && (!active || !nav.contains(active) || active.disabled)) nav.querySelector<HTMLElement>(':scope > [aria-current="page"]')?.focus();
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
  const command = target.closest<HTMLElement>(`${PALETTE} .z-palette__item`);
  if (command) return runCommand(command.closest<HTMLDialogElement>(PALETTE)!, command);

  if (!inDom(target)) return;

  const row = target.closest<HTMLElement>(".z-tree__row");
  const item = row?.parentElement;
  const tree = item && treeOf(item);
  if (item && tree) {
    focusTreeItem(tree, item);
    return activateTreeItem(tree, item);
  }

  const sorter = target.closest<HTMLElement>(".z-table__sort");
  const th = sorter?.closest("th");
  if (th) {
    // Ciclo: ascendente, descendente, sin orden.
    const now = th.getAttribute("aria-sort");
    return sortTable(th, now === "ascending" ? "desc" : now === "descending" ? null : "asc");
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
  const palette = target.closest<HTMLDialogElement>(PALETTE);
  if (palette) return onPaletteKey(palette, event);
  if (!inDom(target) || !target.matches('[role="treeitem"]')) return;
  const tree = treeOf(target);
  if (tree) onTreeKey(tree, target as HTMLElement, event);
}

export function setup(on: Listen): void {
  on(document, "click", onClick);
  on(document, "keydown", onKeydown);
  on(document, "input", (event) => {
    const palette = (event.target as Element).closest?.<HTMLElement>(PALETTE);
    if (palette && (event.target as Element).matches(".z-palette__input")) filterPalette(palette);
  });
  on(document, "pointermove", (event) => {
    const item = (event.target as Element).closest?.<HTMLElement>(`${PALETTE} .z-palette__item`);
    if (item && item.getAttribute("aria-selected") !== "true") setPaletteActive(item.closest<HTMLElement>(PALETTE)!, paletteVisible(item.closest(PALETTE)!).indexOf(item), false);
  });
  // Abierta con data-z-open: empieza limpia igual que con openPalette().
  on(document, "z:open", (event) => {
    if ((event.target as Element).matches?.(PALETTE)) resetPalette(event.target as HTMLElement);
  });
  // Cierre pedido por el navegador (Escape, gesto atrás): pasa por la animación de salida.
  on(document, "cancel", (event) => {
    const dialog = event.target as HTMLDialogElement;
    if (!dialog.matches?.(PALETTE)) return;
    event.preventDefault();
    if (!dialog.hasAttribute("data-z-static")) closeDialog(dialog);
  }, true);
}

export function hydrate(root: ParentNode): void {
  for (const dialog of root.querySelectorAll<HTMLElement>(PALETTE)) preparePalette(dialog);
  for (const tree of root.querySelectorAll<HTMLElement>("[data-z-dom] .z-tree, .z-tree[data-z-dom]")) hydrateTree(tree);
}
