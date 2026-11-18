"use client";
import { useId, type KeyboardEvent, type ReactElement } from "react";
import { MenuSurface } from "../../primitives/menu";
import { slot } from "../../primitives/slot";
import { useDisclosure, type MenuEntry } from "./internal";

export interface MenuProps {
  /** Elemento disparador (un botón). */
  trigger: ReactElement;
  items: MenuEntry[];
  /** Nombre accesible del menú; por defecto, el del disparador. */
  label?: string;
  size?: "md" | "lg";
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

/** Menú desplegable (patrón APG «menu button»): el disparador lo abre con clic, Intro, Espacio o las flechas. */
export function Menu({
  trigger: triggerProp,
  items,
  label,
  size = "md",
  side = "bottom",
  align = "end",
  open: openProp,
  defaultOpen,
  onOpenChange,
  className,
}: MenuProps) {
  const id = useId();
  const triggerId = `${id}-trigger`;
  const { open, setOpen, trigger, triggerRef } = useDisclosure({
    open: openProp,
    defaultOpen,
    onOpenChange,
    trigger: triggerProp,
    popup: "menu",
    id,
  });
  const withKeys = slot(trigger!, {
    id: (triggerProp.props as { id?: string }).id ?? triggerId,
    onKeyDown: (event: KeyboardEvent) => {
      if (open || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
      event.preventDefault();
      setOpen(true);
    },
  });
  return (
    <>
      {withKeys}
      <MenuSurface
        id={id}
        open={open}
        onClose={() => setOpen(false)}
        items={items}
        size={size}
        anchor={triggerRef}
        anchorIsTrigger
        placement={align === "center" ? side : `${side}-${align}`}
        label={label}
        labelledBy={(triggerProp.props as { id?: string }).id ?? triggerId}
        className={className}
      />
    </>
  );
}
