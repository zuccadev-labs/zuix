"use client";
import type { HTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";

export type AlertTone = "info" | "success" | "warning" | "danger";

const TONE_ICON: Record<AlertTone, IconName> = {
  info: "information-circle",
  success: "check-circle",
  warning: "exclamation-triangle",
  danger: "exclamation-circle",
};

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  tone?: AlertTone;
  title?: ReactNode;
  /** Sustituye el icono del tono. */
  icon?: IconName;
  /** Acciones bajo el mensaje (botones o enlaces). */
  actions?: ReactNode;
  /** Muestra el botón de cierre. */
  onDismiss?: () => void;
  dismissLabel?: string;
  children?: ReactNode;
}

/** Aviso en línea sobre el resultado de una acción o el estado del sistema. */
export function Alert({
  tone = "info",
  title,
  icon,
  actions,
  onDismiss,
  dismissLabel = "Dismiss",
  className,
  children,
  ...rest
}: AlertProps) {
  // Lo urgente interrumpe (alert); lo informativo se anuncia con cortesía (status).
  const role = tone === "danger" || tone === "warning" ? "alert" : "status";
  return (
    <div role={role} {...rest} className={cx("z-alert", className)} data-tone={tone}>
      <span className="z-alert__icon">
        <Icon name={icon ?? TONE_ICON[tone]} size={18} />
      </span>
      <div className="z-alert__body">
        {title ? <p className="z-alert__title">{title}</p> : null}
        {children ? <div className="z-alert__message">{children}</div> : null}
        {actions ? <div className="z-alert__actions">{actions}</div> : null}
      </div>
      {onDismiss ? (
        <button type="button" className="z-alert__dismiss" aria-label={dismissLabel} title={dismissLabel} onClick={onDismiss}>
          <Icon name="x-mark" size={14} />
        </button>
      ) : null}
    </div>
  );
}
