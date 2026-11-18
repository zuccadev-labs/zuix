"use client";
// Capa flotante anclada: un elemento `popover="manual"` (capa superior del navegador, por encima de cualquier
// `<dialog>` y sin z-index) colocado con core/place. La usan Popover, Tooltip, Menu, Select, Combobox y DatePicker.
// `ModalPopup` es la misma capa anclada sobre `<dialog>` + `showModal()`, para el Popover modal: el resto de la página
// queda inerte de verdad (puntero, foco y lectores de pantalla), que es lo que promete `aria-modal`.
import { useRef, useState, type ComponentProps, type ReactNode, type Ref, type RefObject } from "react";
import { createPortal } from "react-dom";
import { activeElement, focusQuiet } from "../core/focus";
import { notePress, pressedOnBackdrop } from "../core/layers";
import { place, type Box, type Placement } from "../core/place";
import { lockScroll } from "../core/scroll-lock";
import { useMergedRef } from "../refs";
import { useIsoLayoutEffect, useLatest } from "./hooks";

/** Dónde se monta una capa: en el `<dialog>` modal que contiene a su ancla (fuera de él quedaría inerte) o en `<body>`. */
export const portalHost = (anchor: Element | null | undefined): HTMLElement => anchor?.closest("dialog") ?? document.body;

export interface PortalProps {
  /** Elemento del que cuelga la capa (su disparador). */
  anchor?: RefObject<Element | null>;
  children?: ReactNode;
}

/** Monta `children` fuera del árbol, tras el primer render en cliente (en el servidor no pinta nada). */
export function Portal({ anchor, children }: PortalProps) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useIsoLayoutEffect(() => {
    setHost(portalHost(anchor?.current));
  }, [anchor]);
  return host ? createPortal(children, host) : null;
}

export interface PopupProps extends ComponentProps<"div"> {
  /** `data-state`: `open`, o `closed` durante la animación de salida. */
  open: boolean;
  /** Rectángulo del ancla en la ventana; null si ya no existe. */
  anchorRect: () => Box | null;
  placement: Placement;
  gap?: number;
  /** Elementos cuyo cambio de tamaño obliga a recolocar (el ancla). */
  watch?: RefObject<Element | null>;
  /** Escribe `--z-anchor-width` con el ancho del ancla (ancho mínimo de una lista). */
  anchorWidth?: boolean;
  /** Se llama una vez, con la capa ya visible y colocada: el momento de llevarle el foco. */
  onShown?: (el: HTMLDivElement) => void;
  ref?: Ref<HTMLDivElement>;
}

interface Anchoring {
  anchorRect: () => Box | null;
  placement: Placement;
  gap: number;
  anchorWidth?: boolean;
}

/** Coloca `el` junto a su ancla y lo recoloca cuando la página se desplaza o algo cambia de tamaño. Devuelve la limpieza. */
function anchorTo(el: HTMLElement, latest: RefObject<Anchoring>, watch?: RefObject<Element | null>): () => void {
  const position = () => {
    const rect = latest.current.anchorRect();
    if (!rect || !el.isConnected) return;
    if (latest.current.anchorWidth) el.style.setProperty("--z-anchor-width", `${rect.width}px`);
    place(el, rect, latest.current.placement, latest.current.gap);
  };
  position();
  const wiring = new AbortController();
  const follow = (event: Event) => {
    // El desplazamiento dentro de la propia capa (una lista larga) no la mueve.
    if (event.target instanceof Node && el.contains(event.target)) return;
    position();
  };
  document.addEventListener("scroll", follow, { capture: true, passive: true, signal: wiring.signal });
  window.addEventListener("resize", follow, { signal: wiring.signal });
  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(position) : undefined;
  observer?.observe(el);
  if (watch?.current) observer?.observe(watch.current);
  return () => {
    wiring.abort();
    observer?.disconnect();
  };
}

/** Elemento `popover="manual"` abierto mientras está montado, colocado junto a su ancla y recolocado al desplazar. */
export function Popup({ open, anchorRect, placement, gap = 4, watch, anchorWidth, onShown, ref, children, ...rest }: PopupProps) {
  const node = useRef<HTMLDivElement | null>(null);
  const setRef = useMergedRef(node, ref);
  const latest = useLatest({ anchorRect, placement, gap, anchorWidth, onShown });

  useIsoLayoutEffect(() => {
    const el = node.current;
    if (!el) return;
    try {
      if (!el.matches(":popover-open")) el.showPopover();
    } catch {
      // Navegador sin Popover API: la capa queda en el flujo con `position: fixed` y su z-index.
    }
    const release = anchorTo(el, latest, watch);
    latest.current.onShown?.(el);
    return release;
  }, [latest, watch]);

  // Los cambios de colocación con la capa abierta (otra `side`, otro punto) recolocan sin reabrir.
  useIsoLayoutEffect(() => {
    const el = node.current;
    const rect = el ? anchorRect() : null;
    if (el && rect) place(el, rect, placement, gap);
  }, [placement, gap]);

  return (
    <div {...rest} ref={setRef} popover="manual" data-state={open ? "open" : "closed"}>
      {children}
    </div>
  );
}

export interface ModalPopupProps extends Omit<ComponentProps<"dialog">, "open"> {
  /** `data-state`: `open`, o `closed` durante la animación de salida. */
  open: boolean;
  anchorRect: () => Box | null;
  placement: Placement;
  gap?: number;
  watch?: RefObject<Element | null>;
  /** Se llama una vez, con la capa ya visible y colocada. */
  onShown?: (el: HTMLDialogElement) => void;
  /** Petición de cierre: Escape (o el gesto atrás del sistema) y pulsación fuera del panel. */
  onDismiss: (reason: "escape" | "backdrop") => void;
  /** Disparador: recibe el foco al cerrar. */
  trigger?: RefObject<HTMLElement | null>;
  ref?: Ref<HTMLDialogElement>;
}

/**
 * Capa anclada modal: un `<dialog>` abierto con `showModal()` mientras está montado. Como `Popup`, va en la capa
 * superior y sigue a su ancla; además el navegador deja inerte todo lo que queda fuera y la página no se desplaza. No lleva velo visible: una
 * pulsación fuera recae en su `::backdrop` transparente y pide el cierre.
 */
export function ModalPopup({
  open,
  anchorRect,
  placement,
  gap = 4,
  watch,
  onShown,
  onDismiss,
  trigger,
  ref,
  children,
  onClick,
  ...rest
}: ModalPopupProps) {
  const node = useRef<HTMLDialogElement | null>(null);
  const setRef = useMergedRef(node, ref);
  const latest = useLatest({ anchorRect, placement, gap, onShown, onDismiss, trigger });

  useIsoLayoutEffect(() => {
    const el = node.current;
    if (!el) return;
    const previous = activeElement();
    if (!el.open) el.showModal();
    // Como cualquier otro diálogo modal de la suite: la página de debajo, que ya es inerte, tampoco se desplaza.
    const unlock = lockScroll();
    const release = anchorTo(el, latest, watch);
    latest.current.onShown?.(el);
    // El navegador cerraría el diálogo por su cuenta: el cierre lo decide el componente (estado controlado).
    const onCancel = (event: Event) => {
      event.preventDefault();
      latest.current.onDismiss("escape");
    };
    el.addEventListener("cancel", onCancel);
    return () => {
      el.removeEventListener("cancel", onCancel);
      release();
      unlock();
      const inside = el.contains(document.activeElement) || !activeElement();
      if (el.open) el.close();
      // Mientras el diálogo estaba abierto el disparador era inerte y no podía recibir el foco: se le devuelve ahora.
      if (inside || !activeElement()) focusQuiet(latest.current.trigger?.current ?? previous);
    };
  }, [latest, watch]);

  useIsoLayoutEffect(() => {
    const el = node.current;
    const rect = el ? anchorRect() : null;
    if (el && rect) place(el, rect, placement, gap);
  }, [placement, gap]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: el clic solo detecta la pulsación en el velo; con el teclado el cierre llega por Escape (evento `cancel`).
    <dialog
      {...rest}
      ref={setRef}
      data-state={open ? "open" : "closed"}
      onPointerDownCapture={(event) => notePress(event.nativeEvent)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented && open && pressedOnBackdrop(event.currentTarget, event.nativeEvent)) onDismiss("backdrop");
      }}
    >
      {children}
    </dialog>
  );
}

/** Rectángulo de un elemento como `Box`, o null si no está montado. */
export function rectOf(el: Element | null | undefined): Box | null {
  return el?.isConnected ? el.getBoundingClientRect() : null;
}
