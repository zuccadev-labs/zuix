"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../cx";
import { FLOAT_STEP, clampRect, moveDelta, resizeDelta, resizeRect, type Rect } from "../logic";

export interface FloatingPanelProps {
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Cerrar: botón en la cabecera y Escape con el foco dentro. Sin él, no se puede cerrar desde el panel. */
  onClose?: () => void;
  /** Posición (controlada), en px desde la esquina superior izquierda del área. */
  position?: { x: number; y: number };
  defaultPosition?: { x: number; y: number };
  onPositionChange?: (position: { x: number; y: number }) => void;
  /** Tamaño (controlado), en px. */
  size?: { width: number; height: number };
  defaultSize?: { width: number; height: number };
  onSizeChange?: (size: { width: number; height: number }) => void;
  minWidth?: number;
  minHeight?: number;
  resizable?: boolean;
  /** `fixed`: flota sobre la ventana. `absolute`: dentro de su contenedor posicionado (acotado a él). */
  strategy?: "fixed" | "absolute";
  /** Lleva el foco al panel al montarlo y lo devuelve al cerrarlo. Por defecto, true. */
  autoFocus?: boolean;
  moveLabel?: string;
  resizeLabel?: string;
  closeLabel?: string;
  className?: string;
}

const DEFAULT_POSITION = { x: 24, y: 24 };
const DEFAULT_SIZE = { width: 320, height: 240 };

/** Área en la que se acota el panel: la ventana o su contenedor posicionado. */
function boundsOf(el: HTMLElement, strategy: "fixed" | "absolute") {
  if (strategy === "absolute") {
    const parent = el.offsetParent as HTMLElement | null;
    if (parent) return { width: parent.clientWidth, height: parent.clientHeight };
  }
  const root = el.ownerDocument.documentElement;
  return { width: root.clientWidth, height: root.clientHeight };
}

/**
 * Ventana flotante no modal: se arrastra por su asa (o por la cabecera) y se redimensiona desde la esquina final, con
 * puntero o con flechas (Mayús, pasos de 100 px). Queda siempre dentro de la ventana o de su contenedor. Escape la
 * cierra con `onClose`. Origen: paneles flotantes de zutool; referencia de variantes: Floating Panel de Shark UI.
 */
export function FloatingPanel({
  title,
  children,
  footer,
  onClose,
  position,
  defaultPosition = DEFAULT_POSITION,
  onPositionChange,
  size,
  defaultSize = DEFAULT_SIZE,
  onSizeChange,
  minWidth = 200,
  minHeight = 120,
  resizable = true,
  strategy = "fixed",
  autoFocus = true,
  moveLabel = "Move panel (arrow keys)",
  resizeLabel = "Resize panel (arrow keys)",
  closeLabel = "Close",
  className,
}: FloatingPanelProps) {
  const id = useId();
  const node = useRef<HTMLElement>(null);
  const [innerPos, setInnerPos] = useState(defaultPosition);
  const [innerSize, setInnerSize] = useState(defaultSize);
  const pos = position ?? innerPos;
  const dim = size ?? innerSize;
  const rect: Rect = { ...pos, ...dim };
  const min = { width: minWidth, height: minHeight };
  const drag = useRef<{ mode: "move" | "resize"; pointerId: number; x: number; y: number; start: Rect } | null>(null);

  const commit = (next: Rect) => {
    if (next.x !== pos.x || next.y !== pos.y) {
      if (position === undefined) setInnerPos({ x: next.x, y: next.y });
      onPositionChange?.({ x: next.x, y: next.y });
    }
    if (next.width !== dim.width || next.height !== dim.height) {
      if (size === undefined) setInnerSize({ width: next.width, height: next.height });
      onSizeChange?.({ width: next.width, height: next.height });
    }
  };
  const bounds = () => (node.current ? boundsOf(node.current, strategy) : { width: Infinity, height: Infinity });
  const rtl = () => (node.current ? getComputedStyle(node.current).direction === "rtl" : false);
  const moveTo = (start: Rect, dx: number, dy: number) => commit(clampRect({ ...start, x: start.x + dx, y: start.y + dy }, bounds(), min));
  const resizeTo = (start: Rect, dw: number, dh: number) => commit(resizeRect(start, dw, dh, bounds(), min, rtl()));

  // Al montar (y si la ventana se estrecha) el panel vuelve dentro del área.
  // biome-ignore lint/correctness/useExhaustiveDependencies: solo al montar; después lo acotan los gestos y el redimensionado de la ventana.
  useLayoutEffect(() => {
    const fit = () => commit(clampRect(rect, bounds(), min));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // El foco entra en el panel al abrirse y vuelve a donde estaba al cerrarse (si seguía dentro).
  useEffect(() => {
    const el = node.current;
    if (!autoFocus || !el) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    el.focus({ preventScroll: true });
    return () => {
      const active = document.activeElement;
      if (previous?.isConnected && (!active || active === document.body || el.contains(active))) previous.focus({ preventScroll: true });
    };
  }, [autoFocus]);

  const start = (mode: "move" | "resize") => (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    // Los botones de la cabecera (cerrar) no arrastran; el asa sí.
    const control = (e.target as Element).closest("button, a, input, select, textarea");
    if (control && control !== e.currentTarget && !control.classList.contains("z-floatpanel__handle")) return;
    drag.current = { mode, pointerId: e.pointerId, x: e.clientX, y: e.clientY, start: rect };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* puntero ya liberado */
    }
    e.currentTarget.dataset.dragging = "";
  };
  const onMove = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (d.mode === "move") moveTo(d.start, dx, dy);
    else resizeTo(d.start, dx, dy);
  };
  const onEnd = (e: PointerEvent<HTMLElement>) => {
    drag.current = null;
    delete e.currentTarget.dataset.dragging;
  };
  const onKey = (mode: "move" | "resize") => (e: KeyboardEvent<HTMLElement>) => {
    const step = e.shiftKey ? FLOAT_STEP * 10 : FLOAT_STEP;
    if (mode === "move") {
      const d = moveDelta(e.key, step);
      if (!d) return;
      e.preventDefault();
      moveTo(rect, d.dx, d.dy);
    } else {
      const d = resizeDelta(e.key, step);
      if (!d) return;
      e.preventDefault();
      resizeTo(rect, d.dw, d.dh);
    }
  };
  const drags = (mode: "move" | "resize") => ({
    onPointerDown: start(mode),
    onPointerMove: onMove,
    onPointerUp: onEnd,
    onPointerCancel: onEnd,
    onLostPointerCapture: onEnd,
  });

  return (
    <section
      ref={node}
      className={cx("z-floatpanel z-liquid", className)}
      role="dialog"
      aria-labelledby={`${id}-title`}
      tabIndex={-1}
      data-strategy={strategy}
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
      onKeyDown={(e) => {
        if (e.key !== "Escape" || !onClose || e.defaultPrevented) return;
        e.preventDefault();
        onClose();
      }}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: arrastrar por la cabecera es ayuda de puntero; la vía de teclado es el asa (botón con flechas). */}
      <header className="z-floatpanel__header" {...drags("move")}>
        <button type="button" className="z-floatpanel__handle" aria-label={moveLabel} title={moveLabel} onKeyDown={onKey("move")}>
          <Icon name="bars-2" size={14} />
        </button>
        <h2 className="z-floatpanel__title" id={`${id}-title`}>
          {title}
        </h2>
        {onClose ? (
          <button type="button" className="z-floatpanel__close" aria-label={closeLabel} title={closeLabel} onClick={onClose}>
            <Icon name="x-mark" size={14} />
          </button>
        ) : null}
      </header>
      <div className="z-floatpanel__body">{children}</div>
      {footer ? <footer className="z-floatpanel__footer">{footer}</footer> : null}
      {resizable ? (
        <button
          type="button"
          className="z-floatpanel__resize"
          aria-label={resizeLabel}
          title={resizeLabel}
          onKeyDown={onKey("resize")}
          {...drags("resize")}
        />
      ) : null}
    </section>
  );
}
