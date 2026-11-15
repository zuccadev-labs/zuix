"use client";
import {
  useCallback,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type HTMLAttributes,
  type Key,
  type ReactNode,
  type Ref,
} from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";
import type { CarouselRasterSize, CarouselRasterSource } from "./slideTexture";
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
}

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
  ref?: Ref<HTMLDivElement>;
}

const DEFAULT_LABELS: CarouselLabels = {
  previous: "Previous slide",
  next: "Next slide",
  slide: (index, count) => `Slide ${index + 1} of ${count}`,
  carousel: "carousel",
  slideRole: "slide",
};

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const subscribeReducedMotion = (notify: () => void) => {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};
const readReducedMotion = () => window.matchMedia(REDUCED_MOTION).matches;
const serverReducedMotion = () => false;

const pad = (value: number) => String(value).padStart(2, "0");
const length = (value: number | string) => (typeof value === "number" ? `${value}px` : value);

export function Carousel<T>({
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

  const setRoot = useCallback(
    (node: HTMLDivElement | null) => {
      rootRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

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
    >
      <div ref={viewportRef} className="z-carousel__viewport">
        <div ref={stageRef} className="z-carousel__stage">
          <div ref={trackRef} className="z-carousel__track">
            {copies.map((copy) =>
              items.map((item, index) => {
                const clone = copy !== side;
                const state: CarouselSlideState = { index, count, active: !clone && index === current, clone };
                return (
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
        {useGl ? <canvas ref={canvasRef} className="z-carousel__canvas" aria-hidden="true" /> : null}
      </div>

      <div className="z-carousel__controls">
        <button
          type="button"
          className="z-carousel__arrow"
          aria-label={text.previous}
          disabled={count === 0 || (!looping && current === 0)}
          onClick={() => api.step(-1)}
        >
          <Icon name="chevron-left" size={16} />
        </button>
        <span className="z-carousel__counter" aria-hidden="true">
          <span className="z-carousel__counter-current">{pad(count === 0 ? 0 : current + 1)}</span>
          <span className="z-carousel__counter-total">/{pad(count)}</span>
        </span>
        <button
          type="button"
          className="z-carousel__arrow"
          aria-label={text.next}
          disabled={count === 0 || (!looping && current === count - 1)}
          onClick={() => api.step(1)}
        >
          <Icon name="chevron-right" size={16} />
        </button>
      </div>

      <p className="z-carousel__live" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </div>
  );
}
