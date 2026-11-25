// Navegación de rejilla de DataTable (patrón APG «data grid») conectada al documento: una sola parada de Tab en el
// cuerpo, flechas entre celdas, Inicio/Fin, Ctrl+Inicio/Fin, RePág/AvPág, F2 o Intro para editar, una letra para
// editar empezando por ella, Mayús+Espacio y Mayús+flechas para seleccionar un rango de filas, y →/← en la primera
// celda para abrir o cerrar un grupo o una rama. La celda activa se recuerda por (clave de fila, columna): sobrevive a
// que la ventana virtual recicle las filas. La comparten el binding de React y el modo DOM; sin efectos al importar.

import { gridMove } from "./datagrid-model";

export interface GridCell {
  row: string;
  /** Índice de la celda dentro de su fila (columnas en el orden pintado). */
  col: number;
}

export interface GridOptions {
  /** Claves de todas las filas navegables del cuerpo, en orden (también las que la ventana virtual no pinta). */
  rowKeys(): ReadonlyArray<string>;
  /** Número de celdas de una fila (por defecto, las que tenga pintadas). */
  colCount?(row: string): number;
  /** Lleva a la vista una fila que aún no está pintada (ventana virtual). */
  reveal?(row: string): void;
  /** ¿Se puede editar la celda? */
  editable?(row: string, col: number): boolean;
  /** Empezar a editar (con la letra pulsada, si la hay). */
  onEdit?(row: string, col: number, seed?: string): void;
  /** →/← en la primera celda de una fila de grupo o de árbol: abrir (`true`) o cerrar (`false`). `false` si no aplica. */
  onToggle?(row: string, open: boolean): boolean;
  /** Mayús+Espacio (con `range`) o Espacio en la casilla: seleccionar la fila. */
  onSelect?(row: string, range: boolean): void;
  /** Mayús+flecha: extender la selección del ancla a la fila. */
  onExtend?(from: string, to: string): void;
  /** Intro en una celda que no se edita: activar la fila. */
  onActivate?(row: string, col: number): void;
  /** La celda activa cambió. */
  onActive?(cell: GridCell): void;
}

export interface GridHandle {
  /** Tras pintar: la parada de Tab a la celda activa (o a la primera) y, si se pidió, el foco. */
  sync(focus?: boolean): void;
  active(): GridCell | null;
  /** Fija la celda activa (y la enfoca con `focus`). */
  setActive(cell: GridCell, focus?: boolean): void;
  destroy(): void;
}

const CONTROLS =
  'button, a[href], input:not([type="hidden"]), select, textarea, [role="checkbox"], [role="switch"], [tabindex]:not(td, th)';
const EDITING = "input, select, textarea, [contenteditable]";

const rowEl = (table: HTMLTableElement, key: string) =>
  [...(table.tBodies[0]?.rows ?? [])].find((tr) => tr.dataset.rowKey === key) as HTMLTableRowElement | undefined;

/** Lo que recibe el foco en una celda: su único control (una casilla, un botón) o la propia celda. */
function focusTarget(cell: HTMLElement): HTMLElement {
  const controls = [...cell.querySelectorAll<HTMLElement>(CONTROLS)].filter((el) => !el.closest("[hidden]"));
  return controls.length === 1 ? controls[0]! : cell;
}

/** Conecta la navegación de rejilla al cuerpo de una tabla. */
export function bindGrid(table: HTMLTableElement, o: GridOptions): GridHandle {
  let current: GridCell | null = null;
  let pending = false;
  let anchor: string | null = null;
  const body = () => table.tBodies[0];
  const cellAt = (cell: GridCell): HTMLElement | null => {
    const tr = rowEl(table, cell.row);
    if (!tr) return null;
    const cells = [...tr.cells];
    return cells[Math.min(cell.col, cells.length - 1)] ?? null;
  };
  /** Una sola parada de Tab: la celda activa (o su control); el resto de celdas y controles del cuerpo fuera. */
  const paint = () => {
    const tbody = body();
    if (!tbody) return;
    const keys = o.rowKeys();
    if (!current || !keys.includes(current.row)) current = keys.length ? { row: keys[0]!, col: current?.col ?? 0 } : null;
    const target = current ? cellAt(current) : null;
    const stop = target ? focusTarget(target) : null;
    for (const el of tbody.querySelectorAll<HTMLElement>(`:scope > tr > :is(td, th), :scope > tr > :is(td, th) :is(${CONTROLS})`)) {
      if (el.closest(EDITING) && el.matches(EDITING)) continue;
      const want = el === stop ? "0" : "-1";
      if (el.getAttribute("tabindex") !== want) el.setAttribute("tabindex", want);
    }
    return stop;
  };
  const focusCell = (cell: GridCell) => {
    current = cell;
    o.onActive?.(cell);
    const el = cellAt(cell);
    if (!el) {
      // Fuera de la ventana virtual: se pide la fila y el foco llega al pintarla (`sync`).
      pending = true;
      o.reveal?.(cell.row);
      return;
    }
    const stop = paint();
    stop?.focus({ preventScroll: true });
    el.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  };
  const cellOf = (target: Element): GridCell | null => {
    const td = target.closest<HTMLTableCellElement>("td, th");
    const tr = td?.parentElement as HTMLTableRowElement | null;
    if (!td || !tr || tr.parentElement !== body() || tr.dataset.rowKey === undefined) return null;
    return { row: tr.dataset.rowKey, col: td.cellIndex };
  };
  const onFocusIn = (event: FocusEvent) => {
    const cell = cellOf(event.target as Element);
    if (!cell) return;
    if (!current || current.row !== cell.row || current.col !== cell.col) {
      current = cell;
      o.onActive?.(cell);
      paint();
    }
  };
  const onKey = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    // Un campo (el editor de la celda, un filtro) atiende sus propias teclas.
    if (target.matches(EDITING) || event.defaultPrevented) return;
    const cell = cellOf(target);
    if (!cell) return;
    const keys = o.rowKeys();
    const at = keys.indexOf(cell.row);
    if (at < 0) return;
    const mod = event.ctrlKey || event.metaKey;
    const cols = o.colCount?.(cell.row) ?? rowEl(table, cell.row)?.cells.length ?? 1;
    // Mayús+flechas verticales: extiende la selección de filas.
    if (event.shiftKey && (event.key === "ArrowDown" || event.key === "ArrowUp") && o.onExtend) {
      const to = keys[at + (event.key === "ArrowDown" ? 1 : -1)];
      if (!to) return;
      event.preventDefault();
      anchor ??= cell.row;
      o.onExtend(anchor, to);
      focusCell({ row: to, col: cell.col });
      return;
    }
    if (event.key === " " && event.shiftKey && o.onSelect) {
      event.preventDefault();
      o.onSelect(cell.row, true);
      anchor = cell.row;
      return;
    }
    if ((event.key === "ArrowRight" || event.key === "ArrowLeft") && cell.col === 0 && !event.shiftKey && o.onToggle) {
      const rtl = getComputedStyle(table).direction === "rtl";
      const open = (event.key === "ArrowRight") !== rtl;
      if (o.onToggle(cell.row, open)) {
        event.preventDefault();
        return;
      }
    }
    const rtl = getComputedStyle(table).direction === "rtl";
    const key = rtl && event.key === "ArrowLeft" ? "ArrowRight" : rtl && event.key === "ArrowRight" ? "ArrowLeft" : event.key;
    const page = Math.max(1, Math.floor((table.parentElement?.clientHeight ?? 400) / 44) - 1);
    const next = event.altKey ? null : gridMove({ row: at, col: cell.col }, key, keys.length, cols, { ctrl: mod, page });
    if (next) {
      event.preventDefault();
      if (!event.shiftKey) anchor = null;
      const row = keys[next.row]!;
      const rowCols = o.colCount?.(row) ?? cols;
      focusCell({ row, col: Math.min(next.col, rowCols - 1) });
      return;
    }
    if (key.startsWith("Arrow") || key === "Home" || key === "End" || key === "PageUp" || key === "PageDown") {
      // En el borde: nada que mover, pero la página no desplaza bajo el foco.
      if (!event.altKey) event.preventDefault();
      return;
    }
    if (event.key === "F2" || event.key === "Enter") {
      if (target !== target.closest("td, th") && event.key === "Enter") return;
      if (o.editable?.(cell.row, cell.col)) {
        event.preventDefault();
        o.onEdit?.(cell.row, cell.col);
      } else if (event.key === "Enter" && o.onActivate) {
        event.preventDefault();
        o.onActivate(cell.row, cell.col);
      }
      return;
    }
    // Una letra en una celda editable empieza a editar con ella.
    if (event.key.length === 1 && !mod && !event.altKey && event.key !== " " && o.editable?.(cell.row, cell.col)) {
      event.preventDefault();
      o.onEdit?.(cell.row, cell.col, event.key);
    }
  };
  table.addEventListener("keydown", onKey);
  table.addEventListener("focusin", onFocusIn);
  return {
    sync(focus = false) {
      const stop = paint();
      if ((pending || focus) && stop && current && cellAt(current)) {
        pending = false;
        stop.focus({ preventScroll: true });
        cellAt(current)?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      }
    },
    active: () => current,
    setActive(cell, focus = false) {
      if (focus) focusCell(cell);
      else {
        current = cell;
        paint();
      }
    },
    destroy() {
      table.removeEventListener("keydown", onKey);
      table.removeEventListener("focusin", onFocusIn);
    },
  };
}
