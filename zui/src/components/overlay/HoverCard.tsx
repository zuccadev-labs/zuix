"use client";
import type { ReactElement, ReactNode } from "react";
import { InterestLayer } from "../../primitives/interest";

export interface HoverCardProps {
  /** Disparador: normalmente un enlace (un perfil, una incidencia) que hace su propia acción al activarse. */
  trigger: ReactElement;
  /** Vista previa: avatar, nombre, datos, enlaces. */
  children?: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Retardo de apertura con el puntero, en ms (con el foco abre sin esperar). */
  openDelay?: number;
  /** Retardo de cierre, en ms: el puntero puede cruzar a la tarjeta sin que se cierre. */
  closeDelay?: number;
  disabled?: boolean;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  arrow?: boolean;
  /** Ancho de la tarjeta (maquetación). */
  width?: number | string;
  className?: string;
}

/**
 * Vista previa al pasar el puntero o enfocar un enlace. Información que se puede perder: el enlace ya lleva a su
 * destino. La tarjeta describe al enlace (`aria-describedby`); con el foco dentro de ella, Tab sigue por sus enlaces
 * y luego sale hacia lo que sigue al disparador. Escape y una pulsación fuera la cierran.
 */
export function HoverCard({
  trigger,
  children,
  open,
  defaultOpen,
  onOpenChange,
  openDelay = 500,
  closeDelay = 300,
  disabled,
  side = "bottom",
  align = "center",
  sideOffset = 6,
  arrow,
  width,
  className,
}: HoverCardProps) {
  return (
    <InterestLayer
      mode="hover"
      trigger={trigger}
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      openDelay={openDelay}
      closeDelay={closeDelay}
      disabled={disabled}
      placement={align === "center" ? side : `${side}-${align}`}
      gap={sideOffset}
      arrow={arrow}
      width={width}
      className={className ? `z-hovercard ${className}` : "z-hovercard"}
    >
      {children}
    </InterestLayer>
  );
}
