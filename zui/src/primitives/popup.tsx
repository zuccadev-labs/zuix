"use client";
// Capa flotante anclada: un elemento `popover="manual"` (capa superior del navegador, por encima de cualquier
// `<dialog>` y sin z-index) colocado con core/place. La usan Popover, Tooltip, Menu, Select, Combobox y DatePicker.
import { useRef, useState, type ComponentProps, type ReactNode, type Ref, type RefObject } from "react";
import { createPortal } from "react-dom";
import { place, type Box, type Placement } from "../core/place";
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

/** Elemento `popover="manual"` abierto mientras está montado, colocado junto a su ancla y recolocado al desplazar. */
export function Popup({ open, anchorRect, placement, gap = 4, watch, anchorWidth, onShown, ref, children, ...rest }: PopupProps) {
  const node = useRef<HTMLDivElement | null>(null);
  const setRef = useMergedRef(node, ref);
  const latest = useLatest({ anchorRect, placement, gap, anchorWidth, onShown });

  useIsoLayoutEffect(() => {
    const el = node.current;
    if (!el) return;
    const position = () => {
      const rect = latest.current.anchorRect();
      if (!rect || !el.isConnected) return;
      if (latest.current.anchorWidth) el.style.setProperty("--z-anchor-width", `${rect.width}px`);
      place(el, rect, latest.current.placement, latest.current.gap);
    };
    try {
      if (!el.matches(":popover-open")) el.showPopover();
    } catch {
      // Navegador sin Popover API: la capa queda en el flujo con `position: fixed` y su z-index.
    }
    position();
    latest.current.onShown?.(el);
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

/** Rectángulo de un elemento como `Box`, o null si no está montado. */
export function rectOf(el: Element | null | undefined): Box | null {
  return el?.isConnected ? el.getBoundingClientRect() : null;
}
