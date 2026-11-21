"use client";
import { useEffect, useId, useRef, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { attachSheet } from "../../core/sheet";
import { useControllable, useLatest } from "../../primitives/hooks";
import { cx } from "../../cx";
import { DialogSurface } from "../../primitives/dialog";
import { CloseButton, useDisclosure } from "./internal";

export interface DrawerProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Elemento que abre el panel (uso no controlado). */
  trigger?: ReactElement;
  side?: "left" | "right" | "bottom" | "top";
  size?: "sm" | "md" | "lg";
  title?: ReactNode;
  description?: ReactNode;
  /** Nombre accesible cuando no hay `title` visible. */
  label?: string;
  footer?: ReactNode;
  hideClose?: boolean;
  closeLabel?: string;
  /** Asa para arrastrar el cajón hacia su borde y cerrarlo. Con `snapPoints`, siempre hay asa. */
  dragToClose?: boolean;
  /**
   * Puntos de anclaje (solo `top` y `bottom`): fracciones del alto de la ventana, de menor a mayor (`[0.4, 0.9]`).
   * El asa los recorre arrastrando o con las flechas (es un slider); arrastrar por debajo del menor cierra.
   */
  snapPoints?: number[];
  /** Anclaje activo (índice en `snapPoints`), controlado. */
  snapPoint?: number;
  defaultSnapPoint?: number;
  onSnapPointChange?: (index: number) => void;
  /** Nombre del asa. */
  handleLabel?: string;
  className?: string;
  children?: ReactNode;
}

/** Panel lateral modal: un `<dialog>` abierto con `showModal()`, con el mismo marcado que el contrato HTML. */
export function Drawer({
  open: openProp,
  defaultOpen,
  onOpenChange,
  trigger: triggerProp,
  side = "right",
  size = "md",
  title,
  description,
  label = "Panel",
  footer,
  hideClose,
  closeLabel = "Close",
  dragToClose,
  snapPoints,
  snapPoint,
  defaultSnapPoint,
  onSnapPointChange,
  handleLabel,
  className,
  children,
}: DrawerProps) {
  const id = useId();
  const { open, setOpen, trigger, triggerRef } = useDisclosure({ open: openProp, defaultOpen, onOpenChange, trigger: triggerProp, id });
  const snaps = (side === "top" || side === "bottom") && snapPoints?.length ? snapPoints : [];
  const [snap, setSnap] = useControllable(snapPoint, defaultSnapPoint ?? Math.max(0, snaps.length - 1), onSnapPointChange);
  const draggable = Boolean(dragToClose || snaps.length);
  const sheet = useRef<HTMLDialogElement | null>(null);
  const handle = useRef<HTMLButtonElement | null>(null);
  const latest = useLatest({ snaps, snap, setSnap, setOpen, side });
  // Cada apertura empieza en el anclaje por defecto.
  // biome-ignore lint/correctness/useExhaustiveDependencies: solo al abrir; el anclaje por defecto no reabre nada.
  useEffect(() => {
    if (open && snapPoint === undefined && defaultSnapPoint !== undefined) setSnap(defaultSnapPoint);
  }, [open]);
  useEffect(() => {
    const el = sheet.current;
    const grip = handle.current;
    if (!open || !draggable || !el || !grip) return;
    return attachSheet(el, grip, {
      side: latest.current.side,
      snaps: () => latest.current.snaps,
      current: () => latest.current.snap,
      onSnap: (index) => latest.current.setSnap(index),
      onClose: () => latest.current.setOpen(false),
    });
  }, [open, draggable, latest]);
  const current = Math.min(Math.max(snap, 0), Math.max(0, snaps.length - 1));
  const style = snaps.length ? ({ "--z-drawer-snap": snaps[current] } as CSSProperties) : undefined;
  const sideName = side === "bottom" || side === "top" ? "height" : "width";
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;
  return (
    <>
      {trigger}
      <DialogSurface
        ref={sheet}
        id={id}
        open={open}
        onDismiss={() => setOpen(false)}
        trigger={triggerRef}
        className={cx("z-liquid z-drawer", className)}
        data-side={side}
        data-size={size}
        data-drag={draggable || undefined}
        data-snap={snaps.length ? current : undefined}
        style={style}
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : label}
        aria-describedby={description ? descriptionId : undefined}
      >
        {draggable ? (
          snaps.length ? (
            <button
              ref={handle}
              type="button"
              role="slider"
              className="z-drawer__handle"
              aria-label={handleLabel ?? `Panel ${sideName}`}
              aria-orientation={side === "top" || side === "bottom" ? "vertical" : "horizontal"}
              aria-valuemin={0}
              aria-valuemax={snaps.length - 1}
              aria-valuenow={current}
              aria-valuetext={`${Math.round((snaps[current] ?? 0) * 100)}%`}
            >
              <span className="z-drawer__grip" aria-hidden="true" />
            </button>
          ) : (
            <button
              ref={handle}
              type="button"
              className="z-drawer__handle"
              aria-label={handleLabel ?? closeLabel}
              onClick={() => setOpen(false)}
            >
              <span className="z-drawer__grip" aria-hidden="true" />
            </button>
          )
        ) : null}
        {title ? (
          <header className="z-drawer__header">
            <h2 id={titleId} className="z-drawer__title">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="z-drawer__description">
                {description}
              </p>
            ) : null}
          </header>
        ) : description ? (
          <p id={descriptionId} className="z-sr-only">
            {description}
          </p>
        ) : null}
        <div className="z-drawer__body">{children}</div>
        {footer ? <footer className="z-drawer__footer">{footer}</footer> : null}
        {hideClose ? null : <CloseButton label={closeLabel} className="z-drawer__close" onClick={() => setOpen(false)} />}
      </DialogSurface>
    </>
  );
}
