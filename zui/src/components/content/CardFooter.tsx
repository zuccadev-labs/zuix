import type { HTMLAttributes } from "react";
import { cx } from "../../cx";

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  /** Alineación de las acciones. */
  align?: "start" | "end" | "between";
}

/** Pie de una `Card` con sus acciones. */
export function CardFooter({ align = "end", className, children, ...rest }: CardFooterProps) {
  return (
    <div {...rest} className={cx("z-card__footer", className)} data-align={align}>
      {children}
    </div>
  );
}
