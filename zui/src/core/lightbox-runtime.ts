// Visor de imágenes a pantalla completa (Lightbox) conectado al documento: lo comparten React y el modo DOM, que
// pintan un `<dialog class="z-lightbox">` con todas las imágenes. Aquí se muestra la actual, se lleva el contador,
// el zoom (botones, + y −, doble clic, rueda con Ctrl) y el encuadre con el puntero (core/zoom), y se anuncia la
// posición en la región viva central. Abrir y cerrar es cosa del `<dialog>` (y de quien lo monta).

import { announce } from "./announcer";
import { wrap } from "./carousel-loop";
import { clampZoom, containSize, IDENTITY, pan, zoomAt, zoomStep, type ZoomBox, type ZoomState } from "./zoom";

export interface LightboxBindOptions {
  initialIndex?: number;
  /** Con bucle, después de la última viene la primera. Por defecto sí. */
  loop?: boolean;
  /** Zoom activado. Por defecto sí. */
  zoom?: boolean;
  /** «Image {index} of {count}». */
  imageLabel?: string;
  onIndex?: (index: number) => void;
}

export interface LightboxHandle {
  goTo(index: number, announceIt?: boolean): void;
  step(direction: 1 | -1): void;
  zoom(direction: 1 | -1): void;
  resetZoom(): void;
  readonly index: number;
  readonly zoomState: ZoomState;
  dispose(): void;
}

const fill = (template: string, index: number, count: number) =>
  template.replace("{index}", String(index + 1)).replace("{count}", String(count));

export function bindLightbox(dialog: HTMLElement, o: LightboxBindOptions = {}): LightboxHandle {
  const items = () => [...dialog.querySelectorAll<HTMLElement>(".z-lightbox__item")];
  const stage = dialog.querySelector<HTMLElement>(".z-lightbox__stage") ?? dialog;
  const loop = o.loop ?? true;
  const zoomOn = o.zoom ?? true;
  let index = Math.max(0, Math.min(items().length - 1, Math.round(o.initialIndex ?? 0)));
  let z: ZoomState = IDENTITY;
  let drag: { id: number; x: number; y: number } | null = null;

  const media = () => items()[index]?.querySelector<HTMLElement>("img, picture, video, canvas, svg") ?? null;
  const box = (): ZoomBox => {
    const vw = stage.clientWidth;
    const vh = stage.clientHeight;
    const el = media();
    const nw = el instanceof HTMLImageElement ? el.naturalWidth : el?.clientWidth;
    const nh = el instanceof HTMLImageElement ? el.naturalHeight : el?.clientHeight;
    const fit = containSize(nw || vw, nh || vh, vw, vh);
    return { vw, vh, w: fit.w, h: fit.h };
  };
  const paintZoom = () => {
    const item = items()[index];
    if (!item) return;
    item.style.setProperty("--z-lightbox-scale", String(z.scale));
    item.style.setProperty("--z-lightbox-x", `${z.x.toFixed(1)}px`);
    item.style.setProperty("--z-lightbox-y", `${z.y.toFixed(1)}px`);
    dialog.toggleAttribute("data-zoomed", z.scale > 1.001);
    const out = dialog.querySelector<HTMLButtonElement>('[data-lightbox-action="zoom-out"]');
    const inn = dialog.querySelector<HTMLButtonElement>('[data-lightbox-action="zoom-in"]');
    if (out) out.disabled = z.scale <= 1.001;
    if (inn) inn.disabled = z.scale >= 3.999;
  };
  const paint = () => {
    const all = items();
    all.forEach((item, i) => {
      item.toggleAttribute("data-active", i === index);
      if (i !== index) {
        item.style.removeProperty("--z-lightbox-scale");
        item.style.removeProperty("--z-lightbox-x");
        item.style.removeProperty("--z-lightbox-y");
      }
    });
    const counter = dialog.querySelector<HTMLElement>(".z-lightbox__counter");
    if (counter) counter.textContent = `${index + 1} / ${all.length}`;
    const prev = dialog.querySelector<HTMLButtonElement>('[data-lightbox-action="prev"]');
    const next = dialog.querySelector<HTMLButtonElement>('[data-lightbox-action="next"]');
    if (prev) prev.disabled = !loop && index === 0;
    if (next) next.disabled = !loop && index === all.length - 1;
    paintZoom();
  };
  const goTo = (target: number, announceIt = true) => {
    const count = items().length;
    if (!count) return;
    const next = loop ? wrap(Math.round(target), count) : Math.max(0, Math.min(count - 1, Math.round(target)));
    const changed = next !== index;
    index = next;
    z = IDENTITY;
    paint();
    if (changed) {
      o.onIndex?.(index);
      if (announceIt) announce(fill(o.imageLabel ?? "Image {index} of {count}", index, count), { source: dialog });
    }
  };
  const zoom = (direction: 1 | -1) => {
    if (!zoomOn) return;
    z = zoomStep(box(), z, direction);
    paintZoom();
  };

  const onClick = (event: MouseEvent) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-lightbox-action]") : null;
    if (!button || !dialog.contains(button)) return;
    const action = button.dataset.lightboxAction;
    if (action === "prev") goTo(index - 1);
    else if (action === "next") goTo(index + 1);
    else if (action === "zoom-in") zoom(1);
    else if (action === "zoom-out") zoom(-1);
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const rtl = getComputedStyle(dialog).direction === "rtl";
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      if (z.scale > 1.001) {
        event.preventDefault();
        z = pan(box(), z, (event.key === "ArrowRight" ? -1 : 1) * 40, 0);
        paintZoom();
        return;
      }
      event.preventDefault();
      goTo(index + ((event.key === "ArrowRight") !== rtl ? 1 : -1));
    } else if ((event.key === "ArrowUp" || event.key === "ArrowDown") && z.scale > 1.001) {
      event.preventDefault();
      z = pan(box(), z, 0, (event.key === "ArrowDown" ? -1 : 1) * 40);
      paintZoom();
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoom(1);
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      zoom(-1);
    } else if (event.key === "0") {
      event.preventDefault();
      z = IDENTITY;
      paintZoom();
    }
  };
  const point = (event: MouseEvent) => {
    const r = stage.getBoundingClientRect();
    return { x: event.clientX - (r.left + r.width / 2), y: event.clientY - (r.top + r.height / 2) };
  };
  const onDouble = (event: MouseEvent) => {
    if (!zoomOn || !(event.target instanceof Element) || !event.target.closest(".z-lightbox__item")) return;
    const p = point(event);
    z = z.scale > 1.001 ? IDENTITY : zoomAt(box(), z, 2.5, p.x, p.y);
    paintZoom();
  };
  const onWheel = (event: WheelEvent) => {
    if (!zoomOn || !event.ctrlKey) return;
    event.preventDefault();
    const p = point(event);
    z = zoomAt(box(), z, z.scale * Math.exp(-event.deltaY * 0.01), p.x, p.y);
    paintZoom();
  };
  const onDown = (event: PointerEvent) => {
    if (z.scale <= 1.001 || event.button !== 0 || !(event.target instanceof Element) || !event.target.closest(".z-lightbox__item")) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    stage.setPointerCapture?.(event.pointerId);
    stage.setAttribute("data-dragging", "");
  };
  const onMove = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id) return;
    z = pan(box(), z, event.clientX - drag.x, event.clientY - drag.y);
    drag = { ...drag, x: event.clientX, y: event.clientY };
    paintZoom();
  };
  const onUp = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id) return;
    drag = null;
    stage.removeAttribute("data-dragging");
  };
  const onResize = () => {
    z = clampZoom(box(), z);
    paintZoom();
  };
  dialog.addEventListener("click", onClick);
  dialog.addEventListener("keydown", onKey);
  stage.addEventListener("dblclick", onDouble);
  stage.addEventListener("wheel", onWheel, { passive: false });
  stage.addEventListener("pointerdown", onDown);
  stage.addEventListener("pointermove", onMove);
  stage.addEventListener("pointerup", onUp);
  stage.addEventListener("pointercancel", onUp);
  const win = dialog.ownerDocument.defaultView;
  win?.addEventListener("resize", onResize);
  paint();
  return {
    goTo,
    step: (direction) => goTo(index + direction),
    zoom,
    resetZoom() {
      z = IDENTITY;
      paintZoom();
    },
    get index() {
      return index;
    },
    get zoomState() {
      return z;
    },
    dispose() {
      dialog.removeEventListener("click", onClick);
      dialog.removeEventListener("keydown", onKey);
      stage.removeEventListener("dblclick", onDouble);
      stage.removeEventListener("wheel", onWheel);
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerup", onUp);
      stage.removeEventListener("pointercancel", onUp);
      win?.removeEventListener("resize", onResize);
    },
  };
}

export interface LightboxLabels {
  dialog: string;
  close: string;
  previous: string;
  next: string;
  zoomIn: string;
  zoomOut: string;
  /** Anuncio al cambiar de imagen: {index}, {count}. */
  image: string;
}

export const LIGHTBOX_LABELS: LightboxLabels = {
  dialog: "Image viewer",
  close: "Close",
  previous: "Previous image",
  next: "Next image",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  image: "Image {index} of {count}",
};
