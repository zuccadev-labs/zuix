"use client";
import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { cx } from "../cx";
import { RESIZE_MAX, RESIZE_MIN, RESIZE_STEP, clamp as clampTo, isHorizontal, physicalSide, resizeByKey, resizeSign, type ResizeSide } from "../logic";

export interface ResizeHandleProps {
  /**
   * Borde del panel donde se coloca el tirador. `start` y `end` son lógicos (siguen la dirección de escritura:
   * en RTL `end` es el borde izquierdo); `left`, `right`, `top` y `bottom` son físicos.
   */
  side: ResizeSide;
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
  /** Id del panel que redimensiona (`aria-controls`). */
  controls?: string;
  className?: string;
}

const isRtl = (el: Element) => getComputedStyle(el).direction === "rtl";

/** Tirador para redimensionar un panel. Funciona con puntero y con teclado. */
export function ResizeHandle({ side, size, onResize, min = RESIZE_MIN, max = RESIZE_MAX, defaultSize, step = RESIZE_STEP, label = "Resize panel", controls, className }: ResizeHandleProps) {
  const start = useRef<{ pos: number; size: number; sign: number } | null>(null);
  const horizontal = isHorizontal(side);
  const clamp = (v: number) => clampTo(v, min, max);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    // Solo el botón principal (o un dedo, o el lápiz): el secundario abre el menú contextual, no arrastra.
    if (e.button !== 0) return;
    start.current = { pos: horizontal ? e.clientX : e.clientY, size, sign: resizeSign(physicalSide(side, isRtl(e.currentTarget))) };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* puntero ya liberado */ }
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const delta = (horizontal ? e.clientX : e.clientY) - start.current.pos;
    onResize(clamp(start.current.size + start.current.sign * delta));
  };
  const onPointerUp = () => { start.current = null; };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = resizeByKey(e.key, physicalSide(side, isRtl(e.currentTarget)), size, { min, max, step, defaultSize });
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
      aria-controls={controls}
      aria-valuenow={Math.round(size)}
      aria-valuemin={min}
      aria-valuemax={max}
      className={cx("z-resize", className)}
      data-side={side}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onLostPointerCapture={onPointerUp}
      // WebKit puede iniciar un arrastrar y soltar nativo desde el tirador, que cancela los eventos de puntero.
      onDragStart={(e) => e.preventDefault()}
      onDoubleClick={defaultSize !== undefined ? () => onResize(clamp(defaultSize)) : undefined}
      onKeyDown={onKeyDown}
    />
  );
}
