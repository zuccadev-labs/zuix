import type { HTMLAttributes } from "react";
import { cx } from "../../cx";

export interface SpinnerProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  size?: "sm" | "md" | "lg";
  /** `current` hereda el color del texto que lo rodea. */
  tone?: "accent" | "muted" | "current";
  /** Nombre accesible. Vacío ("") lo vuelve decorativo. */
  label?: string;
}

/** Anillo giratorio para esperas de duración desconocida. */
export function Spinner({ size = "md", tone = "accent", label = "Loading", className, ...rest }: SpinnerProps) {
  return <span {...rest} className={cx("z-spinner", className)} data-size={size} data-tone={tone} role={label ? "status" : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true} />;
}
