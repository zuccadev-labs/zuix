import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cx } from "../../cx";

export interface MasonryProps extends HTMLAttributes<HTMLElement> {
  /** Columnas en anchos grandes; bajan solas con el contenedor (mínimo `minColumnWidth`). */
  columns?: number;
  /** Ancho mínimo de columna en px. */
  minColumnWidth?: number;
  gap?: "sm" | "md" | "lg";
  /** Elemento raíz: `div` (por defecto), `ul` u `ol` si los hijos son `li`. */
  as?: "div" | "ul" | "ol";
  children: ReactNode;
}

/**
 * Mampostería: piezas de alto distinto en columnas sin huecos. Usa la disposición nativa por carriles donde el
 * navegador la tiene y columnas CSS donde no; el orden de lectura es el del marcado.
 */
export function Masonry({
  columns = 3,
  minColumnWidth = 220,
  gap = "md",
  as: Tag = "div",
  className,
  style,
  children,
  ...rest
}: MasonryProps) {
  return (
    <Tag
      {...(rest as HTMLAttributes<HTMLElement>)}
      className={cx("z-masonry", className)}
      data-gap={gap}
      style={{ ...style, "--z-masonry-cols": columns, "--z-masonry-min": `${minColumnWidth}px` } as CSSProperties}
    >
      {children}
    </Tag>
  );
}
