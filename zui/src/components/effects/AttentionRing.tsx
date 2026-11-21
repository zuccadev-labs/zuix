"use client";
import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from "react";
import { cx } from "../../cx";
import { useOffscreenRef } from "../../primitives/offscreen";
import type { EffectTone } from "./BorderBeam";

export interface AttentionRingProps extends HTMLAttributes<HTMLSpanElement> {
  /** Muestra el anillo. */
  active?: boolean;
  /** Anillo que se expande o halo que respira. */
  variant?: "ring" | "glow";
  tone?: Exclude<EffectTone, "neutral">;
  /** Pulsos antes de quedarse quieto (por defecto 3, unos 5 s; `Infinity` no para nunca). */
  repeat?: number;
  /** Radio del contorno (cualquier valor CSS); por defecto, el de un control. */
  radius?: string;
  children?: ReactNode;
  ref?: Ref<HTMLSpanElement>;
}

/**
 * Llama la atención sobre un control o un panel (actividad nueva, paso de un recorrido) con un anillo que late
 * unas veces y queda fijo. Es solo visual: el motivo se anuncia aparte (texto, insignia o región viva).
 */
export function AttentionRing({
  active = true,
  variant = "ring",
  tone = "accent",
  repeat = 3,
  radius,
  className,
  style,
  children,
  ref,
  ...rest
}: AttentionRingProps) {
  const own = useOffscreenRef(ref, active);
  const vars = {
    ...style,
    "--z-attention-repeat": Number.isFinite(repeat) ? Math.max(1, Math.round(repeat)) : "infinite",
    ...(radius ? { "--z-attention-radius": radius } : {}),
  } as CSSProperties;
  return (
    <span
      {...rest}
      ref={own}
      className={cx("z-attention", className)}
      data-variant={variant}
      data-tone={tone}
      data-active={active ? "" : undefined}
      style={vars}
    >
      {children}
    </span>
  );
}
