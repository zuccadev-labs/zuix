// Comportamiento sin framework del Carousel. El movimiento (pista, inercia, bucle, lente CSS, teclado) es el
// mismo motor que usa el binding de React: ../components/carousel/engine. Aquí solo se monta el marcado del
// contrato, las réplicas del bucle y el estado (contador, flechas, anuncios).
//
// Marcado mínimo:  <div class="z-carousel" data-z-carousel data-effect="lens|none" data-loop aria-label="…">
//                    …un hijo por slide…
//                  </div>
// También admite el marcado completo del contrato (viewport > stage > track > slides, controles y región viva).
// Atributos opcionales: data-start="2" (slide inicial), data-label-previous, data-label-next,
// data-label-slide="Slide {index} of {count}". Variables: --z-carousel-slide-width, --z-carousel-gap.
// Evento: z:change con detail.index. API: carousel(el, opciones?) → { next, prev, goTo, refresh, destroy, index }.
//
// data-autoplay (vacío = 5 s, o milisegundos) con botón de pausa visible, data-indicators="dots|bar|none"
// (por defecto el contador) y miniaturas del contrato (.z-carousel__thumbs > button.z-carousel__thumb). Con
// data-per-page="3" o data-orientation="vertical" el carrusel usa el desplazamiento nativo con scroll-snap (sin lente
// ni réplicas); --z-carousel-height fija el alto en vertical. Textos: data-label-play, data-label-pause, data-label-goto.
//
// data-layout="multi-browse|hero|hero-center|uncontained|fullscreen|stack" y data-effect="prism|coverflow|fade|
// parallax|wheel" (además de lens y none); data-indicators="progress", data-per-move="2|page", data-per-page="auto",
// data-auto-height, data-depth="0–2", data-peek="3rem", data-kenburns y capas data-parallax-layer="0.4". Fuera de la
// tira con lente, el motor es core/carousel-runtime (desplazamiento nativo o mazo); con data-loop y uno por vista, el
// bucle aparca el primer o el último slide con `order` en lugar de clonar.
//
// Modo gl (zonas curvas dibujadas en un lienzo WebGL2, como `rasterize` en React). Se pide de dos formas:
//   - Marcado: con data-effect="lens", TODOS los slides declaran su imagen. En el slide o en un descendiente:
//       <img data-raster …> | <canvas data-raster …>   el propio elemento es la fuente
//       data-raster="#selector"                        un <img>, <canvas> o <video> de la página
//       data-raster-src="url"                          una imagen por URL (con CORS si es de otro origen)
//   - Código: carousel(el, { rasterize(slide, index, size) }) devuelve la imagen o su URL; si devuelve
//     null o undefined se usa la declarada en el marcado.
// Los shaders viven en ./carousel-gl y solo se cargan (import dinámico) cuando un carrusel lo pide. Sin
// WebGL2, si falta la fuente de algún slide o si falla la carga, la lente sigue en modo css.
// Si las imágenes cambian después de activar el carrusel (un <canvas> pintado más tarde): refresh().
// `setup()` conecta los listeners delegados una vez; `hydrate(root)` prepara marcado nuevo.
import { trackScrollEdges } from "../core/edges";
import type { Listen } from "./shared";
import { iconSvg, registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { chevronDown } from "@zuccadev-labs/zuix-zicon/icons/chevron-down";
import { chevronLeft } from "@zuccadev-labs/zuix-zicon/icons/chevron-left";
import { chevronRight } from "@zuccadev-labs/zuix-zicon/icons/chevron-right";
import { chevronUp } from "@zuccadev-labs/zuix-zicon/icons/chevron-up";
import { pause } from "@zuccadev-labs/zuix-zicon/icons/pause";
import { play } from "@zuccadev-labs/zuix-zicon/icons/play";
import { MIN_SIDE, createEngine } from "../components/carousel/engine";
import { autoplayInterval, barProgress, isIndicators, perPageOf, snapPositions, type CarouselIndicators } from "../core/carousel";
import { announceTo } from "../core/announcer";
import {
  carouselMode,
  depthOf,
  isEffect,
  isLayout,
  isVertical,
  KEYLINE_LAYOUTS,
  needsFace,
  PROGRESS_EFFECTS,
  snapAlign,
  type CarouselEffect,
  type CarouselLayout,
} from "../core/carousel-effects";
import {
  bindAutoplay,
  createDeck,
  createSnap,
  revealThumb,
  scrollDrivenSupported,
  type AutoplayBinding,
  type DeckController,
  type SnapController,
} from "../core/carousel-runtime";
import type { KeylineLayout } from "../core/keylines";
import { byRef, setMarkup } from "./shared";
import type { CarouselRasterSize, CarouselRasterSource } from "../components/carousel/slideTexture";

export type { CarouselRasterSize, CarouselRasterSource };

registerIcons([chevronLeft, chevronRight, chevronUp, chevronDown, pause, play]);

export interface CarouselHandle {
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
  /** Vuelve a medir, rehace las réplicas del bucle y, en modo gl, las texturas. Conserva el slide centrado. */
  refresh: () => void;
  /** Detiene el motor y devuelve el marcado a como estaba. */
  destroy: () => void;
  /** Slide centrado, desde 0. */
  readonly index: number;
}

export interface CarouselOptions {
  /**
   * Imagen de cada slide tal como se ve (o su URL): activa el modo gl. `slide` es el elemento
   * `.z-carousel__slide`. Si devuelve null o undefined se usa la fuente declarada con data-raster.
   */
  rasterize?: (
    slide: HTMLElement,
    index: number,
    size: CarouselRasterSize,
  ) => CarouselRasterSource | null | undefined | Promise<CarouselRasterSource | null | undefined>;
}

type GlModule = typeof import("./carousel-gl");

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const RASTER = "[data-raster], [data-raster-src]";
const instances = new WeakMap<HTMLElement, CarouselHandle>();
const configure = new WeakMap<HTMLElement, (options: CarouselOptions) => void>();
let glModule: Promise<GlModule | null> | null = null;
/** Carga los shaders una sola vez; null si el módulo no está disponible. */
const loadGl = () => (glModule ??= import("./carousel-gl").catch(() => null));
const pad = (value: number) => String(value).padStart(2, "0");

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}

interface Chrome {
  controls: HTMLElement;
  /** Anterior y siguiente (sin el botón de reproducción). */
  arrows: HTMLButtonElement[];
  render(index: number, positions: number, count: number): void;
  /** Botón de reproducción, si hay reproducción automática. */
  playButton: HTMLButtonElement | null;
  dispose(): void;
}

const labelsOf = (root: HTMLElement) => ({
  previous: root.dataset.labelPrevious ?? "Previous slide",
  next: root.dataset.labelNext ?? "Next slide",
  play: root.dataset.labelPlay ?? "Start automatic slide show",
  pause: root.dataset.labelPause ?? "Pause automatic slide show",
  goTo: (index: number, count: number) =>
    (root.dataset.labelGoto ?? "Go to slide {index} of {count}").replace("{index}", String(index + 1)).replace("{count}", String(count)),
  indicators: root.dataset.labelIndicators ?? "Choose slide",
  slide: (index: number, count: number) =>
    (root.dataset.labelSlide ?? "Slide {index} of {count}").replace("{index}", String(index + 1)).replace("{count}", String(count)),
});

/**
 * Controles del contrato (reproducción, flechas, indicador): se usan los del marcado si vienen y si no se crean.
 * `onGoTo` recibe la posición de un punto o una miniatura.
 */
function controlsFor(root: HTMLElement, after: Element, vertical: boolean, autoplay: boolean, onGoTo: (index: number) => void): Chrome {
  const text = labelsOf(root);
  const indicators: CarouselIndicators = isIndicators(root.dataset.indicators) ? root.dataset.indicators : "counter";
  const undo: Array<() => void> = [];
  let controls = root.querySelector<HTMLElement>(":scope > .z-carousel__controls");
  if (!controls) {
    const created = make("div", "z-carousel__controls");
    const indicator =
      indicators === "dots" || indicators === "progress"
        ? '<div class="z-carousel__dots" role="group"></div>'
        : indicators === "bar"
          ? '<span class="z-carousel__bar" aria-hidden="true"><span class="z-carousel__bar-fill"></span></span>'
          : indicators === "none" || indicators === "thumbnails"
            ? ""
            : '<span class="z-carousel__counter" aria-hidden="true"><span class="z-carousel__counter-current"></span><span class="z-carousel__counter-total"></span></span>';
    setMarkup(
      created,
      `<button type="button" class="z-carousel__arrow">${iconSvg(vertical ? "chevron-up" : "chevron-left", { size: 16 })}</button>${indicator}<button type="button" class="z-carousel__arrow">${iconSvg(vertical ? "chevron-down" : "chevron-right", { size: 16 })}</button>`,
    );
    const [before, next] = created.querySelectorAll(".z-carousel__arrow");
    before!.setAttribute("aria-label", text.previous);
    next!.setAttribute("aria-label", text.next);
    created.querySelector(".z-carousel__dots")?.setAttribute("aria-label", text.indicators);
    after.after(created);
    controls = created;
    undo.push(() => created.remove());
  }
  let playButton = controls.querySelector<HTMLButtonElement>(".z-carousel__play");
  if (autoplay && !playButton) {
    const created = make("button", "z-carousel__arrow z-carousel__play");
    created.type = "button";
    controls.prepend(created);
    playButton = created;
    undo.push(() => created.remove());
  }
  const arrows = [...controls.querySelectorAll<HTMLButtonElement>(".z-carousel__arrow:not(.z-carousel__play)")];
  const counterCurrent = controls.querySelector(".z-carousel__counter-current");
  const counterTotal = controls.querySelector(".z-carousel__counter-total");
  const dots = controls.querySelector<HTMLElement>(".z-carousel__dots");
  const bar = controls.querySelector<HTMLElement>(".z-carousel__bar");
  const thumbs = [...root.querySelectorAll<HTMLButtonElement>(":scope > .z-carousel__thumbs > .z-carousel__thumb")];
  const thumbStrip = root.querySelector<HTMLElement>(":scope > .z-carousel__thumbs");
  if (thumbStrip) undo.push(trackScrollEdges(thumbStrip));
  const onClick = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>(".z-carousel__dot, .z-carousel__thumb") : null;
    if (!target || !root.contains(target)) return;
    const i = Number(target.dataset.index);
    if (Number.isFinite(i)) onGoTo(i);
  };
  root.addEventListener("click", onClick);
  thumbs.forEach((thumb, i) => {
    thumb.dataset.index = String(i);
    if (!thumb.hasAttribute("aria-label")) thumb.setAttribute("aria-label", text.goTo(i, thumbs.length));
  });
  return {
    controls,
    arrows,
    playButton,
    render(index, positions, count) {
      if (counterCurrent) counterCurrent.textContent = pad(count === 0 ? 0 : index + 1);
      if (counterTotal) counterTotal.textContent = `/${pad(positions)}`;
      if (bar) bar.style.setProperty("--z-carousel-progress", String(barProgress(index, positions)));
      if (dots) {
        if (dots.childElementCount !== positions) {
          dots.replaceChildren(
            ...Array.from({ length: positions }, (_, i) => {
              const dot = make("button", "z-carousel__dot");
              dot.type = "button";
              dot.dataset.index = String(i);
              dot.setAttribute("aria-label", text.goTo(i, positions));
              return dot;
            }),
          );
        }
        [...dots.children].forEach((dot, i) => {
          if (i === index) dot.setAttribute("aria-current", "true");
          else dot.removeAttribute("aria-current");
        });
      }
      thumbs.forEach((thumb, i) => {
        if (i === index) thumb.setAttribute("aria-current", "true");
        else thumb.removeAttribute("aria-current");
      });
      if (thumbs.length) revealThumb(thumbs[0]!.parentElement, index);
    },
    dispose() {
      root.removeEventListener("click", onClick);
      for (const step of undo.reverse()) step();
    },
  };
}

/** Reproducción automática del contrato: el botón de pausa refleja el estado y la región viva se calla mientras corre. */
function autoplayFor(root: HTMLElement, chrome: Chrome, live: HTMLElement | null, tick: () => void): AutoplayBinding | null {
  const interval = autoplayInterval(root.dataset.autoplay === "" ? true : Number(root.dataset.autoplay));
  if (interval === null || !chrome.playButton) return null;
  const text = labelsOf(root);
  const button = chrome.playButton;
  const paint = (playing: boolean, wanted: boolean) => {
    if (button.dataset.state !== (wanted ? "playing" : "paused")) setMarkup(button, iconSvg(wanted ? "pause" : "play", { size: 16 }));
    button.setAttribute("aria-label", wanted ? text.pause : text.play);
    button.dataset.state = wanted ? "playing" : "paused";
    root.dataset.autoplayState = playing ? "playing" : "paused";
    live?.setAttribute("aria-live", playing ? "off" : "polite");
  };
  // Cada intervalo entero cambia de animación: el punto `progress` vuelve a llenarse desde cero.
  const cycle = () => {
    root.dataset.cycle = root.dataset.cycle === "a" ? "b" : "a";
  };
  root.dataset.cycle = "a";
  const binding = bindAutoplay(root, interval, tick, paint, cycle);
  // La pausa de la persona cambia el botón aunque la reproducción ya estuviera retenida (puntero encima).
  const onClick = () => {
    binding.autoplay.toggle();
    paint(binding.autoplay.playing, binding.autoplay.wanted);
  };
  button.addEventListener("click", onClick);
  return {
    autoplay: binding.autoplay,
    dispose() {
      button.removeEventListener("click", onClick);
      binding.dispose();
    },
  };
}

/**
 * Desplazamiento nativo (varias por página, vertical, layouts de M3, efectos de profundidad) o mazo (fundido y tarjetas
 * apiladas): el motor es core/carousel-runtime, el mismo del binding de React; aquí flechas, indicadores y anuncios.
 */
function scrollCarousel(root: HTMLElement, deck: boolean): CarouselHandle {
  const text = labelsOf(root);
  const effect: CarouselEffect = isEffect(root.dataset.effect) ? root.dataset.effect : "lens";
  const layout: CarouselLayout = isLayout(root.dataset.layout) ? root.dataset.layout : "strip";
  const auto = root.dataset.perPage === "auto" || layout === "uncontained";
  const vertical = !deck && isVertical(root.dataset.orientation, effect);
  const perPage = auto ? 0 : perPageOf(Number(root.dataset.perPage) || 1);
  const align = snapAlign(layout, effect);
  const undo: Array<() => void> = [];
  let viewport = root.querySelector<HTMLElement>(":scope > .z-carousel__viewport");
  if (!viewport) {
    const original = [...root.childNodes];
    const children = [...root.children].filter(
      (el): el is HTMLElement => el instanceof HTMLElement && !el.matches(".z-carousel__controls, .z-carousel__live, .z-carousel__thumbs"),
    );
    viewport = make("div", "z-carousel__viewport");
    const track = make("div", "z-carousel__track");
    for (const child of children) {
      if (child.classList.contains("z-carousel__slide")) track.append(child);
      else {
        const slide = make("div", "z-carousel__slide");
        slide.append(child);
        track.append(slide);
      }
    }
    viewport.append(track);
    root.prepend(viewport);
    undo.push(() => root.replaceChildren(...original));
  }
  const vp = viewport;
  vp.tabIndex = 0;
  if (!vp.hasAttribute("role")) vp.setAttribute("role", "group");
  if (!vp.hasAttribute("aria-label") && root.getAttribute("aria-label")) vp.setAttribute("aria-label", root.getAttribute("aria-label")!);
  const slides = [...vp.querySelectorAll<HTMLElement>(":scope > .z-carousel__track > .z-carousel__slide")];
  const count = slides.length;
  slides.forEach((slide, i) => {
    slide.dataset.index = String(i);
    if (!slide.hasAttribute("role")) slide.setAttribute("role", "group");
    if (!slide.hasAttribute("aria-roledescription")) slide.setAttribute("aria-roledescription", "slide");
    if (!slide.hasAttribute("aria-label")) slide.setAttribute("aria-label", text.slide(i, count));
  });
  if (!deck && needsFace(layout, effect)) {
    for (const slide of slides) {
      if (slide.querySelector(":scope > .z-carousel__face")) continue;
      const face = make("div", "z-carousel__face");
      face.append(...slide.childNodes);
      slide.append(face);
      undo.push(() => {
        slide.append(...face.childNodes);
        face.remove();
      });
    }
  }
  root.dataset.mode = deck ? "deck" : "snap";
  root.dataset.effect = effect === "lens" ? "none" : effect;
  if (align === "center") root.dataset.align = "center";
  if (!deck) root.dataset.orientation = vertical ? "vertical" : "horizontal";
  const depth = root.dataset.depth;
  if (depth !== undefined) root.style.setProperty("--z-carousel-depth", String(depthOf(depth)));
  if (root.dataset.peek) root.style.setProperty("--z-carousel-peek", root.dataset.peek);
  root.style.setProperty("--z-carousel-per-page", String(Math.max(1, perPage)));
  if (!root.hasAttribute("role")) root.setAttribute("role", "region");
  if (!root.hasAttribute("aria-roledescription")) root.setAttribute("aria-roledescription", "carousel");
  let live = root.querySelector<HTMLElement>(":scope > .z-carousel__live");
  if (!live) {
    const created = make("p", "z-carousel__live");
    created.setAttribute("aria-live", "polite");
    created.setAttribute("aria-atomic", "true");
    root.append(created);
    live = created;
    undo.push(() => created.remove());
  }
  const region = live;
  const looping = root.hasAttribute("data-loop") && root.dataset.loop !== "false";
  const motion = matchMedia(REDUCED_MOTION);
  let index = 0;
  // Mientras se construye el controlador (posición inicial) aún no existe: se usan las pedidas.
  let ready = false;
  const render = () => {
    const snap = ready ? (controller as SnapController) : null;
    const fits = snap && "perPage" in snap ? snap.perPage : Math.max(1, perPage);
    const total = ready ? controller.positions : deck || auto ? count : snapPositions(count, Math.max(1, perPage));
    root.style.setProperty("--z-carousel-per-page", String(fits));
    root.toggleAttribute("data-park", Boolean(snap && "parking" in snap && snap.parking));
    if (!deck) for (const [i, slide] of slides.entries()) slide.toggleAttribute("data-active", i >= index && i < index + fits);
    chrome.render(index, total, count);
    const wraps = looping && total > 1;
    if (chrome.arrows[0]) chrome.arrows[0].disabled = total <= 1 || (!wraps && index === 0);
    if (chrome.arrows[1]) chrome.arrows[1].disabled = total <= 1 || (!wraps && index === total - 1);
  };
  const common = {
    viewport: vp,
    loop: looping,
    reducedMotion: () => motion.matches,
    initialIndex: Math.min(Math.max(Number(root.dataset.start) || 0, 0), Math.max(0, count - 1)),
    keyboard: true,
    onIndex: (next: number) => {
      index = next;
      if (ready) render();
      root.dispatchEvent(new CustomEvent("z:change", { bubbles: true, detail: { index: next } }));
    },
    onSettle: (next: number) => announceTo(region, text.slide(next, count), 300),
    onUser: () => player?.autoplay.restart(),
  };
  const perMove = root.dataset.perMove === "page" ? "page" : Number(root.dataset.perMove) || undefined;
  const controller: SnapController | DeckController = deck
    ? createDeck(common)
    : createSnap({
        ...common,
        perPage,
        vertical,
        align,
        perMove,
        progress: PROGRESS_EFFECTS.includes(effect) && !motion.matches && !scrollDrivenSupported(),
        keylines: KEYLINE_LAYOUTS.includes(layout) ? (layout as KeylineLayout) : null,
        onLayout: () => render(),
      });
  index = controller.index;
  ready = true;
  const interval = autoplayInterval(root.dataset.autoplay === "" ? true : Number(root.dataset.autoplay));
  if (interval !== null) root.style.setProperty("--z-carousel-interval", `${interval}ms`);
  const chrome = controlsFor(root, vp, vertical, interval !== null, (i) => {
    controller.goTo(Math.min(i, controller.positions - 1));
    player?.autoplay.restart();
  });
  const player = autoplayFor(root, chrome, live, () => controller.step(1));
  const onArrow = (event: MouseEvent) => {
    const arrow = event.target instanceof Element ? event.target.closest<HTMLButtonElement>(".z-carousel__arrow") : null;
    if (!arrow || !chrome.arrows.includes(arrow)) return;
    controller.step(arrow === chrome.arrows[0] ? -1 : 1);
    player?.autoplay.restart();
  };
  chrome.controls.addEventListener("click", onArrow);
  render();
  let destroyed = false;
  const handle: CarouselHandle = {
    next: () => controller.step(1),
    prev: () => controller.step(-1),
    goTo: (i) => controller.goTo(i),
    refresh: () => {
      controller.refresh();
      render();
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      controller.dispose();
      player?.dispose();
      chrome.controls.removeEventListener("click", onArrow);
      chrome.dispose();
      for (const step of undo.reverse()) step();
      instances.delete(root);
    },
    get index() {
      return index;
    },
  };
  instances.set(root, handle);
  return handle;
}

/**
 * Activa un carrusel. Idempotente: devuelve siempre el mismo controlador para el mismo elemento.
 * Con `options` sobre un carrusel ya activo, las aplica y lo refresca.
 */
export function carousel(root: HTMLElement, options?: CarouselOptions): CarouselHandle {
  const existing = instances.get(root);
  if (existing) {
    if (options) configure.get(root)?.(options);
    return existing;
  }
  const effect: CarouselEffect = isEffect(root.dataset.effect) ? root.dataset.effect : "lens";
  const mode =
    root.dataset.mode === "snap" || root.dataset.mode === "deck"
      ? root.dataset.mode
      : carouselMode({
          layout: isLayout(root.dataset.layout) ? root.dataset.layout : "strip",
          effect,
          perPage: root.dataset.perPage === "auto" ? "auto" : perPageOf(Number(root.dataset.perPage)),
          vertical: isVertical(root.dataset.orientation, effect),
        });
  if (mode !== "engine") return scrollCarousel(root, mode === "deck");

  const text = {
    previous: root.dataset.labelPrevious ?? "Previous slide",
    next: root.dataset.labelNext ?? "Next slide",
    slide: (index: number, count: number) =>
      (root.dataset.labelSlide ?? "Slide {index} of {count}").replace("{index}", String(index + 1)).replace("{count}", String(count)),
  };
  const undo: Array<() => void> = [];
  const setAttr = (el: Element, name: string, value: string) => {
    if (el.hasAttribute(name)) return;
    el.setAttribute(name, value);
    undo.push(() => el.removeAttribute(name));
  };

  // ---------- Marcado del contrato ----------
  let viewport = root.querySelector<HTMLElement>(":scope > .z-carousel__viewport");
  let track: HTMLElement;
  let stage: HTMLElement;
  if (viewport) {
    // El marcado completo es parte del contrato: un viewport sin escenario o sin pista no se puede reparar sin adivinar.
    const foundStage = viewport.querySelector<HTMLElement>(".z-carousel__stage");
    const foundTrack = viewport.querySelector<HTMLElement>(".z-carousel__track");
    if (!foundStage || !foundTrack)
      throw new Error("z-carousel: .z-carousel__viewport debe contener .z-carousel__stage y .z-carousel__track");
    stage = foundStage;
    track = foundTrack;
    // Réplicas que vinieran ya en el marcado (render de servidor): se regeneran.
    for (const clone of track.querySelectorAll(':scope > [aria-hidden="true"]')) clone.remove();
  } else {
    const original = [...root.childNodes];
    const children = [...root.children].filter(
      (el): el is HTMLElement => el instanceof HTMLElement && !el.matches(".z-carousel__controls, .z-carousel__live"),
    );
    const built = make("div", "z-carousel__viewport");
    stage = make("div", "z-carousel__stage");
    track = make("div", "z-carousel__track");
    for (const child of children) {
      if (child.classList.contains("z-carousel__slide")) track.append(child);
      else {
        const slide = make("div", "z-carousel__slide");
        slide.append(child);
        track.append(slide);
      }
    }
    stage.append(track);
    built.append(stage);
    root.prepend(built);
    viewport = built;
    undo.push(() => root.replaceChildren(...original));
  }
  const mains = [...track.children].filter((el): el is HTMLElement => el instanceof HTMLElement);
  const count = mains.length;
  mains.forEach((slide, index) => {
    slide.classList.add("z-carousel__slide");
    slide.dataset.index = String(index);
    setAttr(slide, "role", "group");
    setAttr(slide, "aria-roledescription", "slide");
    setAttr(slide, "aria-label", text.slide(index, count));
  });

  const chrome = controlsFor(
    root,
    viewport,
    false,
    autoplayInterval(root.dataset.autoplay === "" ? true : Number(root.dataset.autoplay)) !== null,
    (i) => {
      engine?.goTo(i);
      player?.autoplay.restart();
    },
  );
  undo.push(() => chrome.dispose());
  const controls = chrome.controls;
  const arrows = chrome.arrows;
  let live = root.querySelector<HTMLElement>(":scope > .z-carousel__live");
  if (!live) {
    const created = make("p", "z-carousel__live");
    created.setAttribute("aria-live", "polite");
    created.setAttribute("aria-atomic", "true");
    root.append(created);
    live = created;
    undo.push(() => created.remove());
  }
  setAttr(root, "role", "region");
  setAttr(root, "aria-roledescription", "carousel");
  setAttr(root, "data-effect", "lens");

  // ---------- Estado ----------
  const looping = root.hasAttribute("data-loop") && root.dataset.loop !== "false" && count > 1;
  const lens = root.dataset.effect === "lens";
  const motion = matchMedia(REDUCED_MOTION);
  let index = Math.min(Math.max(Number(root.dataset.start) || 0, 0), Math.max(count - 1, 0));
  let side = MIN_SIDE;
  let engine: ReturnType<typeof createEngine> | null = null;
  let creating = false;
  let wantedSide = side;
  let destroyed = false;
  let rasterize = options?.rasterize;
  let gl: GlModule | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let maxTexture = 4096;

  // ---------- Modo gl ----------
  const declared = (slide: HTMLElement) => (slide.matches(RASTER) ? slide : slide.querySelector<HTMLElement>(RASTER));
  const wantsGl = () =>
    lens &&
    !motion.matches &&
    count > 0 &&
    typeof WebGL2RenderingContext !== "undefined" &&
    (rasterize !== undefined || mains.every((slide) => declared(slide) !== null));
  /** Fuente de un slide: la de `rasterize` o la declarada en el marcado. Lanza si no hay: el motor cae a css. */
  const sourceOf = async (slideIndex: number, size: CarouselRasterSize): Promise<CarouselRasterSource> => {
    const slide = mains[slideIndex];
    if (!slide) throw new Error("Slide inexistente");
    const custom = await rasterize?.(slide, slideIndex, size);
    if (custom) return custom;
    const mark = declared(slide);
    if (!mark) throw new Error("Slide sin fuente ráster");
    if (mark.dataset.rasterSrc) return mark.dataset.rasterSrc;
    const target = mark.dataset.raster ? byRef(mark.dataset.raster) : mark;
    if (target instanceof HTMLImageElement) {
      if (!target.complete || target.naturalWidth === 0) await target.decode();
      return target;
    }
    if (target instanceof HTMLCanvasElement || target instanceof HTMLVideoElement) return target;
    throw new Error("data-raster no apunta a un <img>, <canvas> o <video>");
  };
  const texture = async (slideIndex: number, size: CarouselRasterSize) =>
    gl!.toSlideTexture(await sourceOf(slideIndex, size), size, maxTexture);
  const ensureCanvas = () => {
    if (canvas) return;
    canvas = viewport!.querySelector<HTMLCanvasElement>(":scope > canvas.z-carousel__canvas");
    if (canvas) return;
    const created = make("canvas", "z-carousel__canvas");
    created.setAttribute("aria-hidden", "true");
    viewport!.append(created);
    canvas = created;
    undo.push(() => created.remove());
  };

  const render = () => {
    mains.forEach((slide, i) => {
      slide.toggleAttribute("data-active", i === index);
    });
    chrome.render(index, count, count);
    if (arrows[0]) arrows[0].disabled = count === 0 || (!looping && index === 0);
    if (arrows[1]) arrows[1].disabled = count === 0 || (!looping && index === count - 1);
  };

  // Réplicas del bucle: decorativas, inertes y ocultas a lectores de pantalla, como en React.
  const removeClones = () => {
    for (const clone of track.querySelectorAll(':scope > [aria-hidden="true"]')) clone.remove();
  };
  const buildClones = () => {
    removeClones();
    const copies = looping ? side : 0;
    for (const slide of mains) slide.dataset.copy = String(copies);
    for (let copy = 0; copy <= copies * 2; copy++) {
      if (copy === copies) continue;
      const group = mains.map((slide) => {
        const clone = slide.cloneNode(true) as HTMLElement;
        // cloneNode no copia el dibujo de un <canvas>: se copia para que la réplica se vea igual.
        const drawn = slide.querySelectorAll("canvas");
        clone.querySelectorAll("canvas").forEach((copy, i) => {
          const from = drawn[i];
          if (from && from.width > 0 && from.height > 0) copy.getContext("2d")?.drawImage(from, 0, 0);
        });
        for (const el of [clone, ...clone.querySelectorAll("[id]")]) el.removeAttribute("id");
        for (const name of ["role", "aria-roledescription", "aria-label", "data-active"]) clone.removeAttribute(name);
        clone.dataset.copy = String(copy);
        clone.setAttribute("aria-hidden", "true");
        clone.inert = true;
        return clone;
      });
      if (copy < copies) mains[0]!.before(...group);
      else track.append(...group);
    }
  };

  const start = () => {
    engine?.dispose();
    engine = null;
    if (destroyed || count === 0) return;
    buildClones();
    const useGl = wantsGl();
    if (useGl) ensureCanvas();
    creating = true;
    wantedSide = side;
    engine = createEngine(
      { root, viewport: viewport!, stage, track, canvas },
      {
        count,
        loop: looping,
        lens,
        reducedMotion: motion.matches,
        initialIndex: index,
        side,
        rasterize: useGl && gl ? texture : null,
        createRenderer: useGl && gl ? gl.createRenderer : null,
        maxTextureSize: (value) => {
          maxTexture = value;
        },
        onActive: (next) => {
          if (next === index) return;
          index = next;
          render();
          root.dispatchEvent(new CustomEvent("z:change", { bubbles: true, detail: { index: next } }));
        },
        onNavigate: (next) => {
          live!.textContent = text.slide(next, count);
        },
        // El motor pide más réplicas cuando la tira no llena el ancho: se rehace con ellas.
        onSide: (next) => {
          wantedSide = next;
          if (!creating) restart();
        },
      },
    );
    creating = false;
    if (wantedSide !== side) return restart();
    if (!useGl || gl) return;
    // Primera vez: el carrusel ya funciona en css mientras llegan los shaders.
    const current = engine;
    void loadGl().then((loaded) => {
      if (!loaded || destroyed) return;
      gl = loaded;
      if (engine === current) current.enableGl(texture, loaded.createRenderer);
    });
  };
  const restart = () => {
    side = wantedSide;
    start();
  };

  const onClick = (event: MouseEvent) => {
    const arrow = (event.target as Element).closest?.<HTMLButtonElement>(".z-carousel__arrow");
    if (arrow && arrows.includes(arrow)) {
      engine?.step(arrow === arrows[0] ? -1 : 1);
      player?.autoplay.restart();
    }
  };
  const player = autoplayFor(root, chrome, live, () => (looping || index < count - 1 ? engine?.step(1) : engine?.goTo(0)));
  controls.addEventListener("click", onClick);
  motion.addEventListener("change", start);

  const handle: CarouselHandle = {
    next: () => engine?.step(1),
    prev: () => engine?.step(-1),
    goTo: (next) => engine?.goTo(next),
    refresh: () => {
      if (!destroyed) start();
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      engine?.dispose();
      engine = null;
      player?.dispose();
      controls.removeEventListener("click", onClick);
      motion.removeEventListener("change", start);
      removeClones();
      for (const slide of mains) for (const name of ["data-active", "data-copy", "data-index"]) slide.removeAttribute(name);
      for (const step of undo.reverse()) step();
      instances.delete(root);
      configure.delete(root);
    },
    get index() {
      return index;
    },
  };
  instances.set(root, handle);
  configure.set(root, (next) => {
    if ("rasterize" in next) rasterize = next.rasterize;
    start();
  });
  render();
  start();
  return handle;
}

export function setup(_on: Listen): void {}

export function hydrate(root: ParentNode): void {
  if (root instanceof HTMLElement && root.matches("[data-z-carousel]")) carousel(root);
  for (const el of root.querySelectorAll<HTMLElement>("[data-z-carousel]")) carousel(el);
}
