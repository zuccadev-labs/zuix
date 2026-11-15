"use client";
import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { cx } from "../cx";
import { RESIZE_MAX, RESIZE_MIN, RESIZE_STEP, clamp as clampTo, isHorizontal, resizeByKey, resizeSign } from "../logic";

export interface ResizeHandleProps {
  /** Borde del panel donde se coloca el tirador. */
  side: "left" | "right" | "top" | "bottom";
  /** Tamaño actual del panel en px. */
  size: number;
  onResize: (size: number) => void;
  min?: number;
  max?: number;
  /** Tamaño al que vuelve con doble clic o con la tecla Inicio. */
  defaultSize?: number;
  /** Paso en px de las flechas del teclado. */
  step?: number;
  label?: string;
  className?: string;
}

/** Tirador para redimensionar un panel. Funciona con puntero y con teclado. */
export function ResizeHandle({ side, size, onResize, min = RESIZE_MIN, max = RESIZE_MAX, defaultSize, step = RESIZE_STEP, label = "Resize panel", className }: ResizeHandleProps) {
  const start = useRef<{ pos: number; size: number } | null>(null);
  const horizontal = isHorizontal(side);
  const clamp = (v: number) => clampTo(v, min, max);
  const sign = resizeSign(side);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    start.current = { pos: horizontal ? e.clientX : e.clientY, size };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const delta = (horizontal ? e.clientX : e.clientY) - start.current.pos;
    onResize(clamp(start.current.size + sign * delta));
  };
  const onPointerUp = () => { start.current = null; };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = resizeByKey(e.key, side, size, { min, max, step, defaultSize });
    if (next === undefined) return;
    onResize(next);
    e.preventDefault();
  };

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation={horizontal ? "vertical" : "horizontal"}
      aria-label={label}
      aria-valuenow={Math.round(size)}
      aria-valuemin={min}
      aria-valuemax={max}
      className={cx("z-resize", className)}
      data-side={side}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      // WebKit puede iniciar un arrastrar y soltar nativo desde el tirador, que cancela los eventos de puntero.
      onDragStart={(e) => e.preventDefault()}
      onDoubleClick={defaultSize !== undefined ? () => onResize(clamp(defaultSize)) : undefined}
      onKeyDown={onKeyDown}
    />
  );
}
