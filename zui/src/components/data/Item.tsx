import { Children, type HTMLAttributes, type ReactNode, type Ref } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";

export interface ItemProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title: ReactNode;
  description?: ReactNode;
  /** Medio inicial propio (Avatar, imagen, icono con fondo). */
  media?: ReactNode;
  /** Icono inicial en un recuadro (atajo de `media`). */
  icon?: IconName;
  /** Imagen inicial (atajo de `media`); `imageAlt` por defecto vacío: decorativa. */
  image?: string;
  imageAlt?: string;
  /** Texto secundario al final (hora, tamaño, contador). */
  meta?: ReactNode;
  /** Acciones al final (botones, menú). Siguen pulsables aunque el item sea un enlace. */
  actions?: ReactNode;
  /** Convierte el título en un enlace que cubre todo el item. */
  href?: string;
  variant?: "default" | "muted" | "outline";
  size?: "sm" | "md";
  ref?: Ref<HTMLDivElement>;
  children?: ReactNode;
}

/**
 * Fila de contenido: medio, título, descripción, metadato y acciones. Con `href`, el título es un enlace cuya zona de
 * clic cubre el item entero (las acciones quedan por encima). Dentro de ItemGroup, cada item es un elemento de lista.
 */
export function Item({
  title,
  description,
  media,
  icon,
  image,
  imageAlt = "",
  meta,
  actions,
  href,
  variant = "default",
  size = "md",
  className,
  children,
  ...rest
}: ItemProps) {
  const lead =
    media ??
    (icon ? (
      <span className="z-item__icon">
        <Icon name={icon} size={size === "sm" ? 16 : 18} />
      </span>
    ) : image ? (
      <img className="z-item__image" src={image} alt={imageAlt} />
    ) : null);
  return (
    <div {...rest} className={cx("z-item", className)} data-variant={variant} data-size={size} data-link={href ? true : undefined}>
      {lead ? <div className="z-item__media">{lead}</div> : null}
      <div className="z-item__content">
        <div className="z-item__title">
          {href ? (
            <a className="z-item__link" href={href}>
              {title}
            </a>
          ) : (
            title
          )}
        </div>
        {description ? <div className="z-item__description">{description}</div> : null}
        {children}
      </div>
      {meta ? <div className="z-item__meta">{meta}</div> : null}
      {actions ? <div className="z-item__actions">{actions}</div> : null}
    </div>
  );
}

export interface ItemGroupProps extends HTMLAttributes<HTMLDivElement> {
  /** Cabecera visible del grupo. Si es texto, también nombra la lista. */
  header?: ReactNode;
  /** Línea entre items. */
  divided?: boolean;
  /** Recuadro alrededor del grupo. */
  framed?: boolean;
  ref?: Ref<HTMLDivElement>;
  children?: ReactNode;
}

/** Lista de Item (role="list", cada hijo un listitem) con cabecera opcional, divisiones y marco. */
export function ItemGroup({ header, divided, framed, className, children, "aria-label": ariaLabel, ...rest }: ItemGroupProps) {
  return (
    <div {...rest} className={cx("z-item-group", className)} data-divided={divided || undefined} data-framed={framed || undefined}>
      {header ? (
        <div className="z-item-group__header" aria-hidden={typeof header === "string" ? true : undefined}>
          {header}
        </div>
      ) : null}
      <div className="z-item-group__list" role="list" aria-label={ariaLabel ?? (typeof header === "string" ? header : undefined)}>
        {Children.map(children, (child) =>
          child === null || child === undefined || typeof child === "boolean" ? null : (
            <div className="z-item-group__entry" role="listitem">
              {child}
            </div>
          ),
        )}
      </div>
    </div>
  );
}
