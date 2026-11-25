// Arrastrar y soltar con el puntero en un árbol (Tree): el binding de React y el modo DOM lo conectan al elemento
// `[role="tree"]`. La fila sigue en su sitio (no se clona) y un marcador en la fila de destino (`data-drop` =
// before|inside|after) dice dónde caerá; el destino sale de la geometría de las filas, no de `event.target`. Captura
// del puntero, un solo puntero, Escape cancela y desplazamiento automático cerca de los bordes. Quien lo usa mueve los
// datos (`onDrop`) y anuncia. El arrastre con teclado vive en cada vía (core/tree tiene los destinos). Sin efectos al
// importar.

import { dropPositionAt, type DropPosition, type TreeDrop } from "./tree";

export interface TreeDragOptions {
  /** ¿Se puede soltar ahí? (no dentro de sí mismo; lo que diga la aplicación). */
  canDrop(drop: TreeDrop): boolean;
  onDrop(drop: TreeDrop): void;
  /** Empieza o se cancela un arrastre (para anunciarlo). */
  onStart?(id: string): void;
  onCancel?(id: string): void;
  /** Distancia en px antes de empezar a arrastrar (un clic no arrastra). Por defecto 5. */
  threshold?: number;
}

const ITEM = '[role="treeitem"]';
const ROW = ".z-tree__row";

function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let node: HTMLElement | null = el; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) return node;
  }
  return null;
}

/** Conecta el arrastre con puntero a un árbol. Devuelve la función que lo desconecta. */
export function bindTreeDrag(tree: HTMLElement, o: TreeDragOptions): () => void {
  const threshold = o.threshold ?? 5;
  let press: { id: string; pointer: number; x: number; y: number; row: HTMLElement } | null = null;
  let drag: { id: string; pointer: number; drop: TreeDrop | null; lastY: number; frame: number; scroller: HTMLElement | null } | null =
    null;
  let swallowClick = false;
  const own = (el: Element | null) => el?.closest(ITEM)?.closest('[role="tree"]') === tree;
  const clearMarks = () => {
    for (const el of tree.querySelectorAll("[data-drop]")) el.removeAttribute("data-drop");
  };
  const mark = (drop: TreeDrop | null) => {
    clearMarks();
    if (!drop) return;
    const item = [...tree.querySelectorAll<HTMLElement>(ITEM)].find((el) => el.dataset.value === drop.target);
    item?.querySelector<HTMLElement>(`:scope > ${ROW}`)?.setAttribute("data-drop", drop.position);
  };
  /** Destino bajo la altura `y`: la fila visible más cercana (acotado a la primera y la última). */
  const dropAt = (y: number): TreeDrop | null => {
    if (!drag) return null;
    const rows = [...tree.querySelectorAll<HTMLElement>(`${ITEM} > ${ROW}`)].filter((row) => own(row) && row.offsetParent !== null);
    if (!rows.length) return null;
    let hit = rows[rows.length - 1]!;
    for (const row of rows) {
      const r = row.getBoundingClientRect();
      if (y < r.bottom) {
        hit = row;
        break;
      }
    }
    const rect = hit.getBoundingClientRect();
    const target = hit.closest<HTMLElement>(ITEM)?.dataset.value;
    if (!target) return null;
    const position: DropPosition = dropPositionAt(Math.min(rect.height, Math.max(0, y - rect.top)), rect.height);
    const drop = { id: drag.id, target, position };
    if (o.canDrop(drop)) return drop;
    // Dentro no vale (una hoja que no admite hijos, lo dice la aplicación): delante o detrás según la mitad.
    const edge = { ...drop, position: (y - rect.top < rect.height / 2 ? "before" : "after") as DropPosition };
    return o.canDrop(edge) ? edge : null;
  };
  const autoscroll = () => {
    if (!drag) return;
    const d = drag;
    d.frame = 0;
    const el = d.scroller;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const zone = Math.min(48, r.height / 3);
    const speed = d.lastY < r.top + zone ? -(r.top + zone - d.lastY) : d.lastY > r.bottom - zone ? d.lastY - (r.bottom - zone) : 0;
    if (speed) {
      el.scrollTop += Math.max(-24, Math.min(24, speed / 2));
      d.drop = dropAt(d.lastY);
      mark(d.drop);
      d.frame = requestAnimationFrame(autoscroll);
    }
  };
  const end = (commit: boolean) => {
    const d = drag;
    drag = null;
    press = null;
    tree.removeAttribute("data-dragging");
    for (const el of tree.querySelectorAll("[data-dragged]")) el.removeAttribute("data-dragged");
    clearMarks();
    if (!d) return;
    if (d.frame) cancelAnimationFrame(d.frame);
    swallowClick = true;
    setTimeout(() => {
      swallowClick = false;
    }, 0);
    if (commit && d.drop) o.onDrop(d.drop);
    else o.onCancel?.(d.id);
  };
  const down = (e: PointerEvent) => {
    if (e.button !== 0 || drag || press) return;
    const row = (e.target as Element).closest<HTMLElement>(ROW);
    // La casilla y el campo de renombrar no arrastran.
    if (!row || !own(row) || (e.target as Element).closest(".z-tree__check, input")) return;
    const item = row.closest<HTMLElement>(ITEM);
    if (!item?.dataset.value || item.getAttribute("aria-disabled") === "true") return;
    press = { id: item.dataset.value, pointer: e.pointerId, x: e.clientX, y: e.clientY, row };
  };
  const move = (e: PointerEvent) => {
    if (press && !drag && e.pointerId === press.pointer) {
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < threshold) return;
      drag = { id: press.id, pointer: press.pointer, drop: null, lastY: e.clientY, frame: 0, scroller: scrollParent(tree) };
      try {
        press.row.setPointerCapture(press.pointer);
      } catch {
        // Un puntero que ya no existe: el arrastre sigue con los eventos del documento.
      }
      tree.setAttribute("data-dragging", "");
      press.row.closest(ITEM)?.setAttribute("data-dragged", "");
      o.onStart?.(press.id);
    }
    if (!drag || e.pointerId !== drag.pointer) return;
    e.preventDefault();
    drag.lastY = e.clientY;
    drag.drop = dropAt(e.clientY);
    mark(drag.drop);
    if (!drag.frame) drag.frame = requestAnimationFrame(autoscroll);
  };
  const up = (e: PointerEvent) => {
    if (press && e.pointerId === press.pointer && !drag) {
      press = null;
      return;
    }
    if (drag && e.pointerId === drag.pointer) end(true);
  };
  const cancel = (e: PointerEvent) => {
    if (drag && e.pointerId === drag.pointer) end(false);
    else if (press && e.pointerId === press.pointer) press = null;
  };
  const key = (e: KeyboardEvent) => {
    if (drag && e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      end(false);
    }
  };
  // Tras soltar, el clic que el navegador manda a la fila no la activa.
  const click = (e: MouseEvent) => {
    if (swallowClick) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  const doc = tree.ownerDocument;
  tree.addEventListener("pointerdown", down);
  doc.addEventListener("pointermove", move);
  doc.addEventListener("pointerup", up);
  doc.addEventListener("pointercancel", cancel);
  doc.addEventListener("keydown", key, true);
  tree.addEventListener("click", click, true);
  return () => {
    if (drag) end(false);
    tree.removeEventListener("pointerdown", down);
    doc.removeEventListener("pointermove", move);
    doc.removeEventListener("pointerup", up);
    doc.removeEventListener("pointercancel", cancel);
    doc.removeEventListener("keydown", key, true);
    tree.removeEventListener("click", click, true);
  };
}
