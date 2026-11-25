"use client";
import { isValidElement, type ComponentProps, type HTMLAttributes, type MouseEvent, type ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";
import { slot } from "../../primitives/slot";
import { withRef } from "../../react-compat";

export interface NavListProps extends Omit<ComponentProps<"nav">, "aria-label"> {
  /** Nombre accesible de la navegación. */
  label: string;
  /** Encabezado visible opcional sobre los enlaces. */
  heading?: ReactNode;
  children?: ReactNode;
}

/** Contenedor vertical de `NavLink`, pensado para barras laterales. */
export const NavList = withRef(function NavList({ label, heading, className, children, ...rest }: NavListProps) {
  return (
    <nav {...rest} aria-label={label} className={cx("z-navlist", className)}>
      {heading ? <div className="z-navlist__heading">{heading}</div> : null}
      {children}
    </nav>
  );
});

/** Además de sus props, admite atributos HTML (`data-*`, `aria-*`, `id`), que llegan al enlace o al botón. */
export interface NavLinkProps extends Omit<HTMLAttributes<HTMLElement>, "onClick" | "children" | "className" | "title"> {
  /** Con `href` se pinta un enlace; sin él, un botón. */
  href?: string;
  target?: string;
  rel?: string;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  icon?: IconName;
  /** Marca el destino actual. */
  active?: boolean;
  disabled?: boolean;
  /** Contenido al final de la fila: contador, insignia. */
  trailing?: ReactNode;
  /** Fusiona estilo y props con el hijo (p. ej. el Link de un router). */
  asChild?: boolean;
  title?: string;
  className?: string;
  children?: ReactNode;
}

export function NavLink({
  href,
  target,
  rel,
  onClick,
  icon,
  active,
  disabled,
  trailing,
  asChild,
  title,
  className,
  children,
  ...rest
}: NavLinkProps) {
  const shared = {
    ...rest,
    className: cx("z-navlink", className),
    title,
    onClick: disabled ? undefined : onClick,
    "aria-current": active ? ("page" as const) : undefined,
    "data-active": active || undefined,
  };
  const glyph = icon ? (
    <span className="z-navlink__icon">
      <Icon name={icon} variant={active ? "solid" : "outline"} size={16} />
    </span>
  ) : null;
  const tail = trailing ? <span className="z-navlink__trailing">{trailing}</span> : null;
  // `asChild`: el hijo (el Link de un router) es el elemento; recibe las props y la ref fusionadas y, dentro, el icono,
  // su propio contenido y el final de la fila.
  if (asChild && isValidElement<{ children?: ReactNode }>(children)) {
    return slot(
      children,
      { ...shared, "aria-disabled": disabled || undefined },
      <>
        {glyph}
        {children.props.children}
        {tail}
      </>,
    );
  }
  const body = (
    <>
      {glyph}
      <span className="z-navlink__label">{children}</span>
      {tail}
    </>
  );
  if (href !== undefined) {
    return (
      <a
        {...shared}
        href={disabled ? undefined : href}
        target={target}
        rel={rel}
        role={disabled ? "link" : undefined}
        aria-disabled={disabled || undefined}
      >
        {body}
      </a>
    );
  }
  return (
    <button type="button" {...shared} disabled={disabled}>
      {body}
    </button>
  );
}
