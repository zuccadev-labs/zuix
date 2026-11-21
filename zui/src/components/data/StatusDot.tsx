import type { HTMLAttributes, Ref } from "react";
import { cx } from "../../cx";

export interface StatusDotProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  /** Texto del estado. Siempre presente: visible o, con `hideLabel`, solo para lectores. */
  label: string;
  tone?: "neutral" | "success" | "info" | "warning" | "danger";
  size?: "sm" | "md" | "lg";
  /** Oculta el texto a la vista (sigue en el árbol de accesibilidad). */
  hideLabel?: boolean;
  /** Halo que late (actividad en curso). Sin animación con prefers-reduced-motion. */
  pulse?: boolean;
  ref?: Ref<HTMLSpanElement>;
}

/** Punto de estado con su texto: en línea, conectado, ocupado, caído. El color nunca va solo. */
export function StatusDot({ label, tone = "neutral", size = "md", hideLabel, pulse, className, ...rest }: StatusDotProps) {
  return (
    <span {...rest} className={cx("z-status", className)} data-tone={tone} data-size={size} data-pulse={pulse || undefined}>
      <span className="z-status__dot" aria-hidden="true" />
      <span className={hideLabel ? "z-sr-only" : "z-status__label"}>{label}</span>
    </span>
  );
}
