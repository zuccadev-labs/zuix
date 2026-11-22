"use client";
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { trackScrollEdges } from "../../core/edges";
import { cx } from "../../cx";
import { Toolbar } from "../actions/Toolbar";

export interface ActionBarProps {
  /** Visible mientras haya una selección. */
  open: boolean;
  /** Texto del recuento («3 selected»); se anuncia con cortesía cuando cambia. */
  count: ReactNode;
  /** Acciones sobre la selección: botones, un Menu con más. */
  children?: ReactNode;
  /** Nombre accesible de la barra. */
  label?: string;
  /** Vacía la selección: botón de cierre y Escape dentro de la barra. */
  onClose?: () => void;
  closeLabel?: string;
  /**
   * `fixed`: flota abajo en el centro de la ventana. `sticky`: pegada abajo dentro de su contenedor con desplazamiento
   * (una tabla, un diálogo). `inline`: en su sitio.
   */
  position?: "fixed" | "sticky" | "inline";
  className?: string;
}

/**
 * Barra flotante de acciones sobre una selección (filas de una tabla, archivos, tarjetas): el recuento, las acciones y
 * el cierre, en una Toolbar con una sola parada de tabulación. No roba el foco al aparecer.
 */
export function ActionBar({
  open,
  count,
  children,
  label = "Selection actions",
  onClose,
  closeLabel = "Clear selection",
  position = "fixed",
  className,
}: ActionBarProps) {
  // Las acciones desplazan si no caben: el borde con acciones ocultas se difumina.
  const actions = useRef<HTMLSpanElement>(null);
  useEffect(() => (open && actions.current ? trackScrollEdges(actions.current) : undefined), [open]);
  if (!open) return null;
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || event.defaultPrevented || !onClose) return;
    event.preventDefault();
    onClose();
  };
  return (
    <Toolbar label={label} size="sm" className={cx("z-actionbar", className)} data-position={position} onKeyDown={onKeyDown}>
      <span className="z-actionbar__count" aria-live="polite" aria-atomic="true">
        {count}
      </span>
      <span role="separator" aria-orientation="vertical" className="z-toolbar__separator" />
      <span ref={actions} className="z-actionbar__actions">
        {children}
      </span>
      {onClose ? (
        <button type="button" className="z-actionbar__close" aria-label={closeLabel} title={closeLabel} onClick={onClose}>
          <Icon name="x-mark" size={14} />
        </button>
      ) : null}
    </Toolbar>
  );
}
