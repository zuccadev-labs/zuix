import type { HTMLAttributes, ReactNode, Ref } from "react";
import { badgeText } from "../../core/notifications";
import { fill } from "../../core/vnode";
import { cx } from "../../cx";
import { withRef } from "../../react-compat";

export interface NotificationBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Avisos sin leer. Con 0 no se pinta nada (salvo `showZero`). */
  count: number;
  /** Tope: por encima se escribe «99+». */
  max?: number;
  /** Solo un punto, sin cifra (hay algo nuevo, sin contar). */
  dot?: boolean;
  /** Pinta «0» en vez de nada. */
  showZero?: boolean;
  tone?: "danger" | "accent" | "neutral";
  /** Texto para lectores: «{count} unread». Vacío para un contador decorativo (dentro de un botón con nombre propio). */
  label?: string;
  locale?: string;
  /** Elemento al que se pega el contador, en su esquina superior final. */
  children?: ReactNode;
  ref?: Ref<HTMLSpanElement>;
}

/** Contador de avisos sin leer: cifra con tope, o un punto; suelto o pegado a la esquina de otro elemento. */
export const NotificationBadge = withRef(function NotificationBadge({
  count,
  max = 99,
  dot,
  showZero,
  tone = "danger",
  label = "{count} unread",
  locale,
  children,
  className,
  ref,
  ...rest
}: NotificationBadgeProps) {
  const text = badgeText(count, max, locale) || (showZero ? "0" : "");
  const visible = dot ? count > 0 || showZero : text !== "";
  const said = label ? fill(label, { count: Math.max(0, Math.floor(Number.isFinite(count) ? count : 0)) }) : "";
  const badge = visible ? (
    <span
      {...(children ? {} : rest)}
      ref={children ? undefined : ref}
      className={cx("z-notification-badge", children ? undefined : className)}
      data-tone={tone}
      data-dot={dot || undefined}
    >
      {dot ? null : <span aria-hidden={said ? "true" : undefined}>{text}</span>}
      {said ? <span className="z-sr-only">{said}</span> : null}
    </span>
  ) : null;
  if (!children) return badge;
  return (
    <span {...rest} ref={ref} className={cx("z-notification-badge-anchor", className)}>
      {children}
      {badge}
    </span>
  );
});
