import type { ReactNode } from "react";
import { cx } from "../cx";

export interface TitleBarProps {
  /** Logo, a la izquierda. */
  brand?: ReactNode;
  /** Contenido central: pestañas, título o buscador. */
  children?: ReactNode;
  /** Acciones a la derecha. */
  actions?: ReactNode;
  /** Botones de ventana (minimizar, maximizar, cerrar); los aporta la aplicación. */
  windowControls?: ReactNode;
  /**
   * Elemento raíz. `header` (por defecto) es la cabecera de la aplicación: fuera de `main`, `section` o
   * `article` el navegador la expone como región `banner`. `div` para una barra que no lo es (un Shell
   * anidado, una segunda ventana en la misma página).
   */
  as?: "header" | "div";
  className?: string;
}

/**
 * Barra de título para ventanas sin marco. Transparente sobre el fondo de la aplicación.
 * La zona de arrastre de la ventana la marca la aplicación (p. ej. `data-tauri-drag-region`) en `className` o en sus hijos.
 * Origen: barra de título de zutool.
 */
export function TitleBar({ brand, children, actions, windowControls, as: Tag = "header", className }: TitleBarProps) {
  return (
    <Tag className={cx("z-titlebar", className)}>
      {brand ? <div className="z-titlebar__brand">{brand}</div> : null}
      <div className="z-titlebar__center">{children}</div>
      {actions ? <div className="z-titlebar__actions">{actions}</div> : null}
      {windowControls ? <div className="z-titlebar__window">{windowControls}</div> : null}
    </Tag>
  );
}
