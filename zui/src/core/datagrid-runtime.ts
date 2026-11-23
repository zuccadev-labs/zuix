// Redimensionar y fijar columnas de una tabla (DataTable) conectado al documento: lo comparten el binding de React y
// el modo DOM. Un asa `.z-table__resize` (separador con valor) en cada cabecera redimensionable: arrastrar con el
// puntero (captura, Escape cancela) o flechas con el foco (Mayús, 10 veces más). Las columnas `[data-pinned]` quedan
// fijas al inicio con `position: sticky` y su desplazamiento se recalcula al cambiar un ancho.

import { clampWidth, pinOffsets } from "./datagrid";

export interface ResizeOptions {
  /** Ancho nuevo de una columna (al soltar o con cada flecha). */
  onResize?: (key: string, width: number) => void;
  /** «{width} pixels» para aria-valuetext. */
  valueText?: (width: number) => string;
}

const headers = (table: HTMLTableElement) => [...(table.tHead?.rows[0]?.cells ?? [])] as HTMLTableCellElement[];

/** Recalcula el desplazamiento de las columnas fijadas (cabecera, filtros, cuerpo y pie). */
export function layoutPinned(table: HTMLTableElement): void {
  const cells = headers(table);
  if (!cells.some((c) => c.hasAttribute("data-pinned"))) return;
  const widths = cells.map((c) => c.getBoundingClientRect().width);
  const offsets = pinOffsets(
    widths,
    cells.map((c) => c.hasAttribute("data-pinned")),
  );
  const last = cells.map((c) => c.hasAttribute("data-pinned")).lastIndexOf(true);
  for (const row of [...table.rows]) {
    [...row.cells].forEach((cell, i) => {
      if (!cells[i]?.hasAttribute("data-pinned")) return;
      cell.setAttribute("data-pinned", "");
      cell.toggleAttribute("data-pinned-last", i === last);
      cell.style.setProperty("--z-pin-offset", `${offsets[i]}px`);
    });
  }
}

export function bindColumnResize(table: HTMLTableElement, o: ResizeOptions = {}): () => void {
  let drag: { th: HTMLTableCellElement; handle: HTMLElement; startX: number; start: number; id: number; rtl: boolean } | null = null;
  const keyOf = (th: HTMLTableCellElement) => th.dataset.key ?? String(th.cellIndex);
  const set = (th: HTMLTableCellElement, handle: HTMLElement, width: number) => {
    const w = clampWidth(width, Number(handle.getAttribute("aria-valuemin")) || 48, Number(handle.getAttribute("aria-valuemax")) || 1200);
    th.style.width = `${w}px`;
    th.style.minWidth = `${w}px`;
    handle.setAttribute("aria-valuenow", String(w));
    if (o.valueText) handle.setAttribute("aria-valuetext", o.valueText(w));
    layoutPinned(table);
    return w;
  };
  const down = (e: PointerEvent) => {
    const handle = (e.target as Element).closest<HTMLElement>(".z-table__resize");
    const th = handle?.closest<HTMLTableCellElement>("th");
    if (!handle || !th || e.button !== 0) return;
    e.preventDefault();
    drag = {
      th,
      handle,
      startX: e.clientX,
      start: th.getBoundingClientRect().width,
      id: e.pointerId,
      rtl: getComputedStyle(table).direction === "rtl",
    };
    handle.setPointerCapture(e.pointerId);
    table.toggleAttribute("data-resizing", true);
  };
  const move = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = (e.clientX - drag.startX) * (drag.rtl ? -1 : 1);
    set(drag.th, drag.handle, drag.start + dx);
  };
  const end = (e: PointerEvent, cancel = false) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    table.removeAttribute("data-resizing");
    const w = cancel ? set(d.th, d.handle, d.start) : d.th.getBoundingClientRect().width;
    o.onResize?.(keyOf(d.th), clampWidth(w));
  };
  const up = (e: PointerEvent) => end(e);
  const cancel = (e: PointerEvent) => end(e, true);
  const key = (e: KeyboardEvent) => {
    const handle = (e.target as Element).closest<HTMLElement>(".z-table__resize");
    const th = handle?.closest<HTMLTableCellElement>("th");
    if (!handle || !th) return;
    if (e.key === "Escape" && drag) {
      end({ pointerId: drag.id } as PointerEvent, true);
      e.preventDefault();
      return;
    }
    const rtl = getComputedStyle(table).direction === "rtl";
    const step = (e.shiftKey ? 40 : 8) * (e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0) * (rtl ? -1 : 1);
    if (!step) return;
    e.preventDefault();
    const w = set(th, handle, th.getBoundingClientRect().width + step);
    o.onResize?.(keyOf(th), w);
  };
  // El valor del separador es el ancho real (el marcado de servidor solo puede dar uno aproximado).
  for (const handle of table.querySelectorAll<HTMLElement>("thead .z-table__resize")) {
    const th = handle.closest("th");
    const w = th ? Math.round(th.getBoundingClientRect().width) : 0;
    if (w > 0) handle.setAttribute("aria-valuenow", String(w));
  }
  table.addEventListener("pointerdown", down);
  table.addEventListener("pointermove", move);
  table.addEventListener("pointerup", up);
  table.addEventListener("pointercancel", cancel);
  table.addEventListener("keydown", key);
  layoutPinned(table);
  return () => {
    table.removeEventListener("pointerdown", down);
    table.removeEventListener("pointermove", move);
    table.removeEventListener("pointerup", up);
    table.removeEventListener("pointercancel", cancel);
    table.removeEventListener("keydown", key);
  };
}
