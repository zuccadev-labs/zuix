// DataTable sin framework: selección de filas y paginación en el cliente (el orden vive en ./collections).
//
// .z-datatable[data-z-dom] (o dentro de [data-z-dom]) con la tabla y su barra (.z-datatable__bar):
//   Selección   casillas .z-check__box en th/td.z-table__select; la de cabecera lleva data-select-all. Cada fila,
//               data-key. Mayús + clic marca un rango. data-selected-label="{n} selected" (texto de .z-datatable__count).
//               z:selectionchange { value: string[] } en .z-datatable. setDataTableSelection(el, keys).
//   Paginación  data-page-size="10" en .z-datatable; .z-pagination y .z-datatable__range en la barra;
//               data-range-label="{from}–{to} of {total}". z:pagechange { value } en .z-datatable. setDataTablePage(el, n).
//   Filtros    fila tr.z-table__filters en thead con input.z-table__filter por columna: oculta las filas cuyo texto en
//               esa columna no contiene el filtro (sin acentos ni mayúsculas) y repagina. z:filterchange { value }.
//   Ancho      span.z-table__resize[role=separator] en las cabeceras: puntero o flechas. z:columnresize { key, width }.
//   Fijadas    th[data-pinned]: la columna queda fija al inicio al desplazar en horizontal.
//   Exportar   button.z-datatable__export: descarga las filas filtradas (todas las páginas) en CSV
//               (data-export-name="table.csv" en .z-datatable).
// La casilla «seleccionar todo» actúa sobre las filas de la página visible; lo seleccionado en otras se conserva.
import { bindColumnResize } from "../core/datagrid-runtime";
import { matchesFilter, toCSV } from "../core/datagrid";
import { download } from "../core/download";
import { headerState, pageCountOf, pageSlice, rangeKeys, toggleAll, toggleKey, type RowKey } from "../core/selection";
import { setPage } from "./collections";
import type { Listen } from "./shared";

const ROOT = ".z-datatable";
const inDom = (el: Element) => el.closest("[data-z-dom]") !== null;
const fill = (template: string, values: Record<string, number>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ""));

function emit(el: Element, name: string, detail?: unknown): void {
  el.dispatchEvent(new CustomEvent(`z:${name}`, { bubbles: true, detail }));
}

const tableOf = (root: Element) => root.querySelector<HTMLTableElement>("table.z-table");
const bodyRows = (root: Element) =>
  [...(tableOf(root)?.tBodies[0]?.rows ?? [])].filter((row) => !row.querySelector(":scope > .z-table__empty"));
const rowBox = (row: Element) => row.querySelector<HTMLElement>(':scope > .z-table__select [role="checkbox"]');
const allBox = (root: Element) => root.querySelector<HTMLElement>('thead .z-table__select [role="checkbox"]');
const keyOf = (row: HTMLTableRowElement) => row.dataset.key ?? String(row.sectionRowIndex);
const off = (box: HTMLElement | null) => !box || box.hasAttribute("data-disabled") || (box as HTMLButtonElement).disabled;
const on = (box: HTMLElement | null) => box?.getAttribute("aria-checked") === "true";

function paintBox(box: HTMLElement, state: "checked" | "unchecked" | "indeterminate"): void {
  box.dataset.state = state;
  box.setAttribute("aria-checked", state === "indeterminate" ? "mixed" : String(state === "checked"));
  let mark = box.querySelector<HTMLElement>(".z-check__mark");
  if (state === "unchecked") mark?.remove();
  else {
    if (!mark) {
      mark = document.createElement("span");
      mark.className = "z-check__mark";
      box.append(mark);
    }
    mark.dataset.state = state;
  }
  const input = box.parentElement?.querySelector<HTMLInputElement>(':scope > input[type="checkbox"]');
  if (input) {
    input.checked = state === "checked";
    input.indeterminate = state === "indeterminate";
  }
}

/** Claves seleccionadas, en el orden de las filas. */
export function dataTableSelection(root: HTMLElement): string[] {
  return bodyRows(root)
    .filter((row) => on(rowBox(row)))
    .map(keyOf);
}

function paintSelection(root: HTMLElement, keys: ReadonlyArray<RowKey>): void {
  const set = new Set(keys.map(String));
  for (const row of bodyRows(root)) {
    const box = rowBox(row);
    const selected = set.has(keyOf(row));
    row.toggleAttribute("data-selected", selected);
    if (box) paintBox(box, selected ? "checked" : "unchecked");
  }
  const visible = bodyRows(root)
    .filter((row) => !row.hidden && !off(rowBox(row)))
    .map(keyOf);
  const header = allBox(root);
  if (header) {
    paintBox(header, headerState(visible, [...set]));
    header.toggleAttribute("disabled", visible.length === 0);
  }
  const count = root.querySelector<HTMLElement>(".z-datatable__count");
  if (count) {
    const text = set.size ? fill(root.dataset.selectedLabel ?? "{n} selected", { n: set.size, total: bodyRows(root).length }) : "";
    if (count.textContent !== text) count.textContent = text;
    count.toggleAttribute("data-empty", set.size === 0);
  }
}

/** Fija la selección (claves de `data-key`) y emite z:selectionchange si cambia. */
export function setDataTableSelection(root: HTMLElement, keys: ReadonlyArray<RowKey>): void {
  const before = dataTableSelection(root).join("\u0000");
  paintSelection(root, keys);
  const after = dataTableSelection(root);
  if (after.join("\u0000") !== before) emit(root, "selectionchange", { value: after });
}

/* ---------- Filtros y exportar ---------- */

const matching = (root: Element) => bodyRows(root).filter((row) => !row.hasAttribute("data-filtered-out"));
const filterInputs = (root: Element) => [...root.querySelectorAll<HTMLInputElement>("thead .z-table__filters .z-table__filter")];

/** Filtros actuales por índice de columna (o `data-key` de la cabecera). */
function readFilters(root: Element): { index: number; key: string; query: string }[] {
  return filterInputs(root)
    .map((input) => {
      const cell = input.closest<HTMLTableCellElement>("th, td");
      const index = cell?.cellIndex ?? -1;
      const head = tableOf(root)?.tHead?.rows[0]?.cells[index] as HTMLElement | undefined;
      return { index, key: head?.dataset.key ?? String(index), query: input.value };
    })
    .filter((f) => f.index >= 0);
}

function applyFilters(root: HTMLElement): void {
  const active = readFilters(root).filter((f) => f.query.trim());
  for (const row of bodyRows(root)) {
    const ok = active.every((f) => matchesFilter(row.cells[f.index]?.textContent ?? "", f.query));
    row.toggleAttribute("data-filtered-out", !ok);
    if (!ok) row.hidden = true;
    else if (!root.dataset.pageSize) row.hidden = false;
  }
  if (root.dataset.pageSize) applyPage(root, 1);
  else paintSelection(root, dataTableSelection(root));
}

/** CSV de las filas que pasan los filtros (todas las páginas), sin la columna de casillas. */
export function dataTableCSVFromDom(root: HTMLElement): string {
  const table = tableOf(root);
  const head = [...(table?.tHead?.rows[0]?.cells ?? [])];
  const columns = head.map((cell, i) => ({ cell, i })).filter(({ cell }) => !cell.classList.contains("z-table__select"));
  const text = (cell: Element | undefined) => (cell?.textContent ?? "").replace(/\s+/g, " ").trim();
  return toCSV([
    columns.map(({ cell }) => text(cell.querySelector(".z-table__sort > span") ?? cell)),
    ...matching(root).map((row) => columns.map(({ i }) => text(row.cells[i]))),
  ]);
}

/* ---------- Paginación ---------- */

const pageOf = new WeakMap<HTMLElement, number>();

function applyPage(root: HTMLElement, wanted: number): number {
  const size = Number(root.dataset.pageSize);
  const rows = matching(root);
  if (!(size > 0)) return 1;
  const count = pageCountOf(rows.length, size);
  const page = Math.min(Math.max(1, Math.round(wanted) || 1), count);
  const { start, end, from, to } = pageSlice(rows.length, page, size);
  rows.forEach((row, i) => {
    row.hidden = i < start || i >= end;
  });
  pageOf.set(root, page);
  const range = root.querySelector<HTMLElement>(".z-datatable__range");
  if (range) {
    const text = fill(root.dataset.rangeLabel ?? "{from}–{to} of {total}", { from, to, total: rows.length });
    if (range.textContent !== text) range.textContent = text;
  }
  const nav = root.querySelector<HTMLElement>(".z-datatable__bar .z-pagination");
  if (nav) {
    nav.dataset.pageCount = String(count);
    setPage(nav, page);
  }
  paintSelection(root, dataTableSelection(root));
  return page;
}

/** Cambia la página visible (desde 1) y emite z:pagechange si cambia. */
export function setDataTablePage(root: HTMLElement, page: number): void {
  const before = pageOf.get(root) ?? 1;
  const after = applyPage(root, page);
  if (after !== before) emit(root, "pagechange", { value: after });
}

/* ---------- Delegación ---------- */

let shift = false;
const anchors = new WeakMap<HTMLElement, string>();

function onChange(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const root = target.closest<HTMLElement>(ROOT);
  if (!root || !inDom(root)) return;
  if (target.matches(".z-pagination")) {
    if (target.closest(".z-datatable__bar")?.closest(ROOT) !== root) return;
    setDataTablePage(root, (event as CustomEvent<{ value: number }>).detail?.value ?? 1);
    return;
  }
  if (!target.matches('[role="checkbox"]') || !target.closest(".z-table__select")) return;
  // La casilla ya cambió (comportamiento común de casillas): se parte del estado anterior.
  const rows = bodyRows(root);
  const order = rows.map(keyOf);
  const now = dataTableSelection(root);
  let next: RowKey[];
  if (target === allBox(root)) {
    const visible = rows.filter((row) => !row.hidden && !off(rowBox(row))).map(keyOf);
    // La cabecera ya cambió: marcada → se marcan todas las visibles; desmarcada → se desmarcan (las de otras páginas
    // se conservan).
    const others = now.filter((k) => !visible.includes(k));
    next = on(target) ? toggleAll(others, visible, order) : others;
  } else {
    const row = target.closest<HTMLTableRowElement>("tr");
    if (!row) return;
    const key = keyOf(row);
    const before = toggleKey(now, key, order);
    const selectable = (k: RowKey) => !off(rowBox(rows[order.indexOf(String(k))]!));
    next = shift ? rangeKeys(before, order, anchors.get(root), key, selectable) : toggleKey(before, key, order);
    anchors.set(root, key);
  }
  // La casilla ya cambió el documento: se pinta lo calculado y se avisa siempre (es un cambio de la persona).
  paintSelection(root, next);
  emit(root, "selectionchange", { value: dataTableSelection(root) });
}

function onSort(event: Event): void {
  const root = (event.target as Element).closest?.<HTMLElement>(ROOT);
  if (root && inDom(root) && root.dataset.pageSize) applyPage(root, pageOf.get(root) ?? 1);
}

function onFilterInput(event: Event): void {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || !input.matches(".z-table__filter")) return;
  const root = input.closest<HTMLElement>(ROOT);
  if (!root || !inDom(root)) return;
  applyFilters(root);
  emit(root, "filterchange", {
    value: Object.fromEntries(
      readFilters(root)
        .filter((f) => f.query)
        .map((f) => [f.key, f.query]),
    ),
  });
}

function onExport(event: Event): void {
  const button = (event.target as Element).closest?.<HTMLElement>(".z-datatable__export");
  const root = button?.closest<HTMLElement>(ROOT);
  if (!button || !root || !inDom(root)) return;
  void download(dataTableCSVFromDom(root), root.dataset.exportName || "table.csv", "text/csv");
}

const bound = new WeakSet<HTMLTableElement>();

export function setup(listen: Listen): void {
  const remember = (event: Event) => {
    shift = (event as MouseEvent | KeyboardEvent).shiftKey === true;
  };
  listen(document, "input", onFilterInput);
  listen(document, "click", onExport);
  listen(document, "click", remember, true);
  listen(document, "keydown", remember, true);
  listen(document, "z:change", onChange);
  listen(document, "z:sort", onSort);
}

export function hydrate(root: ParentNode): void {
  const list = [...root.querySelectorAll<HTMLElement>(ROOT)];
  if (root instanceof HTMLElement && root.matches(ROOT)) list.unshift(root);
  for (const el of list) {
    if (!inDom(el)) continue;
    const table = tableOf(el);
    if (table && !bound.has(table) && table.querySelector("thead .z-table__resize, thead th[data-pinned]")) {
      bound.add(table);
      bindColumnResize(table, { onResize: (key, width) => emit(el, "columnresize", { key, width }) });
    }
    if (filterInputs(el).some((input) => input.value)) applyFilters(el);
    const current = Number(el.querySelector('.z-datatable__bar .z-pagination [aria-current="page"]')?.textContent) || 1;
    if (el.dataset.pageSize) applyPage(el, Number(el.dataset.page) || current);
    else paintSelection(el, dataTableSelection(el));
  }
}
