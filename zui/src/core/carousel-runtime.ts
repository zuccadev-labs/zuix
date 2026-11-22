// Partes del Carousel que tocan el documento y comparten React y el modo DOM (se llaman al montar, nunca al importar):
// el modo «snap» (desplazamiento nativo con scroll-snap: varias por página, vertical, layouts de M3 y efectos de
// profundidad, con bucle sin réplicas), el mazo (fundido y tarjetas apiladas) y la conexión de la reproducción
// automática con el puntero, el foco, la visibilidad de la pestaña y la pantalla.

import { createAutoplay, fitPerPage, type Autoplay } from "./carousel";
import { clampProgress, deckCommits, deckOffset, nearestPoint, perMoveOf, snapPoints } from "./carousel-effects";
import { canPark, wrap } from "./carousel-loop";
import { isRtl } from "./dir";
import { arrange, endBlend, keylineFrame, type Arrangement, type KeylineLayout } from "./keylines";

export interface SnapOptions {
  viewport: HTMLElement;
  /** Slides por página pedidos (1–8); 0 = cada slide con su ancho («auto», sin máscara). */
  perPage: number;
  vertical: boolean;
  loop: boolean;
  /** Sin animación de desplazamiento. */
  reducedMotion: () => boolean;
  /** Cambio de posición en vivo (por desplazamiento, flechas, teclado o indicadores). */
  onIndex: (index: number) => void;
  /** La tira se asentó en otra posición (tras `scrollend`): el momento de anunciar. Nada al cargar ni al aparcar. */
  onSettle?: (index: number) => void;
  /** Cambió cuántos slides caben (la tira cambió de tamaño): se vuelven a pintar indicadores y flechas. */
  onLayout?: () => void;
  /** La persona navegó con el teclado (la reproducción automática vuelve a contar). */
  onUser?: () => void;
  initialIndex?: number;
  /** Punto de ajuste: inicio (por defecto) o centro. */
  align?: "start" | "center";
  /** Posiciones por paso de las flechas: un número o "page". */
  perMove?: number | "page";
  /** Escribe `--z-slide-progress` en cada slide (donde no hay animaciones ligadas al desplazamiento). */
  progress?: boolean;
  /** Máscaras de Material 3 (multi-browse, hero, hero centrado). */
  keylines?: KeylineLayout | null;
  /** Flechas, Inicio y Fin con el foco en la vista. */
  keyboard?: boolean;
}

export interface SnapController {
  goTo(index: number, smooth?: boolean): void;
  step(direction: 1 | -1): void;
  readonly index: number;
  readonly positions: number;
  /** Slides que caben a la vez (los pedidos o menos si la tira es estrecha). */
  readonly perPage: number;
  /** El bucle aparca slides con `order` (sin réplicas). */
  readonly parking: boolean;
  /** Vuelve a medir y a pintar (slides nuevos, cambio de tamaño). */
  refresh(): void;
  dispose(): void;
}

const SLIDES = ":scope > .z-carousel__slide";

interface Item {
  el: HTMLElement;
  /** Índice original del slide. */
  index: number;
  /** Inicio en el eje de lectura, en coordenadas de la pista. */
  u: number;
  size: number;
  /** Desplazamiento de la ventana (eje de lectura) en el que este slide queda ajustado. */
  snap: number;
}

interface Geometry {
  rtl: boolean;
  size: number;
  /** Inicio de la ventana en el eje de lectura. */
  win: number;
  min: number;
  max: number;
  gap: number;
  items: Item[];
  points: { at: number; first: number }[];
}

/** Lee el número de un atributo `data-index` o, si falta, la posición en el DOM. */
const indexOf = (el: HTMLElement, fallback: number) => {
  const n = Number(el.dataset.index);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
};

/**
 * Modo de desplazamiento nativo: el navegador desplaza (táctil, rueda, barra, teclado) y se ajusta a cada slide; aquí
 * se lee la geometría, se pide el desplazamiento y se mantiene el bucle sin réplicas (guía `carousel`): el primer o el
 * último slide se aparca con `order` junto al actual y el salto se compensa en el mismo paso.
 */
export function createSnap(o: SnapOptions): SnapController {
  const { viewport: vp, vertical } = o;
  const track = vp.querySelector<HTMLElement>(":scope > .z-carousel__track") ?? vp;
  const rootEl = vp.closest<HTMLElement>(".z-carousel") ?? vp;
  const align = o.align ?? "start";
  const win = vp.ownerDocument.defaultView ?? window;
  const slides = () => [...track.querySelectorAll<HTMLElement>(SLIDES)];
  let index = 0;
  let settled = 0;
  let frame = 0;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  let compensating = false;
  let disposed = false;
  /** Valor de `--z-carousel-current` aplicado (null: sin aparcar, orden del DOM). */
  let parked: number | null = null;
  /** Paso pedido durante un viaje de un marcador (con el orden del DOM): se repite al asentarse. */
  let replay: 0 | 1 | -1 = 0;
  let replaying = false;
  // Desplazamiento pedido por código: mientras dura, las posiciones intermedias no cambian el índice.
  let pending: { target: number; from: number; until: number } | null = null;
  let arrangement: Arrangement | null = null;

  const fit = () => {
    if (o.perPage <= 0) return 1;
    const [a, b] = slides();
    if (!a) return o.perPage;
    const ra = a.getBoundingClientRect();
    const size = vertical ? ra.height : ra.width;
    const least = Number.parseFloat(getComputedStyle(a)[vertical ? "minHeight" : "minWidth"]) || 0;
    const gap = b
      ? Math.max(0, Math.abs(vertical ? b.getBoundingClientRect().top - ra.top : b.getBoundingClientRect().left - ra.left) - size)
      : 0;
    return fitPerPage(o.perPage, vertical ? vp.clientHeight : vp.clientWidth, least, gap);
  };
  let fitted = fit();
  const parks = () => o.loop && canPark(slides().length) && !o.keylines && o.perPage > 0 && fitted === 1;

  const geometry = (): Geometry => {
    const rtl = !vertical && isRtl(vp);
    const vr = vp.getBoundingClientRect();
    const tr = track.getBoundingClientRect();
    const size = vertical ? vp.clientHeight : vp.clientWidth;
    const phys = track === vp ? 0 : vertical ? vr.top + vp.clientTop - tr.top : vr.left + vp.clientLeft - tr.left;
    const extent = Math.max(0, vertical ? vp.scrollHeight - vp.clientHeight : vp.scrollWidth - vp.clientWidth);
    const done = vertical ? vp.scrollTop : rtl ? extent + vp.scrollLeft : vp.scrollLeft;
    const minPhys = phys - done;
    const maxPhys = phys + (extent - done);
    const style = getComputedStyle(track);
    const gap = Number.parseFloat(vertical ? style.rowGap : style.columnGap) || 0;
    const items = slides()
      .map((el, i) => {
        const start = vertical ? el.offsetTop : el.offsetLeft;
        const s = vertical ? el.offsetHeight : el.offsetWidth;
        const u = rtl ? -(start + s) : start;
        return { el, index: indexOf(el, i), u, size: s, snap: align === "center" ? u + s / 2 - size / 2 : u };
      })
      .sort((a, b) => a.u - b.u);
    const min = rtl ? -(maxPhys + size) : minPhys;
    const max = rtl ? -(minPhys + size) : maxPhys;
    const at = rtl ? -(phys + size) : phys;
    const points = snapPoints(
      items.map((it) => it.snap - min),
      max - min,
    );
    return { rtl, size, win: at, min, max, gap, items, points };
  };

  const positionOf = (g: Geometry) => {
    if (parks()) {
      let best = g.items[0];
      for (const it of g.items) if (best && Math.abs(it.snap - g.win) < Math.abs(best.snap - g.win) - 0.5) best = it;
      return best?.index ?? 0;
    }
    return nearestPoint(g.points, g.win - g.min);
  };
  const positions = () => (parks() ? slides().length : Math.max(1, geometry().points.length));

  const paint = (g: Geometry) => {
    if (o.progress) {
      for (const it of g.items) {
        const p = (it.u + it.size / 2 - (g.win + g.size / 2)) / (it.size + g.gap || 1);
        it.el.style.setProperty("--z-slide-progress", clampProgress(p).toFixed(4));
      }
    }
    const a = arrangement;
    if (a && g.items.length) {
      const step = a.item + a.gap;
      const e = endBlend(a, g.win - g.min, g.max - g.min);
      const last = g.items[g.items.length - 1]!;
      const shiftEnd = a.lines.length - 1 - (last.snap - g.max) / step;
      for (const it of g.items) {
        const p = (it.snap - g.win) / step;
        const f = keylineFrame(a, p, e, p + shiftEnd);
        it.el.style.setProperty("--z-kl-shift", `${(g.rtl ? -f.shift : f.shift).toFixed(2)}px`);
        it.el.style.setProperty("--z-kl-inset", `${f.inset.toFixed(2)}px`);
        it.el.toggleAttribute("data-small", f.size < a.item * 0.6);
      }
    }
  };

  const measureLayout = () => {
    track.style.setProperty("--z-carousel-count", String(slides().length));
    for (const layer of track.querySelectorAll<HTMLElement>("[data-parallax-layer]")) {
      const n = Number(layer.dataset.parallaxLayer);
      layer.style.setProperty("--z-parallax", String(Number.isFinite(n) && layer.dataset.parallaxLayer !== "" ? n : 0.4));
    }
    if (o.keylines) {
      const style = getComputedStyle(track);
      arrangement = arrange(o.keylines, vp.clientWidth, { gap: Number.parseFloat(style.columnGap) || 0 });
      rootEl.style.setProperty("--z-kl-item", `${arrangement.item.toFixed(2)}px`);
    }
  };

  const scrollByU = (g: Geometry, delta: number, smooth: boolean) => {
    if (Math.abs(delta) < 0.5) return;
    const physical = g.rtl ? -delta : delta;
    vp.scrollBy({ [vertical ? "top" : "left"]: physical, behavior: smooth ? "smooth" : "instant" } as ScrollToOptions);
  };

  /** Cambia el aparcamiento y compensa el salto en el mismo paso, con el ajuste (y el desbordamiento) quietos. */
  const park = (value: number | null, lock: boolean) => {
    if (value === parked) return;
    const g0 = geometry();
    const anchor = g0.items.find((it) => it.index === index) ?? g0.items[0];
    const before = anchor ? anchor.snap - g0.win : 0;
    if (value === null) track.style.removeProperty("--z-carousel-current");
    else track.style.setProperty("--z-carousel-current", String(value));
    parked = value;
    const g1 = geometry();
    const now = anchor ? g1.items.find((it) => it.el === anchor.el) : undefined;
    const delta = now ? now.snap - g1.win - before : 0;
    if (Math.abs(delta) < 0.5) return;
    compensating = true;
    const prop = vertical ? "overflowY" : "overflowX";
    vp.style.scrollSnapType = "none";
    if (lock) vp.style[prop] = "hidden";
    scrollByU(g1, delta, false);
    win.requestAnimationFrame(() =>
      win.requestAnimationFrame(() => {
        vp.style.scrollSnapType = "";
        if (lock) vp.style[prop] = "";
        compensating = false;
        if (!disposed) paint(geometry());
      }),
    );
  };

  const setIndex = (next: number) => {
    if (next === index) return;
    index = next;
    o.onIndex(index);
  };

  /** Lleva el slide `target` (índice original) a su punto de ajuste. */
  const scrollToSlide = (target: number, smooth: boolean) => {
    const g = geometry();
    const it = g.items.find((x) => x.index === target);
    if (!it) return;
    const animated = smooth && !o.reducedMotion();
    pending = animated ? { target, from: g.win, until: performance.now() + 1500 } : null;
    scrollByU(g, Math.max(g.min, Math.min(g.max, it.snap)) - g.win, animated);
    setIndex(target);
  };

  const goTo = (target: number, smooth = true) => {
    if (parks()) {
      const count = slides().length;
      const t = wrap(Math.round(target), count);
      // Un marcador recorre la secuencia en orden: se suelta el aparcamiento y el asiento lo repone.
      if (t !== index && smooth) park(null, false);
      scrollToSlide(t, smooth);
      return;
    }
    const g = geometry();
    const clamped = Math.min(g.points.length - 1, Math.max(0, Math.round(target)));
    const animated = smooth && !o.reducedMotion();
    pending = animated ? { target: clamped, from: g.win, until: performance.now() + 1500 } : null;
    scrollByU(g, g.points[clamped]!.at + g.min - g.win, animated);
    setIndex(clamped);
  };

  const step = (direction: 1 | -1) => {
    const base = pending?.target ?? index;
    if (parks()) {
      const count = slides().length;
      const next = wrap(base + direction, count);
      const g = geometry();
      const from = g.items.find((it) => it.index === base);
      const to = g.items.find((it) => it.index === next);
      // Sin el vecino en su sitio (viaje de un marcador en curso o aparcamiento aún por poner): se repite al asentarse.
      if (!from || !to || Math.sign(to.snap - from.snap) !== direction) {
        // Dentro de una repetición no se vuelve a intentar: evita un bucle si la geometría aún no cuadra.
        if (replaying) return;
        replay = direction;
        if (!pending) settle();
        return;
      }
      scrollToSlide(next, true);
      return;
    }
    const n = positions();
    const m = perMoveOf(o.perMove, fitted);
    let next: number;
    if (direction > 0) next = base >= n - 1 ? (o.loop ? 0 : n - 1) : Math.min(n - 1, base + m);
    else next = base <= 0 ? (o.loop ? n - 1 : 0) : Math.max(0, base - m);
    goTo(next);
  };

  const autoHeight = () => {
    if (!rootEl.hasAttribute("data-auto-height")) return;
    const shown = slides().filter((el) => {
      const i = indexOf(el, 0);
      return i >= index && i < index + fitted;
    });
    const height = Math.max(0, ...shown.map((el) => el.offsetHeight));
    if (height > 0) vp.style.setProperty("--z-carousel-auto-height", `${height}px`);
  };

  function settle() {
    if (disposed || compensating) return;
    const g = geometry();
    if (pending) {
      // Un `scrollend` del desplazamiento anterior (o de una compensación) en el punto de partida: no es el nuestro.
      if (Math.abs(g.win - pending.from) < 1 && pending.target !== positionOf(g) && performance.now() < pending.until) return;
      pending = null;
    }
    setIndex(positionOf(g));
    if (parks()) park(index, replay === 0);
    paint(geometry());
    autoHeight();
    if (index !== settled) {
      settled = index;
      o.onSettle?.(index);
    }
    if (replay) {
      const d = replay;
      replay = 0;
      replaying = true;
      step(d);
      replaying = false;
    }
  }

  const read = () => {
    frame = 0;
    if (disposed) return;
    const g = geometry();
    paint(g);
    // Con un destino pedido no se recalcula en cada fotograma (Safari tartamudea): los marcadores ya lo muestran.
    if (!pending || performance.now() > pending.until) setIndex(positionOf(g));
  };
  const onScroll = () => {
    if (!frame) frame = win.requestAnimationFrame(read);
    if (!("onscrollend" in win)) {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(settle, 120);
    }
  };
  const onScrollEnd = () => settle();

  const onKey = (event: KeyboardEvent) => {
    if (event.target !== vp || event.altKey || event.ctrlKey || event.metaKey) return;
    const rtl = !vertical && isRtl(vp);
    const back = vertical ? "ArrowUp" : "ArrowLeft";
    const forward = vertical ? "ArrowDown" : "ArrowRight";
    const dir = event.key === back ? (rtl ? 1 : -1) : event.key === forward ? (rtl ? -1 : 1) : 0;
    if (dir !== 0) {
      event.preventDefault();
      step(dir as 1 | -1);
      o.onUser?.();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      goTo(event.key === "Home" ? 0 : positions() - 1);
      o.onUser?.();
    }
  };

  vp.addEventListener("scroll", onScroll, { passive: true });
  vp.addEventListener("scrollend", onScrollEnd);
  if (o.keyboard) vp.addEventListener("keydown", onKey);
  measureLayout();
  const layout =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => {
          if (disposed) return;
          measureLayout();
          const now = fit();
          const changed = now !== fitted;
          fitted = now;
          if (parks() && parked === null) park(index, false);
          if (index > positions() - 1) goTo(positions() - 1, false);
          paint(geometry());
          autoHeight();
          if (changed) o.onLayout?.();
        });
  layout?.observe(vp);
  const start = Math.max(0, Math.round(o.initialIndex ?? 0));
  if (parks()) {
    index = Math.min(start, slides().length - 1);
    park(index, false);
    scrollToSlide(index, false);
  } else if (start) goTo(start, false);
  else if (align === "center") scrollByU(geometry(), Math.max(0, geometry().items[0]?.snap ?? 0) - geometry().win, false);
  settled = index;
  paint(geometry());
  autoHeight();
  return {
    goTo,
    step,
    get index() {
      return index;
    },
    get positions() {
      return positions();
    },
    get perPage() {
      return fitted;
    },
    get parking() {
      return parks();
    },
    refresh() {
      measureLayout();
      fitted = fit();
      paint(geometry());
      autoHeight();
    },
    dispose() {
      disposed = true;
      win.cancelAnimationFrame(frame);
      clearTimeout(settleTimer);
      vp.removeEventListener("scroll", onScroll);
      vp.removeEventListener("scrollend", onScrollEnd);
      vp.removeEventListener("keydown", onKey);
      layout?.disconnect();
      track.style.removeProperty("--z-carousel-current");
    },
  };
}

/* ---------- Mazo: fundido y tarjetas apiladas (sin desplazamiento) ---------- */

export interface DeckOptions {
  viewport: HTMLElement;
  loop: boolean;
  reducedMotion: () => boolean;
  onIndex: (index: number) => void;
  onSettle?: (index: number) => void;
  onUser?: () => void;
  initialIndex?: number;
  keyboard?: boolean;
}

export interface DeckController {
  goTo(index: number): void;
  step(direction: 1 | -1): void;
  readonly index: number;
  readonly positions: number;
  refresh(): void;
  dispose(): void;
}

const INTERACTIVE = "a[href], button, input, select, textarea, summary, [contenteditable], [tabindex]:not([tabindex='-1'])";

/**
 * Mazo: los slides se superponen en la misma celda. Solo el actual es interactivo y visible para los lectores; los
 * demás quedan inertes. `--z-deck-offset` (distancia con signo al actual) mueve las tarjetas de atrás en el apilado;
 * arrastrar (ratón, lápiz o dedo) pasa de tarjeta.
 */
export function createDeck(o: DeckOptions): DeckController {
  const vp = o.viewport;
  const track = vp.querySelector<HTMLElement>(":scope > .z-carousel__track") ?? vp;
  const slides = () => [...track.querySelectorAll<HTMLElement>(SLIDES)];
  let index = Math.max(0, Math.min(slides().length - 1, Math.round(o.initialIndex ?? 0)));
  let drag: { id: number; x: number; t: number; moved: boolean } | null = null;

  const apply = () => {
    const all = slides();
    all.forEach((el, i) => {
      const off = deckOffset(indexOf(el, i), index, all.length, o.loop);
      el.style.setProperty("--z-deck-offset", String(Math.max(-4, Math.min(4, off))));
      el.toggleAttribute("data-active", off === 0);
      el.inert = off !== 0;
      if (off === 0) el.removeAttribute("aria-hidden");
      else el.setAttribute("aria-hidden", "true");
    });
  };
  const goTo = (target: number) => {
    const count = slides().length;
    if (!count) return;
    const next = o.loop && count > 1 ? wrap(Math.round(target), count) : Math.max(0, Math.min(count - 1, Math.round(target)));
    if (next === index) return;
    index = next;
    apply();
    o.onIndex(index);
    o.onSettle?.(index);
  };
  const step = (direction: 1 | -1) => goTo(index + direction);

  const onKey = (event: KeyboardEvent) => {
    if (event.target !== vp || event.altKey || event.ctrlKey || event.metaKey) return;
    const rtl = isRtl(vp);
    const dir = event.key === "ArrowLeft" ? (rtl ? 1 : -1) : event.key === "ArrowRight" ? (rtl ? -1 : 1) : 0;
    if (dir) {
      event.preventDefault();
      step(dir as 1 | -1);
      o.onUser?.();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      goTo(event.key === "Home" ? 0 : slides().length - 1);
      o.onUser?.();
    }
  };
  const onDown = (event: PointerEvent) => {
    if (event.button !== 0 || drag || (event.target instanceof Element && event.target.closest(INTERACTIVE) && event.target !== vp)) return;
    drag = { id: event.pointerId, x: event.clientX, t: performance.now(), moved: false };
  };
  const onMove = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 6) {
      drag.moved = true;
      vp.setPointerCapture?.(event.pointerId);
      vp.setAttribute("data-dragging", "");
    }
    if (drag.moved) vp.style.setProperty("--z-deck-drag", `${dx}px`);
  };
  const onUp = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    const moved = drag.moved;
    const velocity = dx / Math.max(1, performance.now() - drag.t);
    drag = null;
    vp.removeAttribute("data-dragging");
    vp.style.removeProperty("--z-deck-drag");
    if (!moved || event.type === "pointercancel") return;
    if (deckCommits(dx, vp.clientWidth, velocity)) {
      const forward = isRtl(vp) ? dx > 0 : dx < 0;
      step(forward ? 1 : -1);
      o.onUser?.();
    }
  };
  if (o.keyboard) vp.addEventListener("keydown", onKey);
  vp.addEventListener("pointerdown", onDown);
  vp.addEventListener("pointermove", onMove);
  vp.addEventListener("pointerup", onUp);
  vp.addEventListener("pointercancel", onUp);
  track.style.setProperty("--z-carousel-count", String(slides().length));
  apply();
  return {
    goTo,
    step,
    get index() {
      return index;
    },
    get positions() {
      return slides().length;
    },
    refresh() {
      index = Math.min(index, Math.max(0, slides().length - 1));
      track.style.setProperty("--z-carousel-count", String(slides().length));
      apply();
    },
    dispose() {
      vp.removeEventListener("keydown", onKey);
      vp.removeEventListener("pointerdown", onDown);
      vp.removeEventListener("pointermove", onMove);
      vp.removeEventListener("pointerup", onUp);
      vp.removeEventListener("pointercancel", onUp);
      for (const el of slides()) {
        el.inert = false;
        el.removeAttribute("aria-hidden");
      }
    },
  };
}

/** Animaciones ligadas al desplazamiento completas (la guía exige también `animation-range`). */
export const scrollDrivenSupported = () =>
  typeof CSS !== "undefined" &&
  typeof CSS.supports === "function" &&
  CSS.supports("(animation-timeline: view()) and (animation-range: entry)");

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
  onSchedule?: () => void,
): AutoplayBinding {
  const win = root.ownerDocument.defaultView;
  const reduced = win?.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  let autoplay: Autoplay | null = null;
  autoplay = createAutoplay(
    { interval, onTick, onSchedule, onChange: (playing) => onChange(playing, autoplay?.wanted ?? !reduced) },
    !reduced,
  );
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
