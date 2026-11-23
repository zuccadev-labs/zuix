"use client";
import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from "react";
import { cx } from "../../cx";
import { useOffscreenRef } from "../../primitives/offscreen";
import { withRef } from "../../react-compat";

export type BackdropPattern = "grid" | "dots" | "hex" | "mesh";

export interface BackdropProps extends HTMLAttributes<HTMLDivElement> {
  /** Dibujo del fondo: rejilla, puntos, hexágonos o degradado de malla. */
  pattern?: BackdropPattern;
  /** Cuánto se nota el dibujo. Ninguna intensidad toca el color del texto que va encima. */
  intensity?: "subtle" | "medium" | "strong";
  /** Desvanecido hacia los bordes: elipse centrada, hacia abajo o ninguno. */
  fade?: "radial" | "bottom" | "none";
  /** Deriva lenta del dibujo (solo sin movimiento reducido; en pausa fuera de pantalla). */
  animated?: boolean;
  /** Lado de la celda en px (rejilla, puntos y hexágonos). */
  cell?: number;
  children?: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Fondo decorativo en CSS detrás del contenido: rejilla, puntos, hexágonos o malla de color. La capa es
 * `aria-hidden` y no recibe el puntero; el contenido va encima, en su propia capa.
 */
export const Backdrop = withRef(function Backdrop({
  pattern = "grid",
  intensity = "medium",
  fade = "radial",
  animated,
  cell,
  className,
  style,
  children,
  ref,
  ...rest
}: BackdropProps) {
  const own = useOffscreenRef(ref, Boolean(animated));
  const vars = cell ? ({ ...style, "--z-backdrop-cell": `${cell}px` } as CSSProperties) : style;
  return (
    <div
      {...rest}
      ref={own}
      className={cx("z-backdrop", className)}
      data-pattern={pattern}
      data-intensity={intensity}
      data-fade={fade}
      data-animated={animated ? "" : undefined}
      style={vars}
    >
      <div className="z-backdrop__layer" aria-hidden="true" />
      <div className="z-backdrop__content">{children}</div>
    </div>
  );
});
