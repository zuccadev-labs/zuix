import type { HTMLAttributes, Ref } from "react";
import { cx } from "../../cx";
import { withRef } from "../../react-compat";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** `elevated` con sombra, `outlined` solo borde, `filled` fondo hundido. */
  variant?: "elevated" | "outlined" | "filled";
  padding?: "none" | "sm" | "md" | "lg";
  /** Respuesta visual al puntero y al foco; úsese con `onClick`, `role` y `tabIndex` o envolviendo un enlace. */
  interactive?: boolean;
  ref?: Ref<HTMLDivElement>;
}

/** Superficie que agrupa contenido relacionado. */
export const Card = withRef(function Card({ variant = "elevated", padding = "md", interactive, className, children, ...rest }: CardProps) {
  return (
    <div
      {...rest}
      className={cx("z-card", className)}
      data-variant={variant}
      data-padding={padding}
      data-interactive={interactive || undefined}
    >
      {children}
    </div>
  );
});
