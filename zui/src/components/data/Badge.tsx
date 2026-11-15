import type { HTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";
import type { Tone } from "../actions/types";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  /** `soft` fondo tenue, `solid` fondo pleno, `outline` solo borde. */
  variant?: "soft" | "solid" | "outline";
  size?: "sm" | "md";
  /** Punto de estado antes del texto. */
  dot?: boolean;
  icon?: IconName;
  children?: ReactNode;
}

/** Etiqueta de estado o categoría, no interactiva. */
export function Badge({ tone = "neutral", variant = "soft", size = "md", dot, icon, className, children, ...rest }: BadgeProps) {
  return (
    <span {...rest} className={cx("z-badge", className)} data-tone={tone} data-variant={variant} data-size={size}>
      {dot ? <span className="z-badge__dot" aria-hidden="true" /> : null}
      {icon ? <Icon name={icon} size={size === "sm" ? 10 : 12} /> : null}
      {children}
    </span>
  );
}
