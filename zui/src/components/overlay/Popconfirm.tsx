"use client";
import { useId, useState, type MouseEvent, type ReactElement, type ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";
import { Popover } from "./Popover";

export interface PopconfirmProps {
  /** El botón que pide la confirmación. */
  trigger: ReactElement;
  title: ReactNode;
  description?: ReactNode;
  /** `danger` marca la acción como destructiva. */
  intent?: "default" | "danger";
  icon?: IconName;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Confirmado. Si devuelve una promesa, el botón espera ocupado; si se rechaza, la confirmación sigue abierta. */
  onConfirm?: () => unknown;
  onCancel?: () => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  className?: string;
}

/**
 * Confirmación en línea anclada a su disparador, para una acción que no merece un diálogo modal. Es un Popover
 * (`role="dialog"`, nombrado por su título): el foco empieza en Cancelar, que lleva la descripción; Escape o un clic
 * fuera cancelan y el foco vuelve al disparador.
 */
export function Popconfirm({
  trigger,
  title,
  description,
  intent = "default",
  icon,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  side = "top",
  align = "center",
  className,
}: PopconfirmProps) {
  const id = useId().replace(/:/g, "");
  const [own, setOwn] = useState(defaultOpen);
  const [busy, setBusy] = useState(false);
  const open = openProp ?? own;
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setOwn(next);
    onOpenChange?.(next);
    if (!next) setBusy(false);
  };
  const titleId = `${id}-title`;
  const descriptionId = description ? `${id}-description` : undefined;
  const glyph: IconName = icon ?? (intent === "danger" ? "exclamation-triangle" : "question-mark-circle");
  // Cerrar desde sus botones: el foco vuelve al disparador (el que nombra al panel en `aria-controls`).
  const closeFrom = (from: HTMLElement) => {
    const panel = from.closest<HTMLElement>(".z-popover");
    const owner = panel?.id ? from.ownerDocument.querySelector<HTMLElement>(`[aria-controls="${CSS.escape(panel.id)}"]`) : null;
    setOpen(false);
    owner?.focus({ preventScroll: true });
  };
  const cancel = (event: MouseEvent<HTMLButtonElement>) => {
    onCancel?.();
    closeFrom(event.currentTarget);
  };
  const confirm = (event: MouseEvent<HTMLButtonElement>) => {
    if (busy) return;
    const button = event.currentTarget;
    const result = onConfirm?.();
    if (result && typeof (result as Promise<unknown>).then === "function") {
      setBusy(true);
      (result as Promise<unknown>).then(
        () => closeFrom(button),
        () => setBusy(false),
      );
    } else closeFrom(button);
  };
  return (
    <Popover
      trigger={trigger}
      open={open}
      onOpenChange={(next) => {
        if (!next && open) onCancel?.();
        setOpen(next);
      }}
      side={side}
      align={align}
      arrow
      aria-labelledby={titleId}
      className={cx("z-popconfirm", className)}
    >
      <div className="z-popconfirm__content" data-intent={intent}>
        <span className="z-popconfirm__icon" aria-hidden="true">
          <Icon name={glyph} size={18} />
        </span>
        <div className="z-popconfirm__text">
          <p className="z-popconfirm__title" id={titleId}>
            {title}
          </p>
          {description ? (
            <p className="z-popconfirm__description" id={descriptionId}>
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="z-popconfirm__actions">
        {/* biome-ignore lint/a11y/noAutofocus: patrón de confirmación: el foco empieza en la acción segura. */}
        <button type="button" className="z-btn z-btn--secondary" data-size="sm" autoFocus aria-describedby={descriptionId} onClick={cancel}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={cx("z-btn", intent === "danger" ? "z-btn--danger" : "z-btn--primary")}
          data-size="sm"
          aria-describedby={descriptionId}
          aria-busy={busy || undefined}
          aria-disabled={busy || undefined}
          data-loading={busy || undefined}
          data-z-confirm=""
          onClick={confirm}
        >
          {confirmLabel}
        </button>
      </div>
    </Popover>
  );
}
