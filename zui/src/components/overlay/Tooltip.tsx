"use client";
import { useEffect, useId, useRef, type FocusEvent, type PointerEvent, type ReactElement, type ReactNode } from "react";
import { cx } from "../../cx";
import { useControllable, usePresence } from "../../primitives/hooks";
import { Popup, Portal, rectOf } from "../../primitives/popup";
import { slot } from "../../primitives/slot";

export interface TooltipProps {
  /** Texto o contenido de la burbuja. */
  content: ReactNode;
  /** Disparador: un único elemento enfocable. */
  children: ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  /** Retardo de apertura en ms. */
  delay?: number;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

// Margen para que el puntero cruce del disparador a la burbuja sin que se cierre.
const CLOSE_MS = 120;

export function Tooltip(props: TooltipProps) {
  // Sin contenido no hay burbuja: se devuelve el disparador tal cual.
  if (props.content === null || props.content === undefined || props.content === "") return props.children;
  return <Bubble {...props} />;
}

// WCAG 1.4.13: la burbuja se puede descartar sin mover el puntero (Escape), el puntero puede pasar a ella sin que se
// cierre y sigue visible mientras el puntero o el foco estén en el disparador o en la burbuja.
function Bubble({ content, children, side = "top", align = "center", delay = 300, open: openProp, defaultOpen, onOpenChange, className }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useControllable(openProp, defaultOpen ?? false, onOpenChange);
  const trigger = useRef<HTMLElement | null>(null);
  const tip = useRef<HTMLDivElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const present = usePresence(open, tip);

  const schedule = (next: boolean, ms: number) => {
    clearTimeout(timer.current);
    if (ms <= 0) setOpen(next);
    else timer.current = setTimeout(() => setOpen(next), ms);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  // Escape cierra la burbuja sin mover el puntero ni el foco; no consume la tecla.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") schedule(false, 0);
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  });

  const describedBy = (children.props as { "aria-describedby"?: string })["aria-describedby"];
  const host = slot(children, {
    ref: trigger,
    // Se añade a la descripción que el control ya tuviera (la ayuda de un Field), sin sustituirla.
    "aria-describedby": present ? [describedBy, id].filter(Boolean).join(" ") : describedBy,
    "data-state": open ? "open" : "closed",
    onPointerEnter: (event: PointerEvent) => {
      if (event.pointerType !== "touch") schedule(true, delay);
    },
    onPointerLeave: (event: PointerEvent) => {
      // Con el foco en el disparador la burbuja se queda: se cierra al perder el foco o con Escape.
      if (open && event.currentTarget.matches(":focus-visible")) return clearTimeout(timer.current);
      schedule(false, open ? CLOSE_MS : 0);
    },
    onPointerDown: () => schedule(false, 0),
    onFocus: (event: FocusEvent) => {
      if (event.currentTarget.matches(":focus-visible")) schedule(true, 0);
    },
    onBlur: () => schedule(false, 0),
  });

  return (
    <>
      {host}
      {present ? (
        <Portal anchor={trigger}>
          <Popup
            ref={tip}
            id={id}
            open={open}
            anchorRect={() => rectOf(trigger.current)}
            watch={trigger}
            placement={align === "center" ? side : `${side}-${align}`}
            gap={7}
            role="tooltip"
            className={cx("z-liquid z-tooltip", className)}
            onPointerEnter={() => clearTimeout(timer.current)}
            onPointerLeave={() => schedule(false, CLOSE_MS)}
          >
            {content}
          </Popup>
        </Portal>
      ) : null}
    </>
  );
}
