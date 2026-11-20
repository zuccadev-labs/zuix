import type { CSSProperties, ReactNode } from "react";
import { cx } from "../cx";

export type FloatPlacement =
  | "top-start"
  | "top-center"
  | "top-end"
  | "middle-start"
  | "middle-end"
  | "bottom-start"
  | "bottom-center"
  | "bottom-end";

export interface FloatProps {
  /** Elemento al que se ancla (avatar, icono, botón). */
  children: ReactNode;
  /** Lo que flota sobre la esquina (insignia, punto, contador). */
  content: ReactNode;
  /** Esquina o borde, en lógicas: `start` es la izquierda en LTR y la derecha en RTL. */
  placement?: FloatPlacement;
  /** Desplazamiento hacia dentro (CSS: `4px`, `14%`), para anclar sobre una forma circular. */
  offset?: string | number;
  className?: string;
}

/**
 * Pone un elemento sobre una esquina o un borde de otro, centrado en el canto (la mitad dentro, la mitad fuera).
 * Solo CSS y propiedades lógicas: sirve igual en RTL. Referencia de variantes: Float de Shark UI.
 */
export function Float({ children, content, placement = "top-end", offset, className }: FloatProps) {
  const style =
    offset === undefined ? undefined : ({ "--z-float-offset": typeof offset === "number" ? `${offset}px` : offset } as CSSProperties);
  return (
    <span className={cx("z-float", className)} data-placement={placement} style={style}>
      {children}
      <span className="z-float__item">{content}</span>
    </span>
  );
}
