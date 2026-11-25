// Filas del cuerpo de una tabla del modo DOM, estén en el documento o guardadas por la ventana virtual. Con ventana
// virtual (DataTable con `data-virtual`, o más de 200 filas), las filas del marcado salen del documento a una lista y
// solo vuelven las que se ven (más la que tiene el foco), entre dos rellenos; el orden, los filtros, las páginas y lo
// plegado trabajan sobre la lista (una fila oculta lleva `hidden`). El núcleo es el de core/virtual-runtime.

import { applyPinned } from "../core/datagrid-runtime";
import { createVirtualizer, type Virtualizer } from "../core/virtual-runtime";

interface Store {
  rows: HTMLTableRowElement[];
  before: HTMLTableRowElement;
  after: HTMLTableRowElement;
  v: Virtualizer;
  visible: HTMLTableRowElement[];
  /** Posición de cada fila en `rows` (para aria-rowindex sin recorrer la lista). */
  pos: Map<HTMLTableRowElement, number>;
}

const stores = new WeakMap<HTMLTableElement, Store>();
const real = (row: HTMLTableRowElement) => !row.classList.contains("z-table__spacer") && !row.querySelector(":scope > .z-table__empty");

/** Filas del cuerpo en su orden (también las que la ventana virtual tiene fuera del documento). */
export function bodyRowsOf(table: HTMLTableElement): HTMLTableRowElement[] {
  const store = stores.get(table);
  if (store) return store.rows;
  return [...(table.tBodies[0]?.rows ?? [])].filter(real);
}

/** ¿La tabla tiene ventana virtual? */
export const isVirtualTable = (table: HTMLTableElement) => stores.has(table);

/** Fija un orden nuevo de las filas del cuerpo (ordenar, mover). */
export function setBodyRows(table: HTMLTableElement, rows: HTMLTableRowElement[]): void {
  const store = stores.get(table);
  if (store) {
    store.rows = rows;
    store.pos = new Map(rows.map((row, i) => [row, i]));
    refreshBody(table);
    return;
  }
  const body = table.tBodies[0];
  if (!body) return;
  const now = [...body.rows].filter(real);
  if (rows.some((row, i) => row !== now[i])) body.append(...rows);
}

/** Vuelve a pintar la ventana tras cambiar qué filas se ven (filtros, páginas, grupos, ramas, detalle). */
export function refreshBody(table: HTMLTableElement): void {
  const store = stores.get(table);
  if (!store) return;
  store.visible = store.rows.filter((row) => !row.hidden);
  store.v.update({ count: store.visible.length }, true);
}

/** Lleva a la vista una fila (aunque la ventana virtual no la tenga en el documento). */
export function revealRow(table: HTMLTableElement, row: HTMLTableRowElement): void {
  const store = stores.get(table);
  if (!store) {
    row.scrollIntoView?.({ block: "nearest" });
    return;
  }
  const at = store.visible.indexOf(row);
  if (at >= 0) store.v.scrollToIndex(at);
}

function spacer(span: number): HTMLTableRowElement {
  const tr = document.createElement("tr");
  tr.className = "z-table__spacer";
  tr.setAttribute("role", "presentation");
  const td = document.createElement("td");
  td.setAttribute("aria-hidden", "true");
  td.colSpan = span;
  tr.append(td);
  return tr;
}

/**
 * Activa la ventana virtual sobre las filas del cuerpo. `scroller` es el contenedor que desplaza (`.z-table-wrap`);
 * `rowHeight`, el alto estimado (las filas se miden al pintarse).
 */
export function virtualizeTable(table: HTMLTableElement, scroller: HTMLElement, rowHeight = 45): void {
  const body = table.tBodies[0];
  if (!body || stores.has(table)) return;
  const rows = [...body.rows].filter(real);
  const span = table.tHead?.rows[0]?.cells.length ?? rows[0]?.cells.length ?? 1;
  const before = spacer(span);
  const after = spacer(span);
  const keyOf = new WeakMap<HTMLTableRowElement, string>();
  let seq = 0;
  const key = (row: HTMLTableRowElement) => {
    let k = keyOf.get(row);
    if (!k) {
      k = `r${seq++}`;
      keyOf.set(row, k);
      row.dataset.vkey = k;
    }
    return k;
  };
  const headRows = table.tHead?.rows.length ?? 0;
  table.setAttribute("aria-rowcount", String(headRows + rows.length + (table.tFoot?.rows.length ?? 0)));
  const paint = () => {
    const store = stores.get(table);
    if (!store) return;
    // La ventana ya trae la fila con el foco (`keep`): el foco sobrevive al reciclado.
    const win = store.v.window();
    const shown = win.indices.map((i) => store.visible[i]!).filter(Boolean);
    before.cells[0]!.style.setProperty("--z-virtual-space", `${Math.round(win.before)}px`);
    after.cells[0]!.style.setProperty("--z-virtual-space", `${Math.round(win.after)}px`);
    // Posición de cada fila para los lectores (no están todas en el documento).
    for (const row of shown) row.setAttribute("aria-rowindex", String(headRows + (store.pos.get(row) ?? 0) + 1));
    const want = [before, ...shown, after];
    const now = [...body.children];
    if (want.length !== now.length || want.some((el, i) => el !== now[i])) {
      body.replaceChildren(...want);
      // Las filas que vuelven al documento llevan el desplazamiento de las columnas fijadas.
      if (table.tHead?.querySelector("th[data-pinned]")) applyPinned(table);
    }
    store.v.measure(body, ":scope > tr[data-vkey]", "data-vkey");
  };
  const visible = rows.filter((row) => !row.hidden);
  for (const row of rows) key(row);
  let focusedAt = -1;
  const store: Store = {
    rows,
    before,
    after,
    visible,
    pos: new Map(rows.map((row, i) => [row, i])),
    v: createVirtualizer(scroller, {
      count: visible.length,
      size: rowHeight,
      key: (i) => key(stores.get(table)?.visible[i] ?? rows[i]!),
      overscan: 8,
      keep: () => (focusedAt >= 0 ? [focusedAt] : []),
      offset: () => body.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop,
      onChange: () => paint(),
    }),
  };
  stores.set(table, store);
  // La fila con el foco se recuerda al enfocarla (no en cada fotograma de desplazamiento).
  body.addEventListener("focusin", (event) => {
    const row = (event.target as Element).closest?.("tr");
    focusedAt = row ? store.visible.indexOf(row as HTMLTableRowElement) : -1;
  });
  scroller.classList.add("z-table-wrap--virtual");
  table.setAttribute("data-virtual", "");
  table.toggleAttribute("data-sticky", true);
  paint();
}
