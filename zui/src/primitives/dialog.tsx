"use client";
// Diálogo modal sobre `<dialog>` + `showModal()`: capa superior, velo (`::backdrop`), inercia del resto de la página
// y trampa de foco nativos. Lo usan Modal, Drawer, ConfirmDialog y CommandPalette. Mismo marcado que el contrato HTML.
import { useRef, type ComponentProps, type KeyboardEvent, type MouseEvent, type Ref, type RefObject } from "react";
import { createPortal } from "react-dom";
import { activeElement, focusQuiet, trapTab } from "../core/focus";
import { notePress, pressedOnBackdrop } from "../core/layers";
import { lockScroll } from "../core/scroll-lock";
import { useMergedRef } from "../refs";
import { useIsoLayoutEffect, useLatest, useLayer, usePresence } from "./hooks";

export type DismissReason = "escape" | "backdrop";

export interface DialogSurfaceProps extends Omit<ComponentProps<"dialog">, "open" | "onClose"> {
  open: boolean;
  /** Petición de cierre: Escape (o el gesto atrás del sistema) y clic en el velo. */
  onDismiss: (reason: DismissReason) => void;
  /** Escape cierra. Con false la tecla no hace nada. */
  closeOnEscape?: boolean;
  /** El clic en el velo cierra. */
  closeOnBackdrop?: boolean;
  /** Elemento que recibe el foco al abrir; por defecto, el primero enfocable (lo elige el navegador). */
  initialFocus?: (dialog: HTMLDialogElement) => HTMLElement | null | undefined;
  /** Disparador: recibe el foco al cerrar. Sin él, lo recibe el elemento que lo tenía al abrir. */
  trigger?: RefObject<HTMLElement | null>;
  ref?: Ref<HTMLDialogElement>;
}

export function DialogSurface({
  open,
  onDismiss,
  closeOnEscape = true,
  closeOnBackdrop = true,
  initialFocus,
  trigger,
  ref,
  children,
  onClick,
  onMouseDown,
  onKeyDown,
  ...rest
}: DialogSurfaceProps) {
  const node = useRef<HTMLDialogElement | null>(null);
  const setRef = useMergedRef(node, ref);
  const present = usePresence(open, node);
  const latest = useLatest({ onDismiss, closeOnEscape, initialFocus });

  useLayer(present, {
    modal: true,
    contains: (target) => node.current?.contains(target) ?? false,
    // Con `closeOnEscape` false la tecla se consume igual: el navegador no debe cerrar el diálogo por su cuenta.
    onEscape: () => {
      if (latest.current.closeOnEscape && open) latest.current.onDismiss("escape");
    },
  });

  useIsoLayoutEffect(() => {
    const dialog = node.current;
    if (!present || !dialog) return;
    const previous = activeElement();
    if (!dialog.open) dialog.showModal();
    focusQuiet(latest.current.initialFocus?.(dialog));
    const unlock = lockScroll();
    // Cierre pedido por el sistema (gesto atrás) o un Escape que no pasó por la pila de capas.
    const onCancel = (event: Event) => {
      event.preventDefault();
      if (latest.current.closeOnEscape) latest.current.onDismiss("escape");
    };
    dialog.addEventListener("cancel", onCancel);
    return () => {
      dialog.removeEventListener("cancel", onCancel);
      unlock();
      const inside = dialog.contains(document.activeElement) || !activeElement();
      if (dialog.open) dialog.close();
      // El foco vuelve al disparador o a donde estaba; Safari no enfoca un botón al pulsarlo, así que no basta
      // con lo que recuerda el propio <dialog>.
      if (inside || !activeElement()) focusQuiet(trigger?.current ?? previous);
    };
  }, [present, latest, trigger]);

  if (!present || typeof document === "undefined") return null;
  const handleClick = (event: MouseEvent<HTMLDialogElement>) => {
    onClick?.(event);
    if (!event.defaultPrevented && closeOnBackdrop && open && pressedOnBackdrop(event.currentTarget, event.nativeEvent))
      onDismiss("backdrop");
  };
  const handleMouseDown = (event: MouseEvent<HTMLDialogElement>) => {
    onMouseDown?.(event);
    // Pulsar en el velo no se lleva el foco de dentro del diálogo.
    if (event.target === event.currentTarget) event.preventDefault();
  };
  // El navegador deja salir el foco del <dialog> hacia su propia interfaz: aquí Tab da la vuelta dentro del diálogo.
  const handleKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    onKeyDown?.(event);
    // Un diálogo anidado en el árbol de React (no en el DOM) lleva su propia trampa.
    if (event.defaultPrevented || !(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
    if (trapTab(event.currentTarget, event)) event.preventDefault();
  };
  return createPortal(
    <dialog
      {...rest}
      ref={setRef}
      data-state={open ? "open" : "closed"}
      onPointerDownCapture={(event) => notePress(event.nativeEvent)}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
    >
      {children}
    </dialog>,
    document.body,
  );
}
