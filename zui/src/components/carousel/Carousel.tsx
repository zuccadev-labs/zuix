"use client";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type HTMLAttributes,
  type Key,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { announceTo } from "../../core/announcer";
import { autoplayInterval, barProgress, perPageOf, snapPositions, type CarouselIndicators } from "../../core/carousel";
import {
  carouselMode,
  depthOf,
  isVertical,
  KEYLINE_LAYOUTS,
  needsFace,
  PROGRESS_EFFECTS,
  snapAlign,
  type CarouselEffect,
  type CarouselLayout,
} from "../../core/carousel-effects";
import {
  bindAutoplay,
  createDeck,
  createSnap,
  revealThumb,
  scrollDrivenSupported,
  type DeckController,
  type SnapController,
} from "../../core/carousel-runtime";
import type { KeylineLayout } from "../../core/keylines";
import { trackScrollEdges } from "../../core/edges";
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
  pause?: string;
  /** Botón de reproducción automática en pausa. */
  play?: string;
  /** Nombre de cada punto o miniatura. `index` empieza en 0. */
  goTo?: (index: number, count: number) => string;
  /** Nombre del grupo de puntos o miniaturas. */
  indicators?: string;
}

export type { CarouselIndicators, CarouselEffect, CarouselLayout };

export interface CarouselProps<T> extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "aria-label"> {
  items: readonly T[];
  renderItem: (item: T, index: number, state: CarouselSlideState) => ReactNode;
  getKey?: (item: T, index: number) => Key;
  /**
   * Cómo se transforma cada slide según su distancia al centro. "lens" (por defecto): el centro plano y los bordes
   * curvos como a través de un cristal. "prism": coverflow de cristal con profundidad (la variante de marca).
   * "coverflow", "parallax" (capas `[data-parallax-layer]`), "wheel" (cilindro vertical) y "fade" (fundido).
   */
  effect?: CarouselEffect;
  /**
   * Cómo se reparte el espacio. "strip" (por defecto), los de Material 3 ("multi-browse", "hero", "hero-center",
   * "uncontained", "fullscreen") y "stack" (mazo de tarjetas que se descartan deslizando).
   */
  layout?: CarouselLayout;
  /** Posiciones por paso de las flechas y la reproducción: un número o "page" (las que caben). */
  slidesPerMove?: number | "page";
  /** La vista toma el alto del slide activo. */
  autoHeight?: boolean;
  /** Intensidad del giro y la profundidad de "prism", "coverflow" y "wheel" (0–2). */
  depth?: number;
  /** Avance visible del siguiente slide: número en px o cualquier longitud CSS. */
  peek?: number | string;
  /** Con "fade": zoom lento sobre la imagen (`.z-carousel__media`) del slide activo. */
  kenBurns?: boolean;
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
   * Slides visibles a la vez (1–8) o "auto" (cada uno con su ancho). Con más de uno, en vertical o con un layout o
   * efecto que no sea la tira con lente, el carrusel usa el desplazamiento nativo con scroll-snap. El bucle aparca el
   * primer o el último slide con `order` (sin réplicas) cuando se ve uno por página.
   */
  slidesPerPage?: number | "auto";
  orientation?: "horizontal" | "vertical";
  /** Alto de la vista en vertical: número en px o cualquier longitud CSS. */
  height?: number | string;
  ref?: Ref<HTMLDivElement>;
}

const DEFAULT_LABELS: Required<CarouselLabels> = {
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
  const effect = props.effect ?? "lens";
  const mode = carouselMode({
    layout: props.layout,
    effect,
    perPage: props.slidesPerPage === "auto" ? "auto" : perPageOf(props.slidesPerPage),
    vertical: isVertical(props.orientation, effect),
  });
  if (mode === "engine") return <EngineCarousel {...props} />;
  return <ScrollCarousel {...props} deck={mode === "deck"} />;
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
  slidesPerMove: _perMove,
  orientation: _orientation,
  height: _height,
  layout: _layout,
  autoHeight: _autoHeight,
  depth: _depth,
  peek: _peek,
  kenBurns: _kenBurns,
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
      data-cycle={play.enabled ? play.cycle : undefined}
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
  interval: number | null;
  /** Cambia cada vez que empieza un intervalo entero: reinicia el llenado del indicador `progress`. */
  cycle: "a" | "b";
  playing: boolean;
  wanted: boolean;
  toggle: () => void;
  restart: () => void;
}

function useCarouselAutoplay(root: RefObject<HTMLElement | null>, autoplay: boolean | number | undefined, tick: () => void): AutoplayState {
  const interval = autoplayInterval(autoplay);
  const [state, setState] = useState({ playing: false, wanted: false });
  const [cycle, setCycle] = useState<"a" | "b">("a");
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
      () => setCycle((c) => (c === "a" ? "b" : "a")),
    );
    binding.current = b;
    return () => {
      binding.current = null;
      b.dispose();
    };
  }, [root, interval, tickRef]);
  return {
    enabled: interval !== null,
    interval,
    cycle,
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
  text: Required<CarouselLabels>;
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
      {indicators === "dots" || indicators === "progress" ? (
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
  text: Required<CarouselLabels>;
  items: readonly T[];
  index: number;
  renderThumbnail: (item: T, index: number) => ReactNode;
  onGoTo: (index: number) => void;
}) {
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => revealThumb(strip.current, index), [index]);
  // La tira de miniaturas desplaza: el borde con miniaturas ocultas se difumina.
  useEffect(() => (strip.current ? trackScrollEdges(strip.current) : undefined), []);
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

/* ---------- Desplazamiento nativo (snap) y mazo (deck) ---------- */

function ScrollCarousel<T>({
  items,
  renderItem,
  getKey,
  loop = true,
  ariaLabel,
  labels,
  defaultIndex = 0,
  onIndexChange,
  slideWidth,
  gap,
  autoplay,
  indicators = "counter",
  renderThumbnail,
  slidesPerPage,
  slidesPerMove,
  orientation = "horizontal",
  height,
  effect = "lens",
  layout = "strip",
  autoHeight,
  depth,
  peek,
  kenBurns,
  rasterize: _rasterize,
  className,
  style,
  ref,
  deck,
  ...rest
}: CarouselProps<T> & { deck: boolean }) {
  const count = items.length;
  const text = { ...DEFAULT_LABELS, ...labels };
  const auto = slidesPerPage === "auto" || layout === "uncontained";
  const perPage = auto ? 0 : perPageOf(slidesPerPage);
  const vertical = !deck && isVertical(orientation, effect);
  const align = snapAlign(layout, effect);
  const shownEffect = effect === "lens" ? "none" : effect;
  const face = !deck && needsFace(layout, effect);
  // Las que caben de verdad (en una tira estrecha, menos de las pedidas); las mide el controlador al montar y al
  // cambiar de tamaño. Antes de medir, las pedidas.
  const [fits, setFits] = useState(Math.max(1, perPage));
  const shown = Math.min(fits, Math.max(1, perPage));
  const [positions, setPositions] = useState(() => (deck || auto ? count : snapPositions(count, shown)));
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, readReducedMotion, serverReducedMotion);
  const [index, setIndex] = useState(() => Math.min(Math.max(defaultIndex, 0), Math.max(0, count - 1)));
  const [parking, setParking] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);
  const setRoot = useMergedRef(rootRef, ref);
  const controller = useRef<SnapController | DeckController | null>(null);
  const onIndexRef = useLatest(onIndexChange);
  const reducedRef = useLatest(reducedMotion);
  const indexRef = useLatest(index);
  const textRef = useLatest(text);
  const play = useCarouselAutoplay(rootRef, autoplay, () => controller.current?.step(1));
  const restartRef = useLatest(play.restart);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `count` no se lee dentro; cambia cuando cambian los slides y obliga a volver a medir.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const common = {
      viewport,
      loop,
      reducedMotion: () => reducedRef.current,
      initialIndex: indexRef.current,
      keyboard: true,
      onIndex: (next: number) => {
        setIndex(next);
        onIndexRef.current?.(next);
      },
      onSettle: (next: number) => {
        if (liveRef.current)
          announceTo(liveRef.current, textRef.current.slide(next, viewport.querySelectorAll(".z-carousel__slide").length), 300);
      },
      onUser: () => restartRef.current(),
    };
    const c = deck
      ? createDeck(common)
      : createSnap({
          ...common,
          perPage,
          vertical,
          align,
          perMove: slidesPerMove,
          progress: PROGRESS_EFFECTS.includes(effect) && !reducedRef.current && !scrollDrivenSupported(),
          keylines: KEYLINE_LAYOUTS.includes(layout) ? (layout as KeylineLayout) : null,
          onLayout: () => {
            const snap = controller.current as SnapController | null;
            if (!snap) return;
            setFits(snap.perPage);
            setPositions(snap.positions);
            setParking(snap.parking);
          },
        });
    controller.current = c;
    setPositions(c.positions);
    if ("perPage" in c) {
      setFits(c.perPage);
      setParking(c.parking);
    }
    return () => {
      controller.current = null;
      c.dispose();
    };
  }, [deck, perPage, vertical, align, loop, count, layout, effect, slidesPerMove, onIndexRef, reducedRef, indexRef, textRef, restartRef]);

  const navigate = (fn: (c: SnapController | DeckController) => void) => {
    const c = controller.current;
    if (!c) return;
    fn(c);
    play.restart();
  };

  const vars: Record<string, string | number> = { "--z-carousel-per-page": shown };
  if (slideWidth !== undefined) vars["--z-carousel-slide-width"] = length(slideWidth);
  if (gap !== undefined) vars["--z-carousel-gap"] = length(gap);
  if (height !== undefined) vars["--z-carousel-height"] = length(height);
  if (peek !== undefined) vars["--z-carousel-peek"] = length(peek);
  if (depth !== undefined) vars["--z-carousel-depth"] = depthOf(depth);
  if (play.interval !== null) vars["--z-carousel-interval"] = `${play.interval}ms`;
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
      data-effect={shownEffect}
      data-mode={deck ? "deck" : "snap"}
      data-layout={layout === "strip" ? undefined : layout}
      data-align={align === "center" ? "center" : undefined}
      data-orientation={deck ? undefined : vertical ? "vertical" : "horizontal"}
      data-per-page={auto ? "auto" : undefined}
      data-peek={peek !== undefined ? "" : undefined}
      data-park={parking ? "" : undefined}
      data-auto-height={autoHeight ? "" : undefined}
      data-kenburns={kenBurns ? "" : undefined}
      data-indicators={indicators === "counter" ? undefined : indicators}
      data-autoplay-state={play.enabled ? (play.playing ? "playing" : "paused") : undefined}
      data-cycle={play.enabled ? play.cycle : undefined}
    >
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: la vista desplazable recibe el foco para moverse con las flechas (también lo haría el navegador por ser desplazable). */}
      <div ref={viewportRef} className="z-carousel__viewport" tabIndex={0} aria-label={ariaLabel} role="group">
        <div className="z-carousel__track">
          {items.map((item, i) => {
            const active = deck ? i === index : i >= index && i < index + shown;
            return (
              <div
                key={getKey ? getKey(item, i) : i}
                className="z-carousel__slide"
                data-index={i}
                // En el mazo el motor marca el activo (y deja inertes los demás).
                data-active={!deck && active ? true : undefined}
                role="group"
                aria-roledescription={text.slideRole}
                aria-label={text.slide(i, count)}
              >
                {face ? (
                  <div className="z-carousel__face">{renderItem(item, i, { index: i, count, active: i === index, clone: false })}</div>
                ) : (
                  renderItem(item, i, { index: i, count, active: i === index, clone: false })
                )}
              </div>
            );
          })}
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
        onStep={(direction) => navigate((c) => c.step(direction))}
        onGoTo={(i) => navigate((c) => c.goTo(i))}
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
      <p ref={liveRef} className="z-carousel__live" aria-live={play.playing ? "off" : "polite"} aria-atomic="true" />
    </div>
  );
}
