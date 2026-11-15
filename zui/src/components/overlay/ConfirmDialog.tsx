"use client";
import type { ReactElement, ReactNode } from "react";
import { AlertDialog } from "radix-ui";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";
import { DialogButton, ElevatedContext, keepFocus, useReturnFocus } from "./internal";

export interface ConfirmDialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Elemento que abre el diálogo (uso no controlado). */
  trigger?: ReactElement;
  title: ReactNode;
  description?: ReactNode;
  /** `danger` marca la acción como destructiva. */
  intent?: "default" | "danger";
  icon?: IconName;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  className?: string;
  /** Cuerpo adicional bajo la descripción. */
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  defaultOpen,
  onOpenChange,
  trigger,
  title,
  description,
  intent = "default",
  icon,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  className,
  children,
}: ConfirmDialogProps) {
  const returnFocus = useReturnFocus(Boolean(trigger));
  const glyph: IconName = icon ?? (intent === "danger" ? "exclamation-triangle" : "information-circle");
  return (
    <AlertDialog.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      {trigger ? <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger> : null}
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="z-overlay-scrim" onMouseDown={keepFocus} />
        <AlertDialog.Content
          className={cx("z-liquid z-modal z-confirm", className)}
          data-intent={intent}
          {...returnFocus}
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <ElevatedContext.Provider value={true}>
            <header className="z-modal__header">
              <span className="z-confirm__icon">
                <Icon name={glyph} size={16} />
              </span>
              <div className="z-modal__heading">
                <AlertDialog.Title className="z-modal__title">{title}</AlertDialog.Title>
                {description ? <AlertDialog.Description className="z-modal__description">{description}</AlertDialog.Description> : null}
              </div>
            </header>
            {children ? <div className="z-modal__body">{children}</div> : null}
            <footer className="z-modal__footer">
              <AlertDialog.Cancel asChild>
                <DialogButton onClick={onCancel}>{cancelLabel}</DialogButton>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <DialogButton variant={intent === "danger" ? "danger" : "primary"} onClick={onConfirm}>
                  {confirmLabel}
                </DialogButton>
              </AlertDialog.Action>
            </footer>
          </ElevatedContext.Provider>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
