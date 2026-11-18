"use client";
import { useId, type ReactElement, type ReactNode } from "react";
import { cx } from "../../cx";
import { DialogSurface } from "../../primitives/dialog";
import { CloseButton, useDisclosure } from "./internal";

export interface DrawerProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Elemento que abre el panel (uso no controlado). */
  trigger?: ReactElement;
  side?: "left" | "right" | "bottom";
  size?: "sm" | "md" | "lg";
  title?: ReactNode;
  description?: ReactNode;
  /** Nombre accesible cuando no hay `title` visible. */
  label?: string;
  footer?: ReactNode;
  hideClose?: boolean;
  closeLabel?: string;
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
  className,
  children,
}: DrawerProps) {
  const id = useId();
  const { open, setOpen, trigger, triggerRef } = useDisclosure({ open: openProp, defaultOpen, onOpenChange, trigger: triggerProp, id });
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;
  return (
    <>
      {trigger}
      <DialogSurface
        id={id}
        open={open}
        onDismiss={() => setOpen(false)}
        trigger={triggerRef}
        className={cx("z-liquid z-drawer", className)}
        data-side={side}
        data-size={size}
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : label}
        aria-describedby={description ? descriptionId : undefined}
      >
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
