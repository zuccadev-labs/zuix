"use client";
import { useEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactElement } from "react";
import { createLongPress } from "../../core/long-press";
import { useControllable, useLatest } from "../../primitives/hooks";
import { MenuSurface } from "../../primitives/menu";
import { slot } from "../../primitives/slot";
import type { MenuEntry } from "./internal";

export interface ContextMenuProps {
  /** Zona que abre el menú con clic derecho o pulsación larga. */
  children: ReactElement;
  items: MenuEntry[];
  /** Nombre accesible del menú. */
  label?: string;
  size?: "md" | "lg";
  disabled?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

/** Menú contextual: se abre en el punto del clic derecho, de la tecla de menú o de una pulsación larga (600 ms) con dedo o lápiz. */
export function ContextMenu({ children, items, label, size = "md", disabled, onOpenChange, className }: ContextMenuProps) {
  const zone = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useControllable<boolean>(undefined, false, onOpenChange);
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const [byKeyboard, setByKeyboard] = useState(false);
  const show = useLatest((at: { x: number; y: number }, keyboard = false) => {
    setPoint(at);
    setByKeyboard(keyboard);
    setOpen(true);
  });
  // iOS no emite `contextmenu`, y un Chromium de escritorio con pantalla táctil tampoco.
  const [press] = useState(() =>
    createLongPress((at) => {
      show.current(at);
      // El clic que el navegador pueda emitir al levantar el dedo no debe elegir la entrada que quedó debajo.
      const lift = new AbortController();
      const swallow = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
      };
      const release = () => setTimeout(() => lift.abort(), 50);
      window.addEventListener("click", swallow, { capture: true, signal: lift.signal });
      window.addEventListener("pointerup", release, { capture: true, signal: lift.signal });
      window.addEventListener("pointercancel", release, { capture: true, signal: lift.signal });
    }),
  );
  useEffect(() => () => press.cancel(), [press]);

  const zoneProps = disabled
    ? { ref: zone }
    : {
        ref: zone,
        "data-state": open ? "open" : "closed",
        onContextMenu: (event: MouseEvent) => {
          event.preventDefault();
          // Con el dedo ya lo abre (o lo va a abrir) la pulsación larga: Android emite además `contextmenu`.
          if (press.pending() || press.sinceFired() < 1000) return;
          // Tecla de menú o Mayús+F10: sin puntero, el menú sale en el centro de la zona.
          const box = event.currentTarget.getBoundingClientRect();
          const keyboard = event.clientX === 0 && event.clientY === 0;
          show.current(
            keyboard ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : { x: event.clientX, y: event.clientY },
            keyboard,
          );
        },
        onPointerDown: (event: PointerEvent) => press.down(event.nativeEvent),
        onPointerMove: (event: PointerEvent) => press.move(event.nativeEvent),
        onPointerUp: () => press.cancel(),
        onPointerCancel: () => press.cancel(),
      };

  return (
    <>
      {slot(children, zoneProps)}
      <MenuSurface
        open={open && !disabled}
        onClose={() => setOpen(false)}
        items={items}
        size={size}
        anchor={zone}
        point={point}
        focusFirst={byKeyboard}
        placement="bottom-start"
        gap={0}
        label={label}
        className={className}
      />
    </>
  );
}
