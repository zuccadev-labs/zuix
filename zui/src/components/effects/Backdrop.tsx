"use client";
import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from "react";
import { cx } from "../../cx";
import { patternVars, type PatternName } from "../../core/pattern";
import { useOffscreenRef } from "../../primitives/offscreen";
import { withRef } from "../../react-compat";

export type BackdropPattern = PatternName;

export interface BackdropProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Dibujo del fondo: rejilla, puntos, hexágonos, malla de color, o un patrón generado con semilla (`stars`,
   * `triangles`, `plus`, `pixels`, `contours`, `grain`, `halftone`).
   */
  pattern?: BackdropPattern;
  /** Semilla del dibujo: la misma da siempre el mismo (malla y patrones generados). Sin ella, el de la hoja. */
  seed?: number | string;
  /** Color del dibujo: el texto (`neutral`, por defecto), un tono de la marca o `media` (claro, sobre una portada oscura). */
  tone?: "neutral" | "accent" | "info" | "success" | "warning" | "danger" | "media";
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
 * Fondo decorativo en CSS detrás del contenido: rejilla, puntos, hexágonos, malla de color o un patrón con semilla
 * (estrellas, triángulos, cruces, píxeles, curvas de nivel, grano y semitono). La capa es
 * `aria-hidden` y no recibe el puntero; el contenido va encima, en su propia capa.
 */
export const Backdrop = withRef(function Backdrop({
  pattern = "grid",
  intensity = "medium",
  fade = "radial",
  animated,
  cell,
  seed,
  tone,
  className,
  style,
  children,
  ref,
  ...rest
}: BackdropProps) {
  const own = useOffscreenRef(ref, Boolean(animated));
  const vars = {
    ...(seed !== undefined ? patternVars(pattern, seed) : {}),
    ...(cell ? { "--z-backdrop-cell": `${cell}px` } : {}),
    ...style,
  } as CSSProperties;
  return (
    <div
      {...rest}
      ref={own}
      className={cx("z-backdrop", className)}
      data-pattern={pattern}
      data-intensity={intensity}
      data-fade={fade}
      data-tone={tone && tone !== "neutral" ? tone : undefined}
      data-seed={seed === undefined ? undefined : String(seed)}
      data-animated={animated ? "" : undefined}
      style={vars}
    >
      <div className="z-backdrop__layer" aria-hidden="true" />
      <div className="z-backdrop__content">{children}</div>
    </div>
  );
});
