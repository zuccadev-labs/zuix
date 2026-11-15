"use client";
import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { MIN_SIDE, createEngine } from "./engine";
import { LensRenderer } from "./lensRenderer";
import { toSlideTexture, type CarouselRasterSize, type CarouselRasterSource } from "./slideTexture";

// Binding de React del motor del carrusel (engine.ts): refs, ciclo de vida y número de réplicas.
export type { CarouselMode } from "./engine";

export interface CarouselTrackApi {
  /** Avanza o retrocede un slide. */
  step: (direction: 1 | -1) => void;
  /** Centra el slide indicado. */
  goTo: (index: number) => void;
}

export interface UseCarouselTrackOptions {
  rootRef: RefObject<HTMLElement | null>;
  viewportRef: RefObject<HTMLElement | null>;
  stageRef: RefObject<HTMLElement | null>;
  trackRef: RefObject<HTMLElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  count: number;
  loop: boolean;
  lens: boolean;
  reducedMotion: boolean;
  defaultIndex: number;
  /** Cambia cuando cambia el contenido de los slides (para volver a medir y rasterizar). */
  contentKey: string;
  rasterize: ((index: number, size: CarouselRasterSize) => CarouselRasterSource | Promise<CarouselRasterSource>) | null;
  onActive: (index: number) => void;
  /** Navegación explícita (flechas o teclado): se anuncia a lectores de pantalla. */
  onNavigate: (index: number) => void;
}

export function useCarouselTrack(options: UseCarouselTrackOptions): { side: number; api: CarouselTrackApi } {
  const { rootRef, viewportRef, stageRef, trackRef, canvasRef, count, reducedMotion, lens, contentKey } = options;
  const loop = options.loop && count > 1;
  const hasRasterize = options.rasterize !== null;
  const [side, setSide] = useState(MIN_SIDE);

  const latest = useRef(options);
  const engineRef = useRef<ReturnType<typeof createEngine> | null>(null);
  const indexRef = useRef(options.defaultIndex);
  const maxTextureRef = useRef(4096);

  // Siempre las funciones del último render, sin reiniciar el motor.
  useLayoutEffect(() => {
    latest.current = options;
  });

  useLayoutEffect(() => {
    const root = rootRef.current;
    const viewport = viewportRef.current;
    const stage = stageRef.current;
    const track = trackRef.current;
    if (!root || !viewport || !stage || !track || count === 0) return;

    const engine = createEngine(
      { root, viewport, stage, track, canvas: canvasRef.current },
      {
        count,
        loop,
        lens,
        reducedMotion,
        initialIndex: indexRef.current,
        side,
        rasterize: hasRasterize
          ? async (index, size) => {
              const rasterize = latest.current.rasterize;
              if (!rasterize) throw new Error("Sin rasterizador");
              return toSlideTexture(await rasterize(index, size), size, maxTextureRef.current);
            }
          : null,
        createRenderer: hasRasterize ? LensRenderer.create : null,
        maxTextureSize: (value) => {
          maxTextureRef.current = value;
        },
        onActive: (index) => {
          if (index === indexRef.current) return;
          indexRef.current = index;
          latest.current.onActive(index);
        },
        onNavigate: (index) => latest.current.onNavigate(index),
        onSide: setSide,
      },
    );
    engineRef.current = engine;
    return () => {
      engineRef.current = null;
      engine.dispose();
    };
  }, [rootRef, viewportRef, stageRef, trackRef, canvasRef, count, loop, lens, reducedMotion, side, hasRasterize, contentKey]);

  const api = useMemo<CarouselTrackApi>(
    () => ({
      step: (direction) => engineRef.current?.step(direction),
      goTo: (index) => engineRef.current?.goTo(index),
    }),
    [],
  );

  return { side: loop ? side : 0, api };
}
