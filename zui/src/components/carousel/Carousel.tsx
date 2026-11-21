"use client";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type HTMLAttributes,
  type KeyboardEvent,
  type Key,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { autoplayInterval, barProgress, perPageOf, snapPositions, type CarouselIndicators } from "../../core/carousel";
import { bindAutoplay, createSnap, revealThumb, type SnapController } from "../../core/carousel-runtime";
import { cx } from "../../cx";
import { useLatest } from "../../primitives/hooks";
import type { CarouselRasterSize, CarouselRasterSource } from "./slideTexture";
import { useMergedRef } from "../../refs";
import { useCarouselTrack } from "./useCarouselTrack";

export interface CarouselSlideState {
  /** Posición del elemento en `items`. */
  index: number;
  count: number;
  /** Es el slide centrado. */
  active: boolean;
  /** Réplica del bucle infinito: decorativa, inerte y oculta a lectores de pantalla. */
  clone: boolean;
}

export interface CarouselLabels {
  previous: string;
  next: string;
  /** Nombre accesible y anuncio de cada slide. `index` empieza en 0. */
  slide: (index: number, count: number) => string;
  /** Valor de aria-roledescription de la región. */
  carousel: string;
  /** Valor de aria-roledescription de cada slide. */
  slideRole: string;
  /** Botón de reproducción automática mientras corre. */
  pause: string;
  /** Botón de reproducción automática en pausa. */
  play: string;
  /** Nombre de cada punto o miniatura. `index` empieza en 0. */
  goTo: (index: number, count: number) => string;
  /** Nombre del grupo de puntos o miniaturas. */
  indicators: string;
}

export type { CarouselIndicators };

export interface CarouselProps<T> extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "aria-label"> {
  items: readonly T[];
  renderItem: (item: T, index: number, state: CarouselSlideState) => ReactNode;
  getKey?: (item: T, index: number) => Key;
  /** "lens": el centro queda plano y los bordes se curvan como a través de un cristal. */
  effect?: "lens" | "none";
  loop?: boolean;
  ariaLabel: string;
  labels?: Partial<CarouselLabels>;
  defaultIndex?: number;
  onIndexChange?: (index: number) => void;
  /** Ancho de cada slide: número en px o cualquier longitud CSS. */
  slideWidth?: number | string;
  /** Separación entre slides: número en px o cualquier longitud CSS. */
  gap?: number | string;
  /**
   * Imagen de cada slide tal como se ve (o su URL). Activa el dibujo WebGL de las zonas curvas;
   * sin esta prop, o sin WebGL2, la lente se aplica con transformaciones CSS sobre los slides reales.
   */
  rasterize?: (item: T, index: number, size: CarouselRasterSize) => CarouselRasterSource | Promise<CarouselRasterSource>;
  /**
   * Avance automático: `true` cada 5 s o un número de milisegundos (mínimo 1500). Lleva un botón de pausa visible
   * (WCAG 2.2.2) y se detiene con el puntero encima, con el foco dentro, con la pestaña oculta y fuera de pantalla.
   * Con movimiento reducido no arranca sola.
   */
  autoplay?: boolean | number;
  /** Indicador de posición: contador (01/05), puntos, barra, miniaturas (con `renderThumbnail`) o ninguno. */
  indicators?: CarouselIndicators;
  /** Contenido de cada miniatura con `indicators="thumbnails"` (una imagen pequeña). */
  renderThumbnail?: (item: T, index: number) => ReactNode;
  /**
   * Slides visibles a la vez (1–8). Con más de uno, o en vertical, el carrusel pasa al modo de desplazamiento nativo
   * con scroll-snap (sin lente ni réplicas: `loop` solo hace que las flechas vuelvan al principio).
   */
  slidesPerPage?: number;
  orientation?: "horizontal" | "vertical";
  /** Alto de la vista en vertical: número en px o cualquier longitud CSS. */
  height?: number | string;
  ref?: Ref<HTMLDivElement>;
}

const DEFAULT_LABELS: CarouselLabels = {
  previous: "Previous slide",
  next: "Next slide",
  slide: (index, count) => `Slide ${index + 1} of ${count}`,
  carousel: "carousel",
  slideRole: "slide",
  pause: "Pause automatic slide show",
  play: "Start automatic slide show",
  goTo: (index, count) => `Go to slide ${index + 1} of ${count}`,
  indicators: "Choose slide",
};

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const subscribeReducedMotion = (notify: () => void) => {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};
const readReducedMotion = () => window.matchMedia(REDUCED_MOTION).matches;
const serverReducedMotion = () => false;

const length = (value: number | string) => (typeof value === "number" ? `${value}px` : value);

/**
 * Carrusel. Por defecto, una tira con bucle, arrastre con inercia y lente (motor propio). Con `slidesPerPage` > 1 u
 * `orientation="vertical"`, desplazamiento nativo con scroll-snap. En los dos: flechas, indicadores y reproducción
 * automática con pausa.
 */
export function Carousel<T>(props: CarouselProps<T>) {
  const snap = props.orientation === "vertical" || perPageOf(props.slidesPerPage) > 1;
  return snap ? <SnapCarousel {...props} /> : <EngineCarousel {...props} />;
}

function EngineCarousel<T>({
  items,
  renderItem,
  getKey,
  effect = "lens",
  loop = true,
  ariaLabel,
  labels,
  defaultIndex = 0,
  onIndexChange,
  slideWidth,
  gap,
  rasterize,
  autoplay,
  indicators = "counter",
  renderThumbnail,
  slidesPerPage: _perPage,
  orientation: _orientation,
  height: _height,
  className,
  style,
  ref,
  ...rest
}: CarouselProps<T>) {
  const count = items.length;
  const text = { ...DEFAULT_LABELS, ...labels };
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, readReducedMotion, serverReducedMotion);
  const [activeIndex, setActiveIndex] = useState(() => Math.min(Math.max(defaultIndex, 0), Math.max(count - 1, 0)));
  const [announcement, setAnnouncement] = useState("");

  const rootRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const setRoot = useMergedRef(rootRef, ref);

  const keys = items.map((item, index) => String(getKey ? getKey(item, index) : index));
  const useGl = effect === "lens" && rasterize !== undefined;

  const { side, api } = useCarouselTrack({
    rootRef,
    viewportRef,
    stageRef,
    trackRef,
    canvasRef,
    count,
    loop,
    lens: effect === "lens",
    reducedMotion,
    defaultIndex: activeIndex,
    contentKey: keys.join("\u0000"),
    rasterize: useGl
      ? (index, size) => {
          const item = items[index];
          if (item === undefined || !rasterize) throw new Error("Slide sin elemento");
          return rasterize(item, index, size);
        }
      : null,
    onActive: (index) => {
      setActiveIndex(index);
      onIndexChange?.(index);
    },
    onNavigate: (index) => setAnnouncement(text.slide(index, count)),
  });

  const current = Math.min(activeIndex, Math.max(count - 1, 0));
  const looping = loop && count > 1;
  const currentRef = useLatest(current);
  const play = useCarouselAutoplay(rootRef, autoplay, () => (looping || currentRef.current < count - 1 ? api.step(1) : api.goTo(0)));
  const copies = Array.from({ length: side * 2 + 1 }, (_, copy) => copy);
  const vars: Record<string, string> = {};
  if (slideWidth !== undefined) vars["--z-carousel-slide-width"] = length(slideWidth);
  if (gap !== undefined) vars["--z-carousel-gap"] = length(gap);
  const rootStyle = { ...style, ...vars } as CSSProperties;

  return (
    <div
      {...rest}
      ref={setRoot}
      className={cx("z-carousel", className)}
      style={rootStyle}
      role="region"
      aria-roledescription={text.carousel}
      aria-label={ariaLabel}
      data-effect={effect}
      data-indicators={indicators === "counter" ? undefined : indicators}
      data-autoplay-state={play.enabled ? (play.playing ? "playing" : "paused") : undefined}
    >
      <div ref={viewportRef} className="z-carousel__viewport">
        <div ref={stageRef} className="z-carousel__stage">
          <div ref={trackRef} className="z-carousel__track">
            {copies.map((copy) =>
              items.map((item, index) => {
                const clone = copy !== side;
                const state: CarouselSlideState = { index, count, active: !clone && index === current, clone };
                return (
                  // biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-roledescription solo se emite junto a role="group" (el slide real); las réplicas no llevan ni uno ni otro.
                  <div
                    // La copia principal conserva su clave aunque cambie el número de réplicas.
                    key={clone ? `${copy - side}:${keys[index]}` : `main:${keys[index]}`}
                    className="z-carousel__slide"
                    data-copy={copy}
                    data-index={index}
                    data-active={state.active || undefined}
                    role={clone ? undefined : "group"}
                    aria-roledescription={clone ? undefined : text.slideRole}
                    aria-label={clone ? undefined : text.slide(index, count)}
                    aria-hidden={clone || undefined}
                    inert={clone || undefined}
                  >
                    {renderItem(item, index, state)}
                  </div>
                );
              }),
            )}
          </div>
        </div>
        {/* biome-ignore lint/a11y/noAriaHiddenOnFocusable: un <canvas> sin tabindex no recibe foco; es la capa de dibujo WebGL y los slides reales siguen en el árbol accesible. */}
        {useGl ? <canvas ref={canvasRef} className="z-carousel__canvas" aria-hidden="true" /> : null}
      </div>

      <CarouselControls
        text={text}
        count={count}
        index={current}
        indicators={indicators}
        canPrev={count > 0 && (looping || current > 0)}
        canNext={count > 0 && (looping || current < count - 1)}
        onStep={(direction) => {
          api.step(direction);
          play.restart();
        }}
        onGoTo={(index) => {
          api.goTo(index);
          play.restart();
        }}
        play={play}
      />
      {indicators === "thumbnails" && renderThumbnail ? (
        <CarouselThumbs text={text} items={items} index={current} renderThumbnail={renderThumbnail} onGoTo={(index) => api.goTo(index)} />
      ) : null}

      <p className="z-carousel__live" aria-live={play.playing ? "off" : "polite"} aria-atomic="true">
        {announcement}
      </p>
    </div>
  );
}

/* ---------- Controles comunes: reproducción, flechas e indicador ---------- */

interface AutoplayState {
  enabled: boolean;
  playing: boolean;
  wanted: boolean;
  toggle: () => void;
  restart: () => void;
}

function useCarouselAutoplay(root: RefObject<HTMLElement | null>, autoplay: boolean | number | undefined, tick: () => void): AutoplayState {
  const interval = autoplayInterval(autoplay);
  const [state, setState] = useState({ playing: false, wanted: false });
  const tickRef = useLatest(tick);
  const binding = useRef<ReturnType<typeof bindAutoplay> | null>(null);
  useEffect(() => {
    const el = root.current;
    if (!el || interval === null) return;
    const b = bindAutoplay(
      el,
      interval,
      () => tickRef.current(),
      (playing, wanted) => setState({ playing, wanted }),
    );
    binding.current = b;
    return () => {
      binding.current = null;
      b.dispose();
    };
  }, [root, interval, tickRef]);
  return {
    enabled: interval !== null,
    playing: state.playing,
    wanted: state.wanted,
    toggle: () => {
      const a = binding.current?.autoplay;
      if (!a) return;
      a.toggle();
      setState({ playing: a.playing, wanted: a.wanted });
    },
    restart: () => binding.current?.autoplay.restart(),
  };
}

const pad2 = (value: number) => String(value).padStart(2, "0");

function CarouselControls({
  text,
  count,
  index,
  positions = count,
  indicators,
  canPrev,
  canNext,
  onStep,
  onGoTo,
  play,
  vertical,
}: {
  text: CarouselLabels;
  count: number;
  index: number;
  positions?: number;
  indicators: CarouselIndicators;
  canPrev: boolean;
  canNext: boolean;
  onStep: (direction: 1 | -1) => void;
  onGoTo: (index: number) => void;
  play: AutoplayState;
  vertical?: boolean;
}) {
  return (
    <div className="z-carousel__controls">
      {play.enabled ? (
        // Primer control del carrusel (APG): detener el movimiento está siempre a un Tab.
        <button
          type="button"
          className="z-carousel__arrow z-carousel__play"
          aria-label={play.wanted ? text.pause : text.play}
          data-state={play.wanted ? "playing" : "paused"}
          onClick={play.toggle}
        >
          <Icon name={play.wanted ? "pause" : "play"} size={16} />
        </button>
      ) : null}
      <button type="button" className="z-carousel__arrow" aria-label={text.previous} disabled={!canPrev} onClick={() => onStep(-1)}>
        <Icon name={vertical ? "chevron-up" : "chevron-left"} size={16} />
      </button>
      {indicators === "dots" ? (
        <div className="z-carousel__dots" role="group" aria-label={text.indicators}>
          {Array.from({ length: positions }, (_, i) => (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: un punto por posición, en orden.
              key={i}
              type="button"
              className="z-carousel__dot"
              aria-label={text.goTo(i, positions)}
              aria-current={i === index ? "true" : undefined}
              onClick={() => onGoTo(i)}
            />
          ))}
        </div>
      ) : indicators === "bar" ? (
        <span
          className="z-carousel__bar"
          aria-hidden="true"
          style={{ "--z-carousel-progress": barProgress(index, positions) } as CSSProperties}
        >
          <span className="z-carousel__bar-fill" />
        </span>
      ) : indicators === "none" || indicators === "thumbnails" ? null : (
        <span className="z-carousel__counter" aria-hidden="true">
          <span className="z-carousel__counter-current">{pad2(count === 0 ? 0 : index + 1)}</span>
          <span className="z-carousel__counter-total">/{pad2(positions)}</span>
        </span>
      )}
      <button type="button" className="z-carousel__arrow" aria-label={text.next} disabled={!canNext} onClick={() => onStep(1)}>
        <Icon name={vertical ? "chevron-down" : "chevron-right"} size={16} />
      </button>
    </div>
  );
}

function CarouselThumbs<T>({
  text,
  items,
  index,
  renderThumbnail,
  onGoTo,
}: {
  text: CarouselLabels;
  items: readonly T[];
  index: number;
  renderThumbnail: (item: T, index: number) => ReactNode;
  onGoTo: (index: number) => void;
}) {
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => revealThumb(strip.current, index), [index]);
  return (
    <div ref={strip} className="z-carousel__thumbs" role="group" aria-label={text.indicators}>
      {items.map((item, i) => (
        <button
          // biome-ignore lint/suspicious/noArrayIndexKey: una miniatura por slide, en orden.
          key={i}
          type="button"
          className="z-carousel__thumb"
          aria-label={text.goTo(i, items.length)}
          aria-current={i === index ? "true" : undefined}
          onClick={() => onGoTo(i)}
        >
          {renderThumbnail(item, i)}
        </button>
      ))}
    </div>
  );
}

/* ---------- Modo snap: varias por página y vertical ---------- */

function SnapCarousel<T>({
  items,
  renderItem,
  getKey,
  loop = true,
  ariaLabel,
  labels,
  defaultIndex = 0,
  onIndexChange,
  slideWidth: _slideWidth,
  gap,
  autoplay,
  indicators = "counter",
  renderThumbnail,
  slidesPerPage,
  orientation = "horizontal",
  height,
  effect: _effect,
  rasterize: _rasterize,
  className,
  style,
  ref,
  ...rest
}: CarouselProps<T>) {
  const count = items.length;
  const text = { ...DEFAULT_LABELS, ...labels };
  const perPage = perPageOf(slidesPerPage);
  const vertical = orientation === "vertical";
  const positions = snapPositions(count, perPage);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, readReducedMotion, serverReducedMotion);
  const [index, setIndex] = useState(() => Math.min(Math.max(defaultIndex, 0), positions - 1));
  const [announcement, setAnnouncement] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const setRoot = useMergedRef(rootRef, ref);
  const snap = useRef<SnapController | null>(null);
  const onIndexRef = useLatest(onIndexChange);
  const reducedRef = useLatest(reducedMotion);
  const indexRef = useLatest(index);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `count` no se lee dentro; cambia cuando cambian los slides y obliga a volver a medir.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const controller = createSnap({
      viewport,
      perPage,
      vertical,
      loop,
      reducedMotion: () => reducedRef.current,
      initialIndex: indexRef.current,
      onIndex: (next) => {
        setIndex(next);
        onIndexRef.current?.(next);
      },
    });
    snap.current = controller;
    return () => {
      snap.current = null;
      controller.dispose();
    };
  }, [perPage, vertical, loop, count, onIndexRef, reducedRef, indexRef]);

  const navigate = (fn: (c: SnapController) => void) => {
    const c = snap.current;
    if (!c) return;
    fn(c);
    setAnnouncement(text.slide(c.index, count));
  };
  const play = useCarouselAutoplay(rootRef, autoplay, () => snap.current?.step(1));
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const back = vertical ? "ArrowUp" : "ArrowLeft";
    const forward = vertical ? "ArrowDown" : "ArrowRight";
    const rtl = !vertical && rootRef.current !== null && getComputedStyle(rootRef.current).direction === "rtl";
    const dir = event.key === back ? (rtl ? 1 : -1) : event.key === forward ? (rtl ? -1 : 1) : 0;
    if (dir !== 0) {
      event.preventDefault();
      navigate((c) => c.step(dir as 1 | -1));
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      navigate((c) => c.goTo(event.key === "Home" ? 0 : positions - 1));
    }
  };

  const vars: Record<string, string | number> = { "--z-carousel-per-page": perPage };
  if (gap !== undefined) vars["--z-carousel-gap"] = length(gap);
  if (height !== undefined) vars["--z-carousel-height"] = length(height);
  const looping = loop && positions > 1;
  return (
    <div
      {...rest}
      ref={setRoot}
      className={cx("z-carousel", className)}
      style={{ ...style, ...vars } as CSSProperties}
      role="region"
      aria-roledescription={text.carousel}
      aria-label={ariaLabel}
      data-effect="none"
      data-mode="snap"
      data-orientation={orientation}
      data-indicators={indicators === "counter" ? undefined : indicators}
      data-autoplay-state={play.enabled ? (play.playing ? "playing" : "paused") : undefined}
    >
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: la vista desplazable recibe el foco para moverse con las flechas (también lo haría el navegador por ser desplazable). */}
      <div ref={viewportRef} className="z-carousel__viewport" tabIndex={0} aria-label={ariaLabel} role="group" onKeyDown={onKeyDown}>
        <div className="z-carousel__track">
          {items.map((item, i) => (
            <div
              key={getKey ? getKey(item, i) : i}
              className="z-carousel__slide"
              data-index={i}
              data-active={i >= index && i < index + perPage ? true : undefined}
              role="group"
              aria-roledescription={text.slideRole}
              aria-label={text.slide(i, count)}
            >
              {renderItem(item, i, { index: i, count, active: i === index, clone: false })}
            </div>
          ))}
        </div>
      </div>
      <CarouselControls
        text={text}
        count={count}
        index={index}
        positions={positions}
        indicators={indicators}
        vertical={vertical}
        canPrev={positions > 1 && (looping || index > 0)}
        canNext={positions > 1 && (looping || index < positions - 1)}
        onStep={(direction) => {
          navigate((c) => c.step(direction));
          play.restart();
        }}
        onGoTo={(i) => {
          navigate((c) => c.goTo(i));
          play.restart();
        }}
        play={play}
      />
      {indicators === "thumbnails" && renderThumbnail ? (
        <CarouselThumbs
          text={text}
          items={items}
          index={index}
          renderThumbnail={renderThumbnail}
          onGoTo={(i) => navigate((c) => c.goTo(Math.min(i, positions - 1)))}
        />
      ) : null}
      <p className="z-carousel__live" aria-live={play.playing ? "off" : "polite"} aria-atomic="true">
        {announcement}
      </p>
    </div>
  );
}
