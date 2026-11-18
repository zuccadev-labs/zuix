"use client";
import { useId, useRef, type CSSProperties, type KeyboardEvent, type ReactElement, type ReactNode } from "react";
import { focusInto, focusQuiet, tabbable, trapTab } from "../../core/focus";
import { cx } from "../../cx";
import { useLayer, usePresence } from "../../primitives/hooks";
import { ModalPopup, Popup, Portal, rectOf } from "../../primitives/popup";
import { useDisclosure } from "./internal";

interface PopoverBaseProps {
  /** Elemento disparador. */
  trigger: ReactElement;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  /** Ancho del panel (maquetación). */
  width?: number | string;
  /**
   * Modal: el panel es un `<dialog>` abierto con `showModal()`. El resto de la página queda inerte (puntero, foco y
   * lectores de pantalla), Tab da la vuelta dentro y una pulsación fuera solo lo cierra.
   */
  modal?: boolean;
  className?: string;
  children?: ReactNode;
}

/** El panel es un `role="dialog"`: necesita nombre accesible, con `label` o con el id de un título suyo en `aria-labelledby`. */
export type PopoverProps = PopoverBaseProps &
  ({ label: string; "aria-labelledby"?: string } | { label?: undefined; "aria-labelledby": string });

/**
 * Panel flotante anclado a su disparador. Escape y una pulsación fuera lo cierran; no modal, también salir con Tab.
 * Con `modal` retiene el foco y deja inerte el resto de la página.
 */
export function Popover({
  trigger: triggerProp,
  open: openProp,
  defaultOpen,
  onOpenChange,
  side = "bottom",
  align = "end",
  sideOffset = 4,
  width,
  label,
  "aria-labelledby": labelledBy,
  modal,
  className,
  children,
}: PopoverProps) {
  const id = useId();
  const { open, setOpen, trigger, triggerRef } = useDisclosure({ open: openProp, defaultOpen, onOpenChange, trigger: triggerProp, id });
  const panel = useRef<HTMLElement | null>(null);
  const setPanel = (node: HTMLElement | null) => {
    panel.current = node;
  };
  const present = usePresence(open, panel);
  const style: CSSProperties | undefined = width === undefined ? undefined : { width };

  const close = (refocus: boolean) => {
    const inside = panel.current?.contains(document.activeElement) ?? false;
    setOpen(false);
    if (refocus && inside) focusQuiet(triggerRef.current);
  };
  useLayer(open, {
    // Modal: lo de debajo es inerte y no se evalúa; la pulsación fuera llega por el velo del <dialog> (onDismiss).
    modal,
    contains: (target) => (panel.current?.contains(target) ?? false) || (triggerRef.current?.contains(target) ?? false),
    onEscape: () => close(true),
    onPointerOutside: modal ? undefined : () => close(false),
    onFocusOutside: modal ? undefined : () => close(false),
  });

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const el = panel.current;
    if (event.key !== "Tab" || !el || !(event.target instanceof Node) || !el.contains(event.target)) return;
    if (modal) {
      if (trapTab(el, event)) event.preventDefault();
      return;
    }
    // No modal: al salir por un extremo el panel se cierra y el foco vuelve al disparador, de donde sigue el tabulador.
    const list = tabbable(el);
    const edge = event.shiftKey ? list[0] : list[list.length - 1];
    if (!list.length || document.activeElement === edge || document.activeElement === el) {
      event.preventDefault();
      close(true);
      focusQuiet(triggerRef.current);
    }
  };

  return (
    <>
      {trigger}
      {present && modal ? (
        <Portal anchor={triggerRef}>
          <ModalPopup
            ref={setPanel}
            id={id}
            open={open}
            anchorRect={() => rectOf(triggerRef.current)}
            watch={triggerRef}
            placement={align === "center" ? side : `${side}-${align}`}
            gap={sideOffset}
            trigger={triggerRef}
            // El foco vuelve al disparador al desmontar (ModalPopup): mientras tanto es inerte.
            onDismiss={() => setOpen(false)}
            aria-modal="true"
            aria-label={label}
            aria-labelledby={label ? undefined : labelledBy}
            tabIndex={-1}
            className={cx("z-liquid z-popover", className)}
            style={style}
            onKeyDown={onKeyDown}
            onShown={focusInto}
          >
            {children}
          </ModalPopup>
        </Portal>
      ) : present ? (
        <Portal anchor={triggerRef}>
          <Popup
            ref={setPanel}
            id={id}
            open={open}
            anchorRect={() => rectOf(triggerRef.current)}
            watch={triggerRef}
            placement={align === "center" ? side : `${side}-${align}`}
            gap={sideOffset}
            role="dialog"
            aria-label={label}
            aria-labelledby={label ? undefined : labelledBy}
            tabIndex={-1}
            className={cx("z-liquid z-popover", className)}
            style={style}
            onKeyDown={onKeyDown}
            onShown={focusInto}
          >
            {children}
          </Popup>
        </Portal>
      ) : null}
    </>
  );
}
