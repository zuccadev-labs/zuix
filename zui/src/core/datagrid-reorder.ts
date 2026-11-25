// Reordenar columnas de DataTable con el puntero y con el teclado, conectado al documento. Cada cabecera
// reordenable lleva un asa (`button.z-table__grip[data-col-key]`): arrastrarla marca en la cabecera de destino dónde caerá
// (`data-drop` = before|after) y mueve al soltar; con el teclado, Espacio o Intro la cogen (aria-pressed), ←/→ la mueven
// una posición cada vez (anunciado), Espacio o Intro la sueltan y Escape la devuelve a su sitio. Quien lo usa cambia el
// orden (`onMove`); el asa recupera el foco tras volver a pintar. Lo comparten React y el modo DOM; sin efectos al importar.

import { fill } from "./vnode";

export interface ReorderLabels {
  /** «{name} grabbed, position {pos} of {count}. Left and right arrows move it, Space drops, Escape cancels.» */
  grabbed: string;
  /** «{name}, position {pos} of {count}» */
  moved: string;
  /** «{name} dropped at position {pos} of {count}» */
  dropped: string;
  /** «Move cancelled, {name} back at position {pos}» */
  cancelled: string;
}

export const REORDER_LABELS: ReorderLabels = {
  grabbed: "{name} grabbed, position {pos} of {count}. Left and right arrows move it, Space drops, Escape cancels.",
  moved: "{name}, position {pos} of {count}",
  dropped: "{name} dropped at position {pos} of {count}",
  cancelled: "Move cancelled, {name} back at position {pos}",
};

export interface ReorderOptions {
  /** Orden actual de las columnas que se pueden mover. */
  order(): ReadonlyArray<string>;
  /** Mover `key` a la posición `to` (0 es la primera de las reordenables). */
  onMove(key: string, to: number): void;
  /** Nombre de una columna para los anuncios. */
  nameOf(key: string): string;
  announce(text: string): void;
  labels?: Partial<ReorderLabels>;
}

const GRIP = ".z-table__grip";

/** Conecta el reordenado de columnas a una tabla. Devuelve la función que lo desconecta. */
export function bindColumnReorder(table: HTMLTableElement, o: ReorderOptions): () => void {
  const labels = { ...REORDER_LABELS, ...o.labels };
  let grab: { key: string; from: number } | null = null;
  let drag: { key: string; pointer: number; drop: { key: string; side: "before" | "after" } | null; x: number; started: boolean } | null =
    null;
  const say = (template: string, key: string) => {
    const order = o.order();
    o.announce(fill(template, { name: o.nameOf(key), pos: order.indexOf(key) + 1, count: order.length }));
  };
  const gripOf = (key: string) => [...table.querySelectorAll<HTMLElement>(GRIP)].find((g) => g.dataset.colKey === key);
  /** Tras mover, el asa (otro elemento si la vía volvió a pintar la cabecera) recupera el foco. */
  const refocus = (key: string) => {
    const run = () => {
      const grip = gripOf(key);
      if (!grip) return;
      if (grab) grip.setAttribute("aria-pressed", "true");
      if (grip !== table.ownerDocument.activeElement) grip.focus({ preventScroll: true });
    };
    run();
    requestAnimationFrame(run);
  };
  const end = (commit: boolean) => {
    if (!grab) return;
    const g = grab;
    grab = null;
    for (const grip of table.querySelectorAll(GRIP)) grip.setAttribute("aria-pressed", "false");
    table.removeAttribute("data-reordering");
    if (commit) say(labels.dropped, g.key);
    else {
      o.onMove(g.key, g.from);
      refocus(g.key);
      say(labels.cancelled, g.key);
    }
  };
  const key = (event: KeyboardEvent) => {
    const grip = (event.target as Element).closest?.<HTMLElement>(GRIP);
    if (!grip || !table.contains(grip)) return;
    const col = grip.dataset.colKey!;
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      if (grab) end(true);
      else {
        grab = { key: col, from: o.order().indexOf(col) };
        grip.setAttribute("aria-pressed", "true");
        table.setAttribute("data-reordering", "");
        say(labels.grabbed, col);
      }
      return;
    }
    if (!grab) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      end(false);
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const rtl = getComputedStyle(table).direction === "rtl";
    const step = (event.key === "ArrowRight") !== rtl ? 1 : -1;
    const order = o.order();
    const at = order.indexOf(grab.key);
    const to = Math.max(0, Math.min(order.length - 1, at + step));
    if (to === at) return;
    o.onMove(grab.key, to);
    refocus(grab.key);
    say(labels.moved, grab.key);
  };
  // Soltar el asa (perder el foco) también suelta la columna, salvo cuando el foco se pierde por volver a pintar.
  const blur = (event: FocusEvent) => {
    const grip = (event.target as Element).closest?.(GRIP);
    if (!grab || !grip) return;
    requestAnimationFrame(() => {
      if (grab && !table.ownerDocument.activeElement?.closest?.(GRIP)) end(true);
    });
  };
  const headers = () => [...(table.tHead?.rows[0]?.cells ?? [])].filter((th) => th.querySelector(GRIP));
  const down = (event: PointerEvent) => {
    const grip = (event.target as Element).closest<HTMLElement>(GRIP);
    if (!grip || event.button !== 0 || !table.contains(grip)) return;
    drag = { key: grip.dataset.colKey!, pointer: event.pointerId, drop: null, x: event.clientX, started: false };
    try {
      grip.setPointerCapture(event.pointerId);
    } catch {
      // Sin captura, el arrastre sigue con los eventos del documento.
    }
  };
  const move = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointer) return;
    if (!drag.started && Math.abs(event.clientX - drag.x) < 4) return;
    drag.started = true;
    table.setAttribute("data-reordering", "");
    for (const th of table.querySelectorAll("[data-drop]")) th.removeAttribute("data-drop");
    // Destino por la geometría de las cabeceras: antes de la primera cuyo centro queda tras el puntero.
    const list = headers();
    const rtl = getComputedStyle(table).direction === "rtl";
    let target = list[list.length - 1];
    let side: "before" | "after" = "after";
    for (const th of list) {
      const r = th.getBoundingClientRect();
      const mid = r.left + r.width / 2;
      if (rtl ? event.clientX > mid : event.clientX < mid) {
        target = th;
        side = "before";
        break;
      }
    }
    const targetKey = target?.querySelector<HTMLElement>(GRIP)?.dataset.colKey;
    if (!target || !targetKey || targetKey === drag.key) {
      drag.drop = null;
      return;
    }
    drag.drop = { key: targetKey, side };
    target.setAttribute("data-drop", side);
  };
  const up = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointer) return;
    const d = drag;
    drag = null;
    table.removeAttribute("data-reordering");
    for (const th of table.querySelectorAll("[data-drop]")) th.removeAttribute("data-drop");
    if (!d.started || !d.drop) return;
    const order = o.order().filter((k) => k !== d.key);
    let to = order.indexOf(d.drop.key) + (d.drop.side === "after" ? 1 : 0);
    if (to < 0) to = order.length;
    o.onMove(d.key, to);
    say(labels.dropped, d.key);
  };
  const cancel = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointer) return;
    drag = null;
    table.removeAttribute("data-reordering");
    for (const th of table.querySelectorAll("[data-drop]")) th.removeAttribute("data-drop");
  };
  table.addEventListener("keydown", key);
  table.addEventListener("focusout", blur);
  table.addEventListener("pointerdown", down);
  table.addEventListener("pointermove", move);
  table.addEventListener("pointerup", up);
  table.addEventListener("pointercancel", cancel);
  return () => {
    table.removeEventListener("keydown", key);
    table.removeEventListener("focusout", blur);
    table.removeEventListener("pointerdown", down);
    table.removeEventListener("pointermove", move);
    table.removeEventListener("pointerup", up);
    table.removeEventListener("pointercancel", cancel);
  };
}
