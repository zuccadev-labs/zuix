"use client";
import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from "react";
import { cx } from "../../cx";
import { useOffscreenRef } from "../../primitives/offscreen";
import { withRef } from "../../react-compat";

export type EffectTone = "accent" | "info" | "success" | "warning" | "danger" | "neutral";

export interface BorderBeamProps extends HTMLAttributes<HTMLDivElement> {
  /** Segundos por vuelta. */
  duration?: number;
  /** Largo del haz, en porcentaje del contorno (5–50). */
  length?: number;
  /** Grosor del borde en px. */
  width?: 1 | 2;
  tone?: EffectTone;
  /** Gira en sentido contrario. */
  reverse?: boolean;
  /** Detiene el haz donde está. */
  paused?: boolean;
  /** Radio del contorno (cualquier valor CSS); por defecto, el de una tarjeta. */
  radius?: string;
  children?: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Haz de luz que recorre el borde de lo que envuelve. Un anillo enmascarado (`aria-hidden`, sin puntero) gira un
 * degradado cónico con `transform` en el compositor. Quieto con movimiento reducido y en pausa fuera de pantalla.
 */
export const BorderBeam = withRef(function BorderBeam({
  duration = 6,
  length = 18,
  width = 1,
  tone = "accent",
  reverse,
  paused,
  radius,
  className,
  style,
  children,
  ref,
  ...rest
}: BorderBeamProps) {
  const own = useOffscreenRef(ref);
  const vars = {
    ...style,
    "--z-beam-duration": `${duration}s`,
    "--z-beam-length": `${Math.min(50, Math.max(5, length))}%`,
    "--z-beam-width": `${width}px`,
    ...(radius ? { "--z-beam-radius": radius } : {}),
  } as CSSProperties;
  return (
    <div
      {...rest}
      ref={own}
      className={cx("z-beam", className)}
      data-tone={tone}
      data-reverse={reverse ? "" : undefined}
      data-paused={paused ? "" : undefined}
      style={vars}
    >
      {children}
      <span className="z-beam__ring" aria-hidden="true" />
    </div>
  );
});
