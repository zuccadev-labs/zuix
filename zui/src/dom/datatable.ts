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
//
// Rejilla (table[data-grid], o role="grid"/"treegrid"): también en una tabla sin .z-datatable. Cada fila del cuerpo
// lleva data-row-key; las celdas, data-col.
//   Teclado     una parada de Tab en el cuerpo; flechas, Inicio/Fin, Ctrl+Inicio/Fin, RePág/AvPág (core/datagrid-grid).
//   Editar      td[data-editable]: F2, Intro o una letra abren el campo; Intro o Tab confirman, Escape cancela. Reglas
//               en el <th> de la columna: data-editor="text|number|date|select", data-required, data-min, data-max,
//               data-pattern, data-options='[{"value":"a","label":"A"}]'. data-edit-mode="row" en la tabla: la fila
//               entera. z:celledit { key, column, value } (o z:rowedit { key, values }) cancelable: con
//               preventDefault() el valor no se aplica (detail.error, si lo pones, se muestra).
//   Grupos      tr.z-table__group[aria-level][aria-expanded]; árbol: filas con aria-level y aria-expanded. Las filas de
//               más nivel que siguen a una plegada se ocultan. .z-table__toggle, o →/← en la primera celda.
//               z:expandchange { key, expanded }.
//   Detalle     button.z-table__expand[aria-controls] alterna tr.z-table__detail[data-detail-of] (hidden). z:detailchange.
//   Columnas    button.z-table__grip[data-col-key] en la cabecera (data-reorderable en la tabla): arrastrar, o Espacio y
//               ←/→. Mueve las celdas de todas las filas. z:columnorder { value: string[] }.
//   Rango       Mayús+clic en una fila, Mayús+Espacio y Mayús+↑/↓ con casillas de selección.
//   Ventana     data-virtual en la tabla (o más de 200 filas, salvo data-virtualize="false"): solo las filas que se ven
//               están en el documento; Ctrl+F no encuentra las demás (usa los filtros).
import { announce } from "../core/announcer";
import { bindGrid, type GridHandle } from "../core/datagrid-grid";
import { CELL_MESSAGES, moveColumn, validateCell, type CellRules } from "../core/datagrid-model";
import { bindColumnReorder } from "../core/datagrid-reorder";
import { bindColumnResize, layoutPinned } from "../core/datagrid-runtime";
import { matchesFilter, toCSV } from "../core/datagrid";
import { download } from "../core/download";
import { headerState, pageCountOf, pageSlice, rangeKeys, toggleAll, toggleKey, type RowKey } from "../core/selection";
import { setPage } from "./collections";
import type { Listen } from "./shared";
import { bodyRowsOf, refreshBody, revealRow, virtualizeTable } from "./table-store";
import { format } from "../core/locale";

const ROOT = ".z-datatable";
const inDom = (el: Element) => el.closest("[data-z-dom]") !== null;
const fill = (template: string, values: Record<string, number>) => format(template, values, { missing: () => "" });

function emit(el: Element, name: string, detail?: unknown, cancelable = false): boolean {
  return el.dispatchEvent(new CustomEvent(`z:${name}`, { bubbles: true, cancelable, detail }));
}

const tableOf = (root: Element) => (root instanceof HTMLTableElement ? root : root.querySelector<HTMLTableElement>("table.z-table"));
/** Filas de datos del cuerpo (sin detalle ni grupos), también las que la ventana virtual tiene fuera del documento. */
const bodyRows = (root: Element) => {
  const table = tableOf(root);
  return table ? bodyRowsOf(table).filter((row) => row.dataset.detailOf === undefined && !row.classList.contains("z-table__group")) : [];
};
// La casilla de cada fila se busca una vez: con 10 000 filas, buscarla en cada pintado de la selección pesaba segundos.
const boxes = new WeakMap<Element, HTMLElement | null>();
const rowBox = (row: Element) => {
  let box = boxes.get(row);
  if (box === undefined || (box && !row.contains(box))) {
    box = null;
    for (const cell of (row as HTMLTableRowElement).cells ?? [])
      if (cell.classList.contains("z-table__select")) box = cell.querySelector<HTMLElement>('[role="checkbox"]');
    boxes.set(row, box);
  }
  return box;
};
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
  syncDetails(root);
  const table = tableOf(root);
  if (table) refreshBody(table);
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
  syncDetails(root);
  const table = tableOf(root);
  if (table) refreshBody(table);
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

/* ---------- Grupos, árbol y detalle ---------- */

/** Las filas de detalle siguen a su fila: ocultas si está cerrada, filtrada, en otra página o plegada. */
function syncDetails(root: Element): void {
  const table = tableOf(root);
  if (!table) return;
  const byKey = new Map<string, HTMLTableRowElement>();
  for (const row of bodyRowsOf(table))
    if (row.dataset.rowKey !== undefined && row.dataset.detailOf === undefined) byKey.set(row.dataset.rowKey, row);
  for (const detail of bodyRowsOf(table)) {
    const of = detail.dataset.detailOf;
    if (of === undefined) continue;
    const row = byKey.get(of);
    const button = row?.querySelector<HTMLElement>(".z-table__expand");
    const open = button?.getAttribute("aria-expanded") === "true";
    detail.hidden = !row || row.hidden || !open;
  }
}

/** Oculta lo que cuelga de un grupo o una rama plegados (por aria-level) y lo vuelve a mostrar al abrirlos. */
function syncTreeRows(table: HTMLTableElement): void {
  let below: number | null = null;
  for (const row of bodyRowsOf(table)) {
    if (row.dataset.detailOf !== undefined) continue;
    const level = Number(row.getAttribute("aria-level")) || 1;
    if (below !== null && level > below) {
      row.hidden = true;
      row.setAttribute("data-collapsed-out", "");
      continue;
    }
    below = null;
    if (row.hasAttribute("data-collapsed-out")) {
      row.removeAttribute("data-collapsed-out");
      if (!row.hasAttribute("data-filtered-out")) row.hidden = false;
    }
    if (row.getAttribute("aria-expanded") === "false") below = level;
  }
  const root = table.closest<HTMLElement>(ROOT) ?? table;
  syncDetails(root);
  refreshBody(table);
}

/** Abre o pliega un grupo o una rama del árbol (por su data-row-key). Emite z:expandchange. */
export function setDataTableExpanded(table: HTMLTableElement, key: string, expanded: boolean): void {
  const row = bodyRowsOf(table).find((r) => r.dataset.rowKey === key && r.hasAttribute("aria-expanded"));
  if (!row || (row.getAttribute("aria-expanded") === "true") === expanded) return;
  row.setAttribute("aria-expanded", String(expanded));
  row.querySelector(".z-table__toggle")?.setAttribute("data-state", expanded ? "open" : "closed");
  syncTreeRows(table);
  emit(table, "expandchange", { key, expanded });
}

/** Abre o cierra la fila de detalle de una fila. Emite z:detailchange. */
export function setDataTableDetail(table: HTMLTableElement, key: string, open: boolean): void {
  const row = bodyRowsOf(table).find((r) => r.dataset.rowKey === key && r.dataset.detailOf === undefined);
  const button = row?.querySelector<HTMLElement>(".z-table__expand");
  if (!row || !button || (button.getAttribute("aria-expanded") === "true") === open) return;
  button.setAttribute("aria-expanded", String(open));
  button.dataset.state = open ? "open" : "closed";
  syncDetails(table.closest<HTMLElement>(ROOT) ?? table);
  refreshBody(table);
  emit(table, "detailchange", { key, open });
}

/* ---------- Edición en línea ---------- */

const headerCell = (table: HTMLTableElement, cell: HTMLTableCellElement) =>
  table.tHead?.rows[0]?.cells[cell.cellIndex] as HTMLTableCellElement | undefined;
const columnKey = (table: HTMLTableElement, cell: HTMLTableCellElement) =>
  cell.dataset.col ?? headerCell(table, cell)?.dataset.key ?? String(cell.cellIndex);

function rulesOf(th: HTMLElement | undefined): CellRules & { optionList: { value: string; label: string }[] } {
  let optionList: { value: string; label: string }[] = [];
  try {
    const parsed = JSON.parse(th?.dataset.options ?? "[]");
    if (Array.isArray(parsed))
      optionList = parsed
        .filter((o) => o && typeof o.value === "string")
        .map((o) => ({ value: o.value, label: String(o.label ?? o.value) }));
  } catch {
    optionList = [];
  }
  const type = th?.dataset.editor as CellRules["type"];
  return {
    type: type === "number" || type === "date" || type === "select" ? type : "text",
    required: th?.hasAttribute("data-required"),
    min: th?.dataset.min,
    max: th?.dataset.max,
    pattern: th?.dataset.pattern,
    options: type === "select" ? optionList.map((o) => o.value) : undefined,
    optionList,
  };
}

const editing = new WeakMap<
  HTMLTableElement,
  { row: HTMLTableRowElement; cells: Map<HTMLTableCellElement, Node[]>; focus: HTMLTableCellElement }
>();
const grids = new WeakMap<HTMLTableElement, GridHandle>();

function closeEditor(table: HTMLTableElement, refocus: boolean): void {
  const state = editing.get(table);
  if (!state) return;
  editing.delete(table);
  for (const [cell, nodes] of state.cells) {
    cell.replaceChildren(...nodes);
    cell.removeAttribute("data-editing");
  }
  state.row.classList.remove("z-table__row--editing");
  if (refocus) grids.get(table)?.setActive({ row: state.row.dataset.rowKey ?? "", col: state.focus.cellIndex }, true);
}

function fieldOf(cell: HTMLTableCellElement) {
  return cell.querySelector<HTMLInputElement | HTMLSelectElement>(".z-table__input");
}

function showError(cell: HTMLTableCellElement, text: string | null): void {
  const box = cell.querySelector<HTMLElement>(".z-table__editor");
  const field = fieldOf(cell);
  if (!box || !field) return;
  box.toggleAttribute("data-invalid", Boolean(text));
  let error = box.querySelector<HTMLElement>(".z-table__error");
  if (text) {
    if (!error) {
      error = document.createElement("span");
      error.className = "z-table__error";
      error.id = `z-cell-error-${++errorSeq}`;
      box.append(error);
    }
    error.textContent = text;
    field.setAttribute("aria-invalid", "true");
    field.setAttribute("aria-describedby", error.id);
  } else {
    error?.remove();
    field.removeAttribute("aria-invalid");
    field.removeAttribute("aria-describedby");
  }
}
let errorSeq = 0;

/** Confirma lo editado: valida, emite z:celledit (o z:rowedit) y, si nadie lo cancela, escribe el texto en las celdas. */
function commitEditor(table: HTMLTableElement): boolean {
  const state = editing.get(table);
  if (!state) return true;
  const values: Record<string, string> = {};
  let firstError: string | null = null;
  for (const cell of state.cells.keys()) {
    const field = fieldOf(cell);
    const value = field?.value ?? "";
    const error = validateCell(value, rulesOf(headerCell(table, cell)), {
      ...CELL_MESSAGES,
      ...(JSON.parse(table.dataset.validationMessages ?? "{}") as Partial<typeof CELL_MESSAGES>),
    });
    showError(cell, error);
    firstError ??= error;
    values[columnKey(table, cell)] = value;
  }
  if (firstError) {
    announce(firstError, { source: table });
    return false;
  }
  const key = state.row.dataset.rowKey ?? "";
  const single = state.cells.size === 1 && table.dataset.editMode !== "row";
  const detail: Record<string, unknown> = single
    ? { key, column: Object.keys(values)[0], value: Object.values(values)[0] }
    : { key, values };
  if (!emit(table, single ? "celledit" : "rowedit", detail, true)) {
    const reason = typeof detail.error === "string" ? detail.error : null;
    if (reason) {
      showError(state.focus, reason);
      announce(reason, { source: table });
    }
    return false;
  }
  for (const cell of state.cells.keys()) {
    const field = fieldOf(cell);
    const rules = rulesOf(headerCell(table, cell));
    const text =
      rules.type === "select"
        ? (rules.optionList.find((o) => o.value === field?.value)?.label ?? field?.value ?? "")
        : (field?.value ?? "");
    state.cells.set(cell, [document.createTextNode(text)]);
  }
  closeEditor(table, true);
  return true;
}

/** Abre el editor de una celda (o de la fila con data-edit-mode="row"). `seed`: la letra con la que se empezó. */
function openEditor(table: HTMLTableElement, row: HTMLTableRowElement, focusCell: HTMLTableCellElement, seed?: string): void {
  if (editing.has(table)) closeEditor(table, false);
  const cells =
    table.dataset.editMode === "row"
      ? [...row.cells].filter((c) => c.hasAttribute("data-editable"))
      : [focusCell].filter((c) => c.hasAttribute("data-editable"));
  if (!cells.length) return;
  const state = { row, cells: new Map<HTMLTableCellElement, Node[]>(), focus: focusCell };
  editing.set(table, state);
  row.classList.add("z-table__row--editing");
  for (const cell of cells) {
    const th = headerCell(table, cell);
    const rules = rulesOf(th);
    const current = cell.dataset.editValue ?? cell.textContent?.trim() ?? "";
    state.cells.set(cell, [...cell.childNodes]);
    const box = document.createElement("span");
    box.className = "z-table__editor";
    let field: HTMLInputElement | HTMLSelectElement;
    if (rules.type === "select") {
      const select = document.createElement("select");
      if (!rules.required) select.append(new Option("", ""));
      for (const o of rules.optionList) select.append(new Option(o.label, o.value));
      select.value = rules.optionList.find((o) => o.label === current)?.value ?? current;
      field = select;
    } else {
      const input = document.createElement("input");
      input.type = rules.type === "date" ? "date" : "text";
      if (rules.type === "number") input.inputMode = "decimal";
      input.value = cell === focusCell && seed !== undefined ? seed : current;
      field = input;
    }
    field.className = "z-input__control z-table__input";
    field.setAttribute("aria-label", `${table.dataset.editLabel ?? "Edit"} ${(th?.textContent ?? "").trim()}`.trim());
    box.append(field);
    cell.replaceChildren(box);
    cell.setAttribute("data-editing", "");
  }
  const field = fieldOf(focusCell);
  field?.focus({ preventScroll: true });
  if (field instanceof HTMLInputElement && field.type !== "date") {
    if (seed !== undefined) field.setSelectionRange(field.value.length, field.value.length);
    else field.select();
  }
}

function onEditorKey(event: KeyboardEvent): void {
  const field = (event.target as Element).closest?.<HTMLElement>(".z-table__input");
  const table = field?.closest<HTMLTableElement>("table");
  if (!field || !table || !editing.has(table)) return;
  const state = editing.get(table)!;
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    closeEditor(table, true);
  } else if (event.key === "Enter" && !event.isComposing) {
    event.preventDefault();
    commitEditor(table);
  } else if (event.key === "Tab" && table.dataset.editMode !== "row") {
    // Por celda: Tab confirma y abre la siguiente celda editable de la fila (Mayús, la anterior).
    const cells = [...state.row.cells].filter((c) => c.hasAttribute("data-editable"));
    const cell = field.closest<HTMLTableCellElement>("td, th")!;
    const next = cells[cells.indexOf(cell) + (event.shiftKey ? -1 : 1)];
    if (!next) return;
    event.preventDefault();
    const row = state.row;
    if (commitEditor(table)) openEditor(table, row, next);
  }
}

/* ---------- Rejilla y columnas ---------- */

const navRows = (table: HTMLTableElement) => bodyRowsOf(table).filter((row) => !row.hidden && row.dataset.rowKey !== undefined);

function setupGrid(table: HTMLTableElement): void {
  if (grids.has(table)) return;
  const root = table.closest<HTMLElement>(ROOT);
  const rowByKey = (key: string) => bodyRowsOf(table).find((r) => r.dataset.rowKey === key);
  const g = bindGrid(table, {
    rowKeys: () => navRows(table).map((r) => r.dataset.rowKey!),
    reveal: (key) => {
      const row = rowByKey(key);
      if (row) revealRow(table, row);
      requestAnimationFrame(() => grids.get(table)?.sync());
    },
    editable: (key, col) => Boolean(rowByKey(key)?.cells[col]?.hasAttribute("data-editable")),
    onEdit: (key, col, seed) => {
      const row = rowByKey(key);
      const cell = row?.cells[col];
      if (row && cell) openEditor(table, row, cell, seed);
    },
    onToggle: (key, open) => {
      const row = rowByKey(key);
      if (!row) return false;
      if (row.hasAttribute("aria-expanded") && (row.getAttribute("aria-expanded") === "true") !== open) {
        setDataTableExpanded(table, key, open);
        return true;
      }
      if (!open) {
        // ← en un hijo lleva a su padre: la fila anterior de menos nivel.
        const level = Number(row.getAttribute("aria-level")) || 0;
        if (level <= 1) return false;
        const rows = navRows(table);
        const parent = rows
          .slice(0, rows.indexOf(row))
          .reverse()
          .find((r) => (Number(r.getAttribute("aria-level")) || 1) < level);
        if (parent) {
          grids.get(table)?.setActive({ row: parent.dataset.rowKey!, col: 0 }, true);
          return true;
        }
      }
      return false;
    },
    onSelect: (key, range) => {
      if (!root) return;
      const row = rowByKey(key);
      if (!row?.dataset.key) return;
      const rows = bodyRows(root);
      const order = rows.map(keyOf);
      const now = dataTableSelection(root);
      const selectable = (k: RowKey) => !off(rowBox(rows[order.indexOf(String(k))]!));
      const next = range ? rangeKeys(now, order, anchors.get(root), row.dataset.key, selectable) : toggleKey(now, row.dataset.key, order);
      anchors.set(root, row.dataset.key);
      setDataTableSelection(root, next);
    },
    onExtend: (from, to) => {
      if (!root) return;
      const a = rowByKey(from)?.dataset.key;
      const b = rowByKey(to)?.dataset.key;
      if (a === undefined || b === undefined) return;
      const order = bodyRows(root).map(keyOf);
      const i = order.indexOf(a);
      const j = order.indexOf(b);
      if (i < 0 || j < 0) return;
      const range = order.slice(Math.min(i, j), Math.max(i, j) + 1);
      setDataTableSelection(root, [...new Set([...dataTableSelection(root), ...range])]);
    },
    onActivate: (key) => {
      const row = rowByKey(key);
      if (row?.hasAttribute("aria-expanded")) setDataTableExpanded(table, key, row.getAttribute("aria-expanded") !== "true");
      else row?.click();
    },
  });
  grids.set(table, g);
  g.sync();
}

function setupReorder(table: HTMLTableElement): void {
  const head = table.tHead?.rows[0];
  if (!head || !table.querySelector(".z-table__grip")) return;
  const keys = () =>
    [...head.cells].map((th) => th.querySelector<HTMLElement>(".z-table__grip")?.dataset.colKey).filter((k): k is string => Boolean(k));
  bindColumnReorder(table, {
    order: keys,
    nameOf: (key) => {
      const th = [...head.cells].find((c) => c.querySelector<HTMLElement>(".z-table__grip")?.dataset.colKey === key);
      return (th?.querySelector(".z-table__sort > span") ?? th)?.textContent?.trim() ?? key;
    },
    announce: (text) => announce(text, { source: table }),
    onMove: (key, to) => {
      const now = keys();
      const next = moveColumn(now, key, to);
      if (next.join("\u0000") === now.join("\u0000")) return;
      const indexOf = (k: string) => [...head.cells].findIndex((c) => c.querySelector<HTMLElement>(".z-table__grip")?.dataset.colKey === k);
      const from = indexOf(key);
      const target = next[next.indexOf(key) + 1];
      const before = target === undefined ? -1 : indexOf(target);
      const last = indexOf(now[now.length - 1]!);
      const width = head.cells.length;
      // Las celdas de cada fila con todas sus columnas se mueven igual (cabecera, filtros, cuerpo, pie y lo que la
      // ventana virtual tiene fuera del documento).
      const rows = [...(table.tHead?.rows ?? []), ...bodyRowsOf(table), ...(table.tFoot?.rows ?? [])];
      for (const row of rows) {
        if (row.cells.length !== width) continue;
        const cell = row.cells[from]!;
        const ref = before >= 0 ? row.cells[before] : null;
        if (ref) row.insertBefore(cell, ref);
        else row.cells[last]?.after(cell);
      }
      layoutPinned(table);
      emit(table, "columnorder", { value: keys() });
    },
  });
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

function onGridClick(event: Event): void {
  const target = event.target as Element;
  const table = target.closest?.<HTMLTableElement>("table.z-table");
  if (!table || !inDom(table)) return;
  const toggle = target.closest<HTMLElement>(".z-table__toggle");
  const row = target.closest<HTMLTableRowElement>("tbody > tr");
  if (toggle && row?.dataset.rowKey !== undefined) {
    event.stopPropagation();
    setDataTableExpanded(table, row.dataset.rowKey, row.getAttribute("aria-expanded") !== "true");
    return;
  }
  const expand = target.closest<HTMLElement>(".z-table__expand");
  if (expand && row?.dataset.rowKey !== undefined) {
    setDataTableDetail(table, row.dataset.rowKey, expand.getAttribute("aria-expanded") !== "true");
    return;
  }
  if (row?.classList.contains("z-table__group") && row.dataset.rowKey !== undefined) {
    setDataTableExpanded(table, row.dataset.rowKey, row.getAttribute("aria-expanded") !== "true");
    return;
  }
  // Mayús+clic en una fila con casilla: rango desde el ancla.
  const root = table.closest<HTMLElement>(ROOT);
  if (root && row && (event as MouseEvent).shiftKey && rowBox(row) && !target.closest(".z-table__select, button, a, input, select")) {
    const rows = bodyRows(root);
    const order = rows.map(keyOf);
    const selectable = (k: RowKey) => !off(rowBox(rows[order.indexOf(String(k))]!));
    setDataTableSelection(root, rangeKeys(dataTableSelection(root), order, anchors.get(root), keyOf(row), selectable));
    anchors.set(root, keyOf(row));
  }
}

function onEditorBlur(event: FocusEvent): void {
  const field = (event.target as Element).closest?.<HTMLElement>(".z-table__input");
  const table = field?.closest<HTMLTableElement>("table");
  if (!field || !table || !editing.has(table)) return;
  const next = event.relatedTarget as Node | null;
  // Por celda, salir confirma si vale (si no, descarta); dentro de la fila que se edita, nada.
  if (next && editing.get(table)!.row.contains(next)) return;
  if (!commitEditor(table)) closeEditor(table, false);
}

export function setup(listen: Listen): void {
  const remember = (event: Event) => {
    shift = (event as MouseEvent | KeyboardEvent).shiftKey === true;
  };
  listen(document, "click", onGridClick);
  listen(document, "keydown", onEditorKey as (event: Event) => void);
  listen(document, "focusout", onEditorBlur as (event: Event) => void);
  listen(document, "input", onFilterInput);
  listen(document, "click", onExport);
  listen(document, "click", remember, true);
  listen(document, "keydown", remember, true);
  listen(document, "z:change", onChange);
  listen(document, "z:sort", onSort);
}

/** Rejilla, ventana virtual, grupos y columnas de una tabla (dentro de .z-datatable o suelta). */
function hydrateGridTable(table: HTMLTableElement): void {
  const wrap = table.closest<HTMLElement>(".z-table-wrap");
  const rows = bodyRowsOf(table);
  if (table.hasAttribute("aria-level") || rows.some((r) => r.hasAttribute("aria-expanded"))) syncTreeRows(table);
  else syncDetails(table.closest<HTMLElement>(ROOT) ?? table);
  const auto = table.dataset.virtualize !== "false" && rows.length > 200;
  if (wrap && (table.hasAttribute("data-virtual") || auto)) virtualizeTable(table, wrap, table.dataset.density === "compact" ? 37 : 45);
  if (table.hasAttribute("data-grid") || table.getAttribute("role") === "grid" || table.getAttribute("role") === "treegrid")
    setupGrid(table);
  if (table.hasAttribute("data-reorderable")) setupReorder(table);
}
const gridTables = new WeakSet<HTMLTableElement>();

export function hydrate(root: ParentNode): void {
  for (const table of root.querySelectorAll<HTMLTableElement>("table.z-table")) {
    if (gridTables.has(table) || !inDom(table)) continue;
    if (!table.closest(ROOT) && !table.matches("[data-grid], [data-virtual], [data-reorderable], [role=grid], [role=treegrid]")) continue;
    gridTables.add(table);
    hydrateGridTable(table);
  }
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
