// Partes del Carousel ampliado que tocan el documento y comparten React y el modo DOM (se llaman al montar, nunca al
// importar): el modo «snap» (varias por página y vertical, sobre el desplazamiento nativo con scroll-snap) y la
// conexión de la reproducción automática con el puntero, el foco, la visibilidad de la pestaña y la pantalla.

import { createAutoplay, snapIndexAt, snapPositions, stepIndex, type Autoplay } from "./carousel";
import { isRtl } from "./dir";

export interface SnapOptions {
  viewport: HTMLElement;
  perPage: number;
  vertical: boolean;
  loop: boolean;
  /** Sin animación de desplazamiento. */
  reducedMotion: () => boolean;
  /** Cambio de posición (por desplazamiento, flechas, teclado o indicadores). */
  onIndex: (index: number) => void;
  initialIndex?: number;
}

export interface SnapController {
  goTo(index: number, smooth?: boolean): void;
  step(direction: 1 | -1): void;
  readonly index: number;
  readonly positions: number;
  dispose(): void;
}

const slidesOf = (viewport: HTMLElement) => [...viewport.querySelectorAll<HTMLElement>(".z-carousel__slide")];

/** Modo snap: el navegador desplaza (táctil, rueda, barra) y se ajusta a cada slide; aquí solo se lee y se pide. */
export function createSnap(o: SnapOptions): SnapController {
  const { viewport, vertical } = o;
  let index = 0;
  let frame = 0;
  // Desplazamiento pedido por código: mientras dura, las posiciones intermedias no cambian el índice.
  let pending: { target: number; until: number } | null = null;
  const count = () => slidesOf(viewport).length;
  const positions = () => snapPositions(count(), o.perPage);
  const stepSize = () => {
    const [a, b] = slidesOf(viewport);
    if (!a) return 0;
    if (!b) return vertical ? a.offsetHeight : a.offsetWidth;
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    return Math.abs(vertical ? rb.top - ra.top : rb.left - ra.left);
  };
  const read = () => {
    frame = 0;
    const next = snapIndexAt(vertical ? viewport.scrollTop : viewport.scrollLeft, stepSize(), positions());
    if (pending) {
      if (next !== pending.target && performance.now() < pending.until) return;
      pending = null;
    }
    if (next !== index) {
      index = next;
      o.onIndex(index);
    }
  };
  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(read);
  };
  const goTo = (target: number, smooth = true) => {
    const clamped = Math.min(positions() - 1, Math.max(0, Math.round(target)));
    const offset = clamped * stepSize();
    const rtl = !vertical && isRtl(viewport);
    const animated = smooth && !o.reducedMotion();
    pending = animated ? { target: clamped, until: performance.now() + 1200 } : null;
    viewport.scrollTo({
      [vertical ? "top" : "left"]: rtl ? -offset : offset,
      behavior: animated ? "smooth" : "auto",
    });
    if (clamped !== index) {
      index = clamped;
      o.onIndex(index);
    }
  };
  viewport.addEventListener("scroll", onScroll, { passive: true });
  if (o.initialIndex) goTo(o.initialIndex, false);
  return {
    goTo,
    step: (direction) => goTo(stepIndex(index, direction, positions(), o.loop)),
    get index() {
      return index;
    },
    get positions() {
      return positions();
    },
    dispose() {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("scroll", onScroll);
    },
  };
}

export interface AutoplayBinding {
  autoplay: Autoplay;
  dispose(): void;
}

/**
 * Reproducción automática conectada al carrusel: se retiene con el puntero encima, con el foco dentro (salvo en el
 * propio botón de pausa, que la gobierna), con la pestaña oculta y con el carrusel fuera de pantalla. Con movimiento
 * reducido no arranca sola: la persona la enciende con el botón.
 */
export function bindAutoplay(
  root: HTMLElement,
  interval: number,
  onTick: () => void,
  onChange: (playing: boolean, wanted: boolean) => void,
): AutoplayBinding {
  const win = root.ownerDocument.defaultView;
  const reduced = win?.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  let autoplay: Autoplay | null = null;
  autoplay = createAutoplay({ interval, onTick, onChange: (playing) => onChange(playing, autoplay?.wanted ?? !reduced) }, !reduced);
  const a = autoplay;
  const isToggle = (target: EventTarget | null) => target instanceof Element && target.closest(".z-carousel__play") !== null;
  const enter = (e: PointerEvent) => {
    if (e.pointerType !== "touch") a.hold("hover", true);
  };
  const leave = () => a.hold("hover", false);
  const focusIn = (e: FocusEvent) => a.hold("focus", !isToggle(e.target));
  const focusOut = (e: FocusEvent) => {
    if (!(e.relatedTarget instanceof Node) || !root.contains(e.relatedTarget)) a.hold("focus", false);
  };
  const visibility = () => a.hold("hidden", root.ownerDocument.visibilityState === "hidden");
  root.addEventListener("pointerenter", enter);
  root.addEventListener("pointerleave", leave);
  root.addEventListener("focusin", focusIn);
  root.addEventListener("focusout", focusOut);
  root.ownerDocument.addEventListener("visibilitychange", visibility);
  let io: IntersectionObserver | null = null;
  if (typeof IntersectionObserver !== "undefined") {
    io = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (entry) a.hold("offscreen", !entry.isIntersecting);
    });
    io.observe(root);
  }
  onChange(a.playing, a.wanted);
  return {
    autoplay: a,
    dispose() {
      a.dispose();
      io?.disconnect();
      root.removeEventListener("pointerenter", enter);
      root.removeEventListener("pointerleave", leave);
      root.removeEventListener("focusin", focusIn);
      root.removeEventListener("focusout", focusOut);
      root.ownerDocument.removeEventListener("visibilitychange", visibility);
    },
  };
}

/** Lleva la miniatura actual a la vista dentro de su tira (sin mover la página). */
export function revealThumb(strip: HTMLElement | null, index: number): void {
  const thumb = strip?.children[index];
  if (!strip || !(thumb instanceof HTMLElement)) return;
  const s = strip.getBoundingClientRect();
  const t = thumb.getBoundingClientRect();
  if (t.left < s.left) strip.scrollLeft -= s.left - t.left + 4;
  else if (t.right > s.right) strip.scrollLeft += t.right - s.right + 4;
}
