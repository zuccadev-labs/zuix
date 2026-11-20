"use client";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { InterestLayer } from "../../primitives/interest";

export interface ToggletipProps {
  /** Nombre del botón: dice qué muestra («More about shipping»). Un «?» o una «i» no son un nombre. */
  label: string;
  /** Contenido: una explicación corta, que puede llevar un enlace. */
  children?: ReactNode;
  icon?: IconName;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Retardo de apertura al pasar el puntero, en ms. El clic abre al momento y la deja fija. */
  openDelay?: number;
  closeDelay?: number;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  arrow?: boolean;
  size?: "sm" | "md";
  width?: number | string;
  className?: string;
}

/**
 * Botón de ayuda («i» o «?») que muestra una explicación: al pasar el puntero o enfocarlo se asoma, y el clic, Intro o
 * Espacio la dejan fija hasta otro clic, Escape o una pulsación fuera. El botón lleva aria-expanded y la burbuja es
 * role=tooltip; con el foco dentro, Tab recorre sus enlaces y sale hacia lo que sigue al botón.
 */
export function Toggletip({
  label,
  children,
  icon = "information-circle",
  open,
  defaultOpen,
  onOpenChange,
  openDelay = 300,
  closeDelay = 200,
  side = "top",
  align = "center",
  sideOffset = 6,
  arrow = true,
  size = "md",
  width,
  className,
}: ToggletipProps) {
  return (
    <InterestLayer
      mode="toggle"
      trigger={
        <button type="button" className="z-toggletip__trigger" data-size={size} aria-label={label}>
          <Icon name={icon} size={size === "sm" ? 14 : 16} />
        </button>
      }
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      openDelay={openDelay}
      closeDelay={closeDelay}
      placement={align === "center" ? side : `${side}-${align}`}
      gap={sideOffset}
      arrow={arrow}
      width={width}
      className={className ? `z-toggletip ${className}` : "z-toggletip"}
    >
      {children}
    </InterestLayer>
  );
}
