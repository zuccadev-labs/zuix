"use client";
import { useId, type ReactElement, type ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";
import { DialogSurface } from "../../primitives/dialog";
import { DialogButton, useDisclosure } from "./internal";

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

/**
 * Confirmación (`role="alertdialog"`, patrón APG): el foco empieza en Cancelar, el clic en el velo no cierra y
 * Escape cancela. Mismo marcado que `confirm()` de `@zuccadev-labs/zuix-zui/dom`.
 */
export function ConfirmDialog({
  open: openProp,
  defaultOpen,
  onOpenChange,
  trigger: triggerProp,
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
  const id = useId();
  const { open, setOpen, trigger, triggerRef } = useDisclosure({ open: openProp, defaultOpen, onOpenChange, trigger: triggerProp, id });
  const glyph: IconName = icon ?? (intent === "danger" ? "exclamation-triangle" : "information-circle");
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;
  const cancel = () => {
    onCancel?.();
    setOpen(false);
  };
  return (
    <>
      {trigger}
      <DialogSurface
        id={id}
        open={open}
        // Escape cancela: avisa igual que el botón de cancelar.
        onDismiss={cancel}
        closeOnBackdrop={false}
        initialFocus={(dialog) => dialog.querySelector<HTMLElement>(".z-modal__footer .z-dialog-btn")}
        trigger={triggerRef}
        role="alertdialog"
        className={cx("z-liquid z-modal z-confirm", className)}
        data-intent={intent}
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <header className="z-modal__header">
          <span className="z-confirm__icon">
            <Icon name={glyph} size={16} />
          </span>
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
        {children ? <div className="z-modal__body">{children}</div> : null}
        <footer className="z-modal__footer">
          <DialogButton value="cancel" onClick={cancel}>
            {cancelLabel}
          </DialogButton>
          <DialogButton
            value="confirm"
            variant={intent === "danger" ? "danger" : "primary"}
            onClick={() => {
              onConfirm?.();
              setOpen(false);
            }}
          >
            {confirmLabel}
          </DialogButton>
        </footer>
      </DialogSurface>
    </>
  );
}
