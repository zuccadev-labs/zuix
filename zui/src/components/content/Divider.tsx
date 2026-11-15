import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../../cx";

export interface DividerProps extends HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
  /** Separación a ambos lados. */
  spacing?: "none" | "sm" | "md" | "lg";
  /** `strong` usa la línea de mayor contraste. */
  emphasis?: "subtle" | "strong";
  /** Texto centrado sobre la línea (solo horizontal). */
  children?: ReactNode;
}

/** Línea separadora entre bloques o entre elementos de una barra. */
export function Divider({ orientation = "horizontal", spacing = "none", emphasis = "subtle", className, children, ...rest }: DividerProps) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      {...rest}
      className={cx("z-divider", className)}
      data-orientation={orientation}
      data-spacing={spacing}
      data-emphasis={emphasis}
      data-label={children ? true : undefined}
    >
      {children && orientation === "horizontal" ? <span className="z-divider__label">{children}</span> : null}
    </div>
  );
}
