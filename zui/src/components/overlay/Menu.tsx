"use client";
import { useId, useRef, type KeyboardEvent, type MouseEvent, type ReactElement } from "react";
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
export function Menu({ trigger: triggerProp, items, label, size = "md", side = "bottom", align = "end", open: openProp, defaultOpen, onOpenChange, className }: MenuProps) {
  const id = useId();
  const triggerId = `${id}-trigger`;
  const { open, setOpen, trigger, triggerRef } = useDisclosure({ open: openProp, defaultOpen, onOpenChange, trigger: triggerProp, popup: "menu", id });
  // Cómo se abrió: con el teclado (Intro, Espacio o flechas) el foco va a la primera entrada.
  const byKeyboard = useRef(false);
  const withKeys = slot(trigger!, {
    id: (triggerProp.props as { id?: string }).id ?? triggerId,
    // Antes que el clic del disparador (captura): un clic sin puntero (detail 0) viene del teclado.
    onClickCapture: (event: MouseEvent) => {
      byKeyboard.current = event.detail === 0;
    },
    onKeyDown: (event: KeyboardEvent) => {
      if (open || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
      event.preventDefault();
      byKeyboard.current = true;
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
        focusFirst={byKeyboard.current}
        placement={align === "center" ? side : `${side}-${align}`}
        label={label}
        labelledBy={(triggerProp.props as { id?: string }).id ?? triggerId}
        className={className}
      />
    </>
  );
}
