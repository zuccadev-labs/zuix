import type { HTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";

export interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Acción alineada a la derecha. */
  action?: ReactNode;
  headingLevel?: 2 | 3 | 4;
  /** Icono en una baldosa delante del título. */
  icon?: IconName;
  /**
   * Destino de la tarjeta: el título es un enlace (`.z-card__link`) cuya zona de clic cubre la tarjeta entera. Los
   * botones y enlaces de la tarjeta quedan por encima y siguen funcionando.
   */
  href?: string;
}

/** Cabecera de una `Card`: título, subtítulo y acción. */
export function CardHeader({ title, subtitle, action, headingLevel = 3, icon, href, className, ...rest }: CardHeaderProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div {...rest} className={cx("z-card__header", className)}>
      {icon ? (
        <span className="z-card__icon" aria-hidden="true">
          <Icon name={icon} size={18} />
        </span>
      ) : null}
      <div className="z-card__heading">
        <Heading className="z-card__title">
          {href ? (
            <a className="z-card__link" href={href}>
              {title}
            </a>
          ) : (
            title
          )}
        </Heading>
        {subtitle ? <p className="z-card__subtitle">{subtitle}</p> : null}
      </div>
      {action ? <div className="z-card__action">{action}</div> : null}
    </div>
  );
}
