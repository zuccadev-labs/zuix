"use client";
import type { CSSProperties, HTMLAttributes, Ref } from "react";
import { cx } from "../../cx";
import { dotDuration, dotGrid, dotMatrixCells, dotMotion, dotValue, type DotPattern } from "../../core/dotmatrix";
import { useOffscreenRef } from "../../primitives/offscreen";
import { withRef } from "../../react-compat";

export interface DotMatrixProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  /** Patrón de movimiento. */
  pattern?: DotPattern;
  /** Columnas de la rejilla (2–16). */
  cols?: number;
  /** Filas de la rejilla (2–16; por defecto, tantas como columnas). */
  rows?: number;
  /** Tamaño de cada punto. */
  size?: "sm" | "md" | "lg";
  /** `current` hereda el color del texto. */
  tone?: "accent" | "muted" | "current";
  /** Segundos por ciclo (cada patrón tiene el suyo por defecto). */
  duration?: number;
  /** Sobre una baldosa de cristal. */
  framed?: boolean;
  /** Detiene el movimiento en el fotograma actual. */
  paused?: boolean;
  /** Nombre accesible. Vacío ("") lo vuelve decorativo. */
  label?: string;
  ref?: Ref<HTMLSpanElement>;
}

/**
 * Cargador de rejilla de puntos: cada patrón desfasa en el tiempo una misma animación de opacidad y escala (CSS,
 * en el compositor). Quieto con movimiento reducido (un fotograma del patrón) y en pausa fuera de pantalla.
 */
export const DotMatrix = withRef(function DotMatrix({
  pattern = "wave",
  cols,
  rows,
  size = "md",
  tone = "accent",
  duration,
  framed,
  paused,
  label = "Loading",
  className,
  style,
  ref,
  ...rest
}: DotMatrixProps) {
  const grid = dotGrid(cols, rows);
  const cells = dotMatrixCells(pattern, grid.cols, grid.rows);
  const own = useOffscreenRef(ref);
  const vars = {
    ...style,
    "--z-dotmatrix-cols": grid.cols,
    "--z-dotmatrix-rows": grid.rows,
    "--z-dotmatrix-duration": `${duration ?? dotDuration(pattern)}s`,
  } as CSSProperties;
  return (
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-label solo se emite junto a role="status"; sin etiqueta la rejilla es decorativa y va con aria-hidden.
    <span
      {...rest}
      ref={own}
      className={cx("z-dotmatrix", className)}
      data-pattern={pattern}
      data-motion={dotMotion(pattern)}
      data-size={size}
      data-tone={tone}
      data-framed={framed ? "" : undefined}
      data-paused={paused ? "" : undefined}
      role={label ? "status" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      style={vars}
    >
      {cells.map((c, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: la rejilla es fija; cada punto es su posición.
          key={i}
          className="z-dotmatrix__dot"
          data-off={c.off ? "" : undefined}
          style={{ "--z-dot-phase": dotValue(c.phase), "--z-dot-rest": dotValue(c.rest) } as CSSProperties}
        />
      ))}
    </span>
  );
});
