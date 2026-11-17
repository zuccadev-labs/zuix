"use client";
import { useId, type ReactElement, type ReactNode } from "react";
import { cx } from "../../cx";
import { DialogSurface } from "../../primitives/dialog";
import { CloseButton, useDisclosure } from "./internal";

export interface ModalProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Elemento que abre el modal (uso no controlado). */
  trigger?: ReactElement;
  title?: ReactNode;
  description?: ReactNode;
  /** Nombre accesible cuando no hay `title` visible. */
  label?: string;
  size?: "sm" | "md" | "lg";
  footer?: ReactNode;
  /** Escape y clic en el velo cierran. */
  dismissible?: boolean;
  hideClose?: boolean;
  closeLabel?: string;
  className?: string;
  children?: ReactNode;
}

/** Diálogo modal: un `<dialog>` abierto con `showModal()`, con el mismo marcado que el contrato HTML. */
export function Modal({
  open: openProp,
  defaultOpen,
  onOpenChange,
  trigger: triggerProp,
  title,
  description,
  label = "Dialog",
  size = "md",
  footer,
  dismissible = true,
  hideClose,
  closeLabel = "Close",
  className,
  children,
}: ModalProps) {
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
        closeOnEscape={dismissible}
        closeOnBackdrop={dismissible}
        trigger={triggerRef}
        className={cx("z-liquid z-modal", className)}
        data-size={size}
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : label}
        aria-describedby={description ? descriptionId : undefined}
      >
        {title ? (
          <header className="z-modal__header">
            <div className="z-modal__heading">
              <h2 id={titleId} className="z-modal__title">
                {title}
              </h2>
              {description ? (
                <p id={descriptionId} className="z-modal__description">
                  {description}
                </p>
              ) : null}
            </div>
          </header>
        ) : description ? (
          <p id={descriptionId} className="z-sr-only">
            {description}
          </p>
        ) : null}
        {children ? <div className="z-modal__body">{children}</div> : null}
        {footer ? <footer className="z-modal__footer">{footer}</footer> : null}
        {hideClose ? null : <CloseButton label={closeLabel} className="z-modal__close" onClick={() => setOpen(false)} />}
      </DialogSurface>
    </>
  );
}
