"use client";
import type { ReactElement, ReactNode } from "react";
import { Dialog } from "radix-ui";
import { cx } from "../../cx";
import { CloseButton, useReturnFocus } from "./internal";

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

export function Drawer({
  open,
  defaultOpen,
  onOpenChange,
  trigger,
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
  const returnFocus = useReturnFocus(Boolean(trigger));
  return (
    <Dialog.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal>
        <Dialog.Overlay className="z-overlay-scrim z-overlay-scrim--drawer" />
        <Dialog.Content
          className={cx("z-liquid z-drawer", className)}
          data-side={side}
          data-size={size}
          {...returnFocus}
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          {title ? (
            <header className="z-drawer__header">
              <Dialog.Title className="z-drawer__title">{title}</Dialog.Title>
              {description ? <Dialog.Description className="z-drawer__description">{description}</Dialog.Description> : null}
            </header>
          ) : (
            <>
              <Dialog.Title className="z-sr-only">{label}</Dialog.Title>
              {description ? <Dialog.Description className="z-sr-only">{description}</Dialog.Description> : null}
            </>
          )}
          <div className="z-drawer__body">{children}</div>
          {footer ? <footer className="z-drawer__footer">{footer}</footer> : null}
          {hideClose ? null : (
            <Dialog.Close asChild>
              <CloseButton label={closeLabel} className="z-drawer__close" />
            </Dialog.Close>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
