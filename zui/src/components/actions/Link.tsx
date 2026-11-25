import type { AnchorHTMLAttributes, ReactNode, Ref } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";
import { withRef } from "../../react-compat";

export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /** `inline` va subrayado dentro de un texto; `subtle` solo se subraya al pasar; `standalone` es una acción suelta. */
  variant?: "inline" | "subtle" | "standalone";
  /** Abre en otra pestaña y añade el icono de enlace externo. */
  external?: boolean;
  /** Texto para lectores de pantalla en enlaces externos. */
  externalLabel?: string;
  icon?: IconName;
  disabled?: boolean;
  ref?: Ref<HTMLAnchorElement>;
  children?: ReactNode;
}

export const Link = withRef(function Link({
  variant = "inline",
  external,
  externalLabel = "opens in a new tab",
  icon,
  disabled,
  className,
  children,
  href,
  onClick,
  ...rest
}: LinkProps) {
  const externalProps = external ? { target: "_blank", rel: "noopener noreferrer" } : null;
  return (
    <a
      {...externalProps}
      {...rest}
      // Sin href un ancla deja de ser enlace: así se representa el estado deshabilitado.
      href={disabled ? undefined : href}
      // Deshabilitado no navega ni ejecuta su acción.
      onClick={disabled ? undefined : onClick}
      aria-disabled={disabled || undefined}
      role={disabled ? "link" : rest.role}
      className={cx("z-link", `z-link--${variant}`, className)}
    >
      {icon ? <Icon name={icon} size={14} /> : null}
      {children}
      {external ? (
        <>
          <Icon name="arrow-top-right-on-square" size={12} />
          <span className="z-sr-only"> ({externalLabel})</span>
        </>
      ) : null}
    </a>
  );
});
