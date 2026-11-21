"use client";
import { useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { focusQuiet, nextTabbable } from "../../core/focus";
import { cx } from "../../cx";

export type BannerTone = "neutral" | "accent" | "info" | "success" | "warning" | "danger";

const TONE_ICON: Partial<Record<BannerTone, IconName>> = {
  info: "information-circle",
  success: "check-circle",
  warning: "exclamation-triangle",
  danger: "exclamation-circle",
  accent: "megaphone",
};

export interface BannerProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  tone?: BannerTone;
  /** `page`: franja a todo el ancho, arriba de la página o del shell. `inline`: dentro de un panel o una tarjeta. */
  layout?: "page" | "inline";
  title?: ReactNode;
  /** Insignia corta antes del texto («New», «Beta»). */
  badge?: ReactNode;
  /** Sustituye el icono del tono; `null` lo quita. */
  icon?: IconName | null;
  /** Acción (un enlace o un botón) a la derecha del texto. */
  action?: ReactNode;
  /** Muestra el botón de cierre. Sin `open` controlado, el banner se oculta solo al cerrarlo. */
  onDismiss?: () => void;
  /** Se puede cerrar: muestra el botón aunque no haya `onDismiss`. */
  dismissible?: boolean;
  open?: boolean;
  dismissLabel?: string;
  /**
   * Anuncia el banner al aparecer (`role="status"`, o `alert` en `danger` y `warning`). Solo para un banner que se
   * inserta tras una acción; uno que llega con la página no se anuncia.
   */
  live?: boolean;
  children?: ReactNode;
}

/**
 * Franja de aviso de página o de panel: una novedad, un mantenimiento, un límite cerca o un error del sistema.
 * Persistente (no se va sola) y, si se puede cerrar, con un botón con nombre.
 */
export function Banner({
  tone = "info",
  layout = "page",
  title,
  badge,
  icon,
  action,
  onDismiss,
  dismissible,
  open: openProp,
  dismissLabel = "Dismiss",
  live,
  className,
  children,
  ...rest
}: BannerProps) {
  const [inner, setInner] = useState(true);
  const node = useRef<HTMLDivElement | null>(null);
  const open = openProp ?? inner;
  if (!open) return null;
  const glyph = icon === null ? null : (icon ?? TONE_ICON[tone]);
  const role = live ? (tone === "danger" || tone === "warning" ? "alert" : "status") : undefined;
  return (
    <div ref={node} role={role} {...rest} className={cx("z-banner", className)} data-tone={tone} data-layout={layout}>
      {glyph ? (
        <span className="z-banner__icon" aria-hidden="true">
          <Icon name={glyph} size={16} />
        </span>
      ) : null}
      <div className="z-banner__body">
        {badge ? <span className="z-banner__badge">{badge}</span> : null}
        {title ? <strong className="z-banner__title">{title}</strong> : null}
        {children ? <span className="z-banner__text">{children}</span> : null}
      </div>
      {action ? <div className="z-banner__action">{action}</div> : null}
      {onDismiss || dismissible ? (
        <button
          type="button"
          className="z-banner__close"
          aria-label={dismissLabel}
          title={dismissLabel}
          onClick={() => {
            // El foco no se pierde con el banner: sigue hacia delante, como haría Tab.
            const next = node.current ? nextTabbable(node.current) : undefined;
            onDismiss?.();
            if (openProp === undefined) setInner(false);
            focusQuiet(next);
          }}
        >
          <Icon name="x-mark" size={14} />
        </button>
      ) : null}
    </div>
  );
}
