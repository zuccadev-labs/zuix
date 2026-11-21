import type { HTMLAttributes, ReactNode, Ref } from "react";
import { cx } from "../../cx";

export interface ProseProps extends HTMLAttributes<HTMLElement> {
  /** Elemento raíz. */
  as?: "div" | "article" | "section" | "main";
  /** Tamaño de lectura. */
  size?: "sm" | "md" | "lg";
  children?: ReactNode;
  ref?: Ref<HTMLElement>;
}

/** Tipografía de contenido largo (`.z-prose`): títulos, párrafos, listas, citas, código, tablas y medios con el ritmo
 *  de lectura de la suite. Un bloque con `.z-not-prose` queda fuera. Sin estado. */
export function Prose({ as: Tag = "div", size = "md", className, children, ref, ...rest }: ProseProps) {
  return (
    <Tag {...rest} ref={ref as Ref<HTMLDivElement>} className={cx("z-prose", className)} data-size={size}>
      {children}
    </Tag>
  );
}
