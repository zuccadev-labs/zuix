import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from "react";
import { cx } from "../../cx";

export interface ScrollAreaProps extends HTMLAttributes<HTMLDivElement> {
  /** Nombre de la región (obligatorio para el teclado: la región es enfocable). */
  label: string;
  /** Eje de desplazamiento. */
  orientation?: "vertical" | "horizontal" | "both";
  /** Alto máximo (cualquier longitud CSS) en vertical. */
  maxHeight?: string;
  /** Sombras en los bordes con más contenido. */
  shadows?: boolean;
  /** Barra fina (por defecto) o la del sistema. */
  scrollbar?: "thin" | "auto";
  children?: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Región desplazable con nombre y foco (para usarla con el teclado), barra con el color de la suite
 * (`scrollbar-color`, 3:1) y sombras que solo aparecen hacia donde queda contenido. Sin estado ni JavaScript.
 */
export function ScrollArea({
  label,
  orientation = "vertical",
  maxHeight,
  shadows = true,
  scrollbar = "thin",
  className,
  style,
  children,
  ref,
  ...rest
}: ScrollAreaProps) {
  return (
    <div
      role="region"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: una región desplazable debe recibir el foco para moverla con el teclado (WCAG 2.1.1).
      tabIndex={0}
      aria-label={label}
      {...rest}
      ref={ref}
      className={cx("z-scroll-area", className)}
      data-orientation={orientation}
      data-shadows={shadows ? "" : undefined}
      data-scrollbar={scrollbar}
      style={maxHeight ? ({ ...style, "--z-scroll-max": maxHeight } as CSSProperties) : style}
    >
      {children}
    </div>
  );
}
