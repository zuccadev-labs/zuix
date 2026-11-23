"use client";
import { useRef, type CSSProperties, type HTMLAttributes, type PointerEvent, type ReactNode, type Ref } from "react";
import { cx } from "../../cx";
import { glowPoint } from "../../core/effects";
import type { EffectTone } from "./BorderBeam";
import { withRef } from "../../react-compat";

export interface GlowProps extends HTMLAttributes<HTMLDivElement> {
  /** Dónde brilla: el borde, la superficie (por debajo del contenido) o ambos. */
  variant?: "border" | "surface" | "both";
  tone?: EffectTone;
  /** Radio del foco de luz en px. */
  size?: number;
  /** Radio del contorno (cualquier valor CSS); por defecto, el de una tarjeta. */
  radius?: string;
  children?: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Brillo que sigue al puntero sobre el borde o la superficie de lo que envuelve. Solo con un puntero que pasa por
 * encima (`hover: hover`); el contenido se ve y se usa igual sin él. Las capas son `aria-hidden` y sin puntero.
 */
export const Glow = withRef(function Glow({
  variant = "border",
  tone = "accent",
  size,
  radius,
  className,
  style,
  children,
  onPointerMove,
  ref,
  ...rest
}: GlowProps) {
  const frame = useRef(0);
  const vars = {
    ...style,
    ...(size ? { "--z-glow-size": `${size}px` } : {}),
    ...(radius ? { "--z-glow-radius": radius } : {}),
  } as CSSProperties;
  const move = (event: PointerEvent<HTMLDivElement>) => {
    onPointerMove?.(event);
    if (event.pointerType === "touch") return;
    const el = event.currentTarget;
    const { clientX, clientY } = event;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const p = glowPoint(el.getBoundingClientRect(), clientX, clientY);
      el.style.setProperty("--z-glow-x", `${p.x}px`);
      el.style.setProperty("--z-glow-y", `${p.y}px`);
    });
  };
  return (
    <div {...rest} ref={ref} className={cx("z-glow", className)} data-variant={variant} data-tone={tone} style={vars} onPointerMove={move}>
      {variant !== "border" ? <span className="z-glow__fill" aria-hidden="true" /> : null}
      {children}
      {variant !== "surface" ? <span className="z-glow__ring" aria-hidden="true" /> : null}
    </div>
  );
});
