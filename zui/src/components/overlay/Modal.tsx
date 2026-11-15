"use client";
import type { ReactElement, ReactNode } from "react";
import { Dialog } from "radix-ui";
import { cx } from "../../cx";
import { CloseButton, ElevatedContext, keepFocus, useReturnFocus } from "./internal";

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

export function Modal({
  open,
  defaultOpen,
  onOpenChange,
  trigger,
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
  const returnFocus = useReturnFocus(Boolean(trigger));
  const block = (event: Event) => {
    if (!dismissible) event.preventDefault();
  };
  return (
    <Dialog.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal>
        <Dialog.Overlay className="z-overlay-scrim" onMouseDown={dismissible ? undefined : keepFocus} />
        <Dialog.Content
          className={cx("z-liquid z-modal", className)}
          data-size={size}
          {...returnFocus}
          onEscapeKeyDown={block}
          onPointerDownOutside={block}
          onInteractOutside={block}
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <ElevatedContext.Provider value={true}>
            {title ? (
              <header className="z-modal__header">
                <div className="z-modal__heading">
                  <Dialog.Title className="z-modal__title">{title}</Dialog.Title>
                  {description ? <Dialog.Description className="z-modal__description">{description}</Dialog.Description> : null}
                </div>
              </header>
            ) : (
              <>
                <Dialog.Title className="z-sr-only">{label}</Dialog.Title>
                {description ? <Dialog.Description className="z-sr-only">{description}</Dialog.Description> : null}
              </>
            )}
            {children ? <div className="z-modal__body">{children}</div> : null}
            {footer ? <footer className="z-modal__footer">{footer}</footer> : null}
            {hideClose ? null : (
              <Dialog.Close asChild>
                <CloseButton label={closeLabel} className="z-modal__close" />
              </Dialog.Close>
            )}
          </ElevatedContext.Provider>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
