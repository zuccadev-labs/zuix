"use client";
import type { IconName } from "@zuccadev-labs/zuix-zicon/core";
import type { MenuEntry } from "../overlay/internal";
import { Menu } from "../overlay/Menu";
import { Fab, type FabProps } from "./Fab";

export interface FabMenuProps extends Pick<FabProps, "size" | "variant" | "position" | "extended" | "collapsed"> {
  /** Icono del FAB cerrado. */
  icon: IconName;
  /** Nombre del FAB (y del menú). */
  label: string;
  /** Acciones del menú (con icono). */
  items: MenuEntry[];
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

/**
 * FAB que abre un menú de acciones (FAB menu de Material 3 o Speed Dial): el menú sale por encima, con el patrón de
 * menú de WAI-ARIA (flechas, Escape devuelve el foco al FAB).
 */
export function FabMenu({
  icon,
  label,
  items,
  size,
  variant,
  position,
  extended,
  collapsed,
  open,
  defaultOpen,
  onOpenChange,
  className,
}: FabMenuProps) {
  return (
    <Menu
      trigger={
        <Fab
          icon={icon}
          label={label}
          size={size}
          variant={variant}
          position={position}
          extended={extended}
          collapsed={collapsed}
          className={className}
        />
      }
      items={items}
      label={label}
      side="top"
      align="end"
      size="lg"
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      className="z-fab-menu"
    />
  );
}
