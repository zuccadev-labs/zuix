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
import { iconSvg, registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { chevronLeft } from "@zuccadev-labs/zuix-zicon/icons/chevron-left";
import { chevronRight } from "@zuccadev-labs/zuix-zicon/icons/chevron-right";
import { MIN_SIDE, createEngine } from "../components/carousel/engine";
import type { CarouselRasterSize, CarouselRasterSource } from "../components/carousel/slideTexture";

export type { CarouselRasterSize, CarouselRasterSource };

registerIcons([chevronLeft, chevronRight]);

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

  const text = {
    previous: root.dataset.labelPrevious ?? "Previous slide",
    next: root.dataset.labelNext ?? "Next slide",
    slide: (index: number, count: number) => (root.dataset.labelSlide ?? "Slide {index} of {count}").replace("{index}", String(index + 1)).replace("{count}", String(count)),
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
    stage = viewport.querySelector<HTMLElement>(".z-carousel__stage")!;
    track = viewport.querySelector<HTMLElement>(".z-carousel__track")!;
    // Réplicas que vinieran ya en el marcado (render de servidor): se regeneran.
    for (const clone of track.querySelectorAll(':scope > [aria-hidden="true"]')) clone.remove();
  } else {
    const original = [...root.childNodes];
    const children = [...root.children].filter((el): el is HTMLElement => el instanceof HTMLElement && !el.matches(".z-carousel__controls, .z-carousel__live"));
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

  let controls = root.querySelector<HTMLElement>(":scope > .z-carousel__controls");
  if (!controls) {
    const created = make("div", "z-carousel__controls");
    created.innerHTML = `<button type="button" class="z-carousel__arrow">${iconSvg("chevron-left", { size: 16 })}</button><span class="z-carousel__counter" aria-hidden="true"><span class="z-carousel__counter-current"></span><span class="z-carousel__counter-total"></span></span><button type="button" class="z-carousel__arrow">${iconSvg("chevron-right", { size: 16 })}</button>`;
    const [before, after] = created.querySelectorAll(".z-carousel__arrow");
    before!.setAttribute("aria-label", text.previous);
    after!.setAttribute("aria-label", text.next);
    viewport.after(created);
    controls = created;
    undo.push(() => created.remove());
  }
  const arrows = [...controls.querySelectorAll<HTMLButtonElement>(".z-carousel__arrow")];
  const counterCurrent = controls.querySelector(".z-carousel__counter-current");
  const counterTotal = controls.querySelector(".z-carousel__counter-total");
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
    lens && !motion.matches && count > 0 && typeof WebGL2RenderingContext !== "undefined" &&
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
    const target = mark.dataset.raster ? document.querySelector(mark.dataset.raster) : mark;
    if (target instanceof HTMLImageElement) {
      if (!target.complete || target.naturalWidth === 0) await target.decode();
      return target;
    }
    if (target instanceof HTMLCanvasElement || target instanceof HTMLVideoElement) return target;
    throw new Error("data-raster no apunta a un <img>, <canvas> o <video>");
  };
  const texture = async (slideIndex: number, size: CarouselRasterSize) => gl!.toSlideTexture(await sourceOf(slideIndex, size), size, maxTexture);
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
    mains.forEach((slide, i) => slide.toggleAttribute("data-active", i === index));
    if (counterCurrent) counterCurrent.textContent = pad(count === 0 ? 0 : index + 1);
    if (counterTotal) counterTotal.textContent = `/${pad(count)}`;
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
    if (arrow && arrows.includes(arrow)) engine?.step(arrow === arrows[0] ? -1 : 1);
  };
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
      controls!.removeEventListener("click", onClick);
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

export function setup(): void {}

export function hydrate(root: ParentNode): void {
  if (root instanceof HTMLElement && root.matches("[data-z-carousel]")) carousel(root);
  for (const el of root.querySelectorAll<HTMLElement>("[data-z-carousel]")) carousel(el);
}
