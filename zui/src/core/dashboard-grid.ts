// Interacción de DashboardGrid, compartida por el binding de React y el modo DOM. Se conecta a la raíz ya pintada
// (`.z-dashboard-grid` > `.z-dashboard-grid__canvas` > `.z-dashboard-grid__item[data-id]`) y no crea ni mueve nodos
// por su cuenta: calcula la disposición provisional con core/grid-layout y se la pasa a quien pinta (`preview`), que la
// escribe en las variables de cada pieza; al soltar, `commit` con la definitiva. React vuelve a pintar; el modo DOM
// escribe atributos y reordena los nodos. El hueco de destino lo dibuja el pseudoelemento del lienzo con `--z-drop-*`.
//
// Puntero: el asa arrastra (captura de puntero, un solo puntero, Escape cancela) y el tirador de la esquina
// redimensiona; la pieza levantada sigue al puntero con `translate` y las demás se apartan. Teclado: el asa es un
// botón; Espacio o Intro coge la pieza, flechas la mueven una celda, Mayús + flechas cambian su tamaño, Intro o
// Espacio la sueltan, Escape la devuelve y perder el foco la suelta. Sin coger, las flechas van de asa en asa por
// geometría (core/spatial). Cada paso se anuncia en la región viva central (core/announcer).

import { announce } from "./announcer";
import {
  cellAt,
  compact,
  describeItem,
  GRID_LABELS,
  keyStep,
  moveItem,
  resizeItem,
  sameLayout,
  spanFor,
  type GridItem,
  type GridLabels,
  type GridLayout,
} from "./grid-layout";
import { arrowDirection, nextInDirection } from "./spatial";

export interface DashboardGridHost {
  /** Disposición confirmada. */
  layout(): GridLayout;
  /** Disposición provisional mientras se arrastra (o `null` para volver a la confirmada). */
  preview(layout: GridLayout | null): void;
  commit(layout: GridLayout): void;
  editable(): boolean;
  labels(): GridLabels;
}

const put = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));

interface Metrics {
  width: number;
  cols: number;
  rowHeight: number;
  gap: number;
  colWidth: number;
  originX: number;
  originY: number;
  rtl: boolean;
}

function metricsOf(canvas: HTMLElement, cols: number): Metrics {
  const style = getComputedStyle(canvas);
  const rect = canvas.getBoundingClientRect();
  const gap = Number.parseFloat(style.columnGap) || 0;
  const rowHeight = Number.parseFloat(style.gridAutoRows) || 80;
  const padStart = Number.parseFloat(style.paddingInlineStart) || 0;
  const padTop = Number.parseFloat(style.paddingTop) || 0;
  const rtl = style.direction === "rtl";
  const width = rect.width - padStart - (Number.parseFloat(style.paddingInlineEnd) || 0);
  return {
    width,
    cols,
    rowHeight,
    gap,
    colWidth: (width - gap * (cols - 1)) / cols,
    originX: rtl ? rect.right - padStart : rect.left + padStart,
    originY: rect.top + padTop,
    rtl,
  };
}

/** Esquina de inicio de una celda en px de pantalla (en RTL, la derecha). */
const slotX = (m: Metrics, x: number) => x * (m.colWidth + m.gap);
const slotY = (m: Metrics, y: number) => y * (m.rowHeight + m.gap);

interface Drag {
  kind: "move" | "resize";
  id: string;
  pointer: number | null;
  handle: HTMLElement;
  original: GridLayout;
  current: GridLayout;
  /** Desfase del puntero dentro de la pieza al cogerla (px, eje inline lógico y bloque). */
  grabX: number;
  grabY: number;
  startW: number;
  startH: number;
  startX: number;
  startY: number;
  metrics: Metrics;
  moved: boolean;
}

/** Conecta la interacción a una rejilla pintada. Devuelve la función que la desconecta. */
export function attachDashboardGrid(root: HTMLElement, host: DashboardGridHost): () => void {
  const doc = root.ownerDocument;
  const canvas = () => root.querySelector<HTMLElement>(":scope > .z-dashboard-grid__canvas") ?? root;
  const cols = () => Number(root.dataset.cols) || 12;
  const itemOf = (id: string) => canvas().querySelector<HTMLElement>(`:scope > .z-dashboard-grid__item[data-id="${CSS.escape(id)}"]`);
  const nameOf = (id: string) => itemOf(id)?.dataset.name ?? id;
  const find = (layout: GridLayout, id: string) => layout.find((i) => i.id === id);
  const stacked = () => getComputedStyle(canvas()).getPropertyValue("--z-grid-stacked").trim() === "1";
  let drag: Drag | null = null;
  // Asa que debe recuperar el foco tras confirmar (React o el modo DOM reordenan los nodos y el foco se pierde).
  let refocus: string | null = null;

  const say = (text: string) => announce(text, { source: root });

  const setDrop = (item: GridItem | null) => {
    const c = canvas();
    if (!item) {
      c.removeAttribute("data-drop");
      for (const k of ["x", "y", "w", "h"]) c.style.removeProperty(`--z-drop-${k}`);
      return;
    }
    c.setAttribute("data-drop", "");
    c.style.setProperty("--z-drop-x", String(item.x));
    c.style.setProperty("--z-drop-y", String(item.y));
    c.style.setProperty("--z-drop-w", String(item.w));
    c.style.setProperty("--z-drop-h", String(item.h));
  };

  const lift = (id: string, on: boolean, kind: "move" | "resize" | "key" = "move") => {
    const el = itemOf(id);
    if (!el) return;
    if (on) el.setAttribute("data-grabbed", kind);
    else {
      el.removeAttribute("data-grabbed");
      el.style.removeProperty("--z-drag-x");
      el.style.removeProperty("--z-drag-y");
    }
  };

  const finish = (commit: boolean) => {
    const d = drag;
    if (!d) return;
    drag = null;
    root.removeAttribute("data-dragging");
    setDrop(null);
    d.handle.setAttribute("aria-pressed", "false");
    // La definitiva se compacta sin fijar la pieza: un hueco que deje encima se cierra al soltar.
    d.current = compact(d.current, cols());
    const changed = !sameLayout(d.original, d.current);
    const name = nameOf(d.id);
    if (commit && changed) {
      refocus = d.pointer === null ? d.id : null;
      host.preview(null);
      host.commit(d.current);
      const item = find(d.current, d.id)!;
      say(put(host.labels().dropped, { name, position: describeItem(item, name, host.labels()) }));
    } else {
      host.preview(null);
      if (d.pointer === null || changed) {
        const item = find(d.original, d.id)!;
        say(commit ? describeItem(item, name, host.labels()) : put(host.labels().cancelled, { name, x: item.x + 1, y: item.y + 1 }));
      }
    }
    // La pieza vuelve a su hueco con la transición de `translate` (sin ella con movimiento reducido).
    lift(d.id, false);
    if (refocus) {
      const id = refocus;
      requestAnimationFrame(() => {
        refocus = null;
        const h = itemOf(id)?.querySelector<HTMLElement>(".z-dashboard-grid__handle");
        if (h && doc.activeElement !== h) h.focus({ preventScroll: true });
        h?.closest<HTMLElement>(".z-dashboard-grid__item")?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      });
    }
  };

  const step = (layout: GridLayout) => {
    const d = drag!;
    if (sameLayout(layout, d.current)) return false;
    d.current = layout;
    d.moved = true;
    host.preview(layout);
    setDrop(find(layout, d.id) ?? null);
    return true;
  };

  /* ---------- Teclado ---------- */

  const onKey = (event: KeyboardEvent) => {
    const handle = (event.target as HTMLElement).closest?.<HTMLElement>(".z-dashboard-grid__handle");
    if (!handle || !root.contains(handle) || !host.editable()) return;
    const item = handle.closest<HTMLElement>(".z-dashboard-grid__item");
    const id = item?.dataset.id;
    if (!id) return;
    const labels = host.labels();
    const grabbed = drag?.id === id && drag.pointer === null;
    if (!grabbed) {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        if (drag) finish(false);
        const layout = host.layout();
        drag = {
          kind: "move",
          id,
          pointer: null,
          handle,
          original: layout,
          current: layout,
          grabX: 0,
          grabY: 0,
          startW: 0,
          startH: 0,
          startX: 0,
          startY: 0,
          metrics: metricsOf(canvas(), cols()),
          moved: false,
        };
        handle.setAttribute("aria-pressed", "true");
        lift(id, true, "key");
        setDrop(find(layout, id) ?? null);
        say(`${put(labels.grabbed, { name: nameOf(id) })} ${describeItem(find(layout, id)!, nameOf(id), labels)}`);
        return;
      }
      // Sin coger: flechas entre asas por geometría.
      const dir = arrowDirection(event.key);
      if (!dir) return;
      const handles = [...canvas().querySelectorAll<HTMLElement>(":scope > .z-dashboard-grid__item .z-dashboard-grid__handle")];
      const boxes = handles.map((h) => h.closest<HTMLElement>(".z-dashboard-grid__item")!.getBoundingClientRect());
      const from = handles.indexOf(handle);
      const next = nextInDirection(boxes[from]!, boxes, dir);
      if (next < 0) return;
      event.preventDefault();
      handles[next]!.focus();
      return;
    }
    const d = drag!;
    if (event.key === "Escape") {
      event.preventDefault();
      finish(false);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      finish(true);
      return;
    }
    if (event.key === "Tab") {
      finish(true);
      return;
    }
    const current = find(d.current, id)!;
    const action = keyStep(current, event.key, event.shiftKey, getComputedStyle(root).direction === "rtl");
    if (!action) return;
    event.preventDefault();
    // El destino se calcula desde la disposición del principio, para que las demás no se queden desplazadas; mover
    // conserva el tamaño elegido en este mismo agarre y redimensionar, la posición.
    if (action.type === "move") {
      const sized = find(d.current, id)!;
      const fixed = moveItem(
        d.original.map((i) => (i.id === id ? { ...i, w: sized.w, h: sized.h } : i)),
        id,
        action.x,
        action.y,
        cols(),
      );
      if (step(fixed)) say(describeItem(find(fixed, id)!, nameOf(id), labels));
    } else {
      const placed = find(d.current, id)!;
      const fixed = resizeItem(
        d.original.map((i) => (i.id === id ? { ...i, x: placed.x, y: placed.y } : i)),
        id,
        action.w,
        action.h,
        cols(),
      );
      if (step(fixed)) say(describeItem(find(fixed, id)!, nameOf(id), labels));
    }
    requestAnimationFrame(() => itemOf(id)?.scrollIntoView?.({ block: "nearest", inline: "nearest" }));
  };

  const onFocusOut = (event: FocusEvent) => {
    if (!drag || drag.pointer !== null) return;
    const target = event.target as HTMLElement;
    if (target !== drag.handle) return;
    // Perder el foco suelta la pieza; la vuelta del foco tras reordenar no cuenta (refocus).
    if (event.relatedTarget && drag.handle.contains(event.relatedTarget as Node)) return;
    finish(true);
  };

  /* ---------- Puntero ---------- */

  const onDown = (event: PointerEvent) => {
    if (event.button !== 0 || drag || !host.editable() || stacked()) return;
    const target = event.target as HTMLElement;
    const handle = target.closest?.<HTMLElement>(".z-dashboard-grid__handle, .z-dashboard-grid__resize");
    if (!handle || !root.contains(handle)) return;
    const item = handle.closest<HTMLElement>(".z-dashboard-grid__item");
    const id = item?.dataset.id;
    if (!item || !id) return;
    const layout = host.layout();
    const at = find(layout, id);
    if (!at || at.static) return;
    event.preventDefault();
    const m = metricsOf(canvas(), cols());
    const rect = item.getBoundingClientRect();
    const kind = handle.classList.contains("z-dashboard-grid__resize") ? "resize" : "move";
    drag = {
      kind,
      id,
      pointer: event.pointerId,
      handle: item.querySelector<HTMLElement>(".z-dashboard-grid__handle") ?? handle,
      original: layout,
      current: layout,
      grabX: m.rtl ? rect.right - event.clientX : event.clientX - rect.left,
      grabY: event.clientY - rect.top,
      startW: rect.width,
      startH: rect.height,
      startX: event.clientX,
      startY: event.clientY,
      metrics: m,
      moved: false,
    };
    handle.setPointerCapture?.(event.pointerId);
    root.setAttribute("data-dragging", kind);
    lift(id, true, kind);
    setDrop(at);
  };

  const onMove = (event: PointerEvent) => {
    const d = drag;
    if (!d || d.pointer !== event.pointerId) return;
    const m = d.metrics;
    const el = itemOf(d.id);
    if (!el) return;
    if (d.kind === "resize") {
      const dx = (event.clientX - d.startX) * (m.rtl ? -1 : 1);
      const dy = event.clientY - d.startY;
      const w = spanFor(d.startW + dx, m.colWidth, m.gap);
      const h = spanFor(d.startH + dy, m.rowHeight, m.gap);
      step(resizeItem(d.original, d.id, w, h, m.cols));
      return;
    }
    // Posición de la esquina de la pieza en la rejilla (px desde el origen lógico).
    const px = m.rtl ? m.originX - event.clientX - d.grabX : event.clientX - m.originX - d.grabX;
    const py = event.clientY - m.originY - d.grabY;
    const size = find(d.current, d.id)!;
    const cell = cellAt(px, py, m, size);
    step(moveItem(d.original, d.id, cell.x, cell.y, m.cols));
    const now = find(d.current, d.id)!;
    // La pieza sigue al puntero desde su hueco provisional (calculado, no medido: no espera a que se pinte).
    const tx = px - slotX(m, now.x);
    const ty = py - slotY(m, now.y);
    el.style.setProperty("--z-drag-x", `${Math.round(m.rtl ? -tx : tx)}px`);
    el.style.setProperty("--z-drag-y", `${Math.round(ty)}px`);
    autoscroll(event.clientY);
  };

  let scrollFrame = 0;
  let lastY = 0;
  const autoscroll = (y: number) => {
    lastY = y;
    if (scrollFrame) return;
    const loop = () => {
      scrollFrame = 0;
      if (!drag || drag.pointer === null) return;
      const view = doc.defaultView;
      if (!view) return;
      const zone = Math.min(80, view.innerHeight / 6);
      const speed = lastY < zone ? -(zone - lastY) / 4 : lastY > view.innerHeight - zone ? (lastY - (view.innerHeight - zone)) / 4 : 0;
      if (speed) {
        view.scrollBy(0, speed);
        scrollFrame = requestAnimationFrame(loop);
      }
    };
    scrollFrame = requestAnimationFrame(loop);
  };

  const onUp = (event: PointerEvent) => {
    if (!drag || drag.pointer !== event.pointerId) return;
    finish(event.type === "pointerup");
  };
  const onEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape" && drag && drag.pointer !== null) {
      event.preventDefault();
      finish(false);
    }
  };

  root.addEventListener("keydown", onKey);
  root.addEventListener("focusout", onFocusOut);
  root.addEventListener("pointerdown", onDown);
  doc.addEventListener("pointermove", onMove);
  doc.addEventListener("pointerup", onUp);
  doc.addEventListener("pointercancel", onUp);
  doc.addEventListener("keydown", onEscape);
  return () => {
    if (drag) finish(false);
    cancelAnimationFrame(scrollFrame);
    root.removeEventListener("keydown", onKey);
    root.removeEventListener("focusout", onFocusOut);
    root.removeEventListener("pointerdown", onDown);
    doc.removeEventListener("pointermove", onMove);
    doc.removeEventListener("pointerup", onUp);
    doc.removeEventListener("pointercancel", onUp);
    doc.removeEventListener("keydown", onEscape);
  };
}

/** Disposición escrita en el marcado (`data-x`, `data-y`, `data-w`, `data-h` y límites en cada pieza). */
export function readLayout(root: HTMLElement): GridLayout {
  const canvas = root.querySelector<HTMLElement>(":scope > .z-dashboard-grid__canvas") ?? root;
  const n = (v: string | undefined) => (v === undefined || v === "" ? undefined : Number(v));
  return [...canvas.querySelectorAll<HTMLElement>(":scope > .z-dashboard-grid__item[data-id]")].map((el) => {
    const d = el.dataset;
    return {
      id: d.id!,
      x: Number(d.x) || 0,
      y: Number(d.y) || 0,
      w: Number(d.w) || 1,
      h: Number(d.h) || 1,
      minW: n(d.minW),
      minH: n(d.minH),
      maxW: n(d.maxW),
      maxH: n(d.maxH),
      static: d.static !== undefined && d.static !== "false" ? true : undefined,
    };
  });
}

/** Escribe una disposición en el marcado (atributos y variables de cada pieza). */
export function writeLayout(root: HTMLElement, layout: GridLayout): void {
  const canvas = root.querySelector<HTMLElement>(":scope > .z-dashboard-grid__canvas") ?? root;
  for (const item of layout) {
    const el = canvas.querySelector<HTMLElement>(`:scope > .z-dashboard-grid__item[data-id="${CSS.escape(item.id)}"]`);
    if (!el) continue;
    for (const k of ["x", "y", "w", "h"] as const) {
      el.dataset[k] = String(item[k]);
      el.style.setProperty(`--z-${k}`, String(item[k]));
    }
  }
}

export { GRID_LABELS };
