import type { HTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";
import { Avatar } from "../data/Avatar";
import { Card } from "./Card";

export interface OfferCardMeta {
  icon?: IconName;
  label: ReactNode;
}

export interface OfferCardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title: ReactNode;
  /** Persona o empresa: avatar redondo delante del título. */
  avatar?: { name: string; src?: string };
  /** Datos con icono bajo el título (ubicación, guardado hace…). */
  meta?: readonly OfferCardMeta[];
  /** Fichas de estado (Badge) junto a los datos. */
  tags?: ReactNode;
  /** Dato destacado a la derecha (tarifa, precio). */
  aside?: ReactNode;
  description?: ReactNode;
  /** Fila de acciones. */
  actions?: ReactNode;
  /** Destino: el título es un enlace que cubre la tarjeta. */
  href?: string;
  headingLevel?: 2 | 3 | 4;
}

/** Tarjeta de oferta o de perfil profesional: avatar, título, datos con icono, fichas, tarifa, descripción y acciones. */
export function OfferCard({
  title,
  avatar,
  meta,
  tags,
  aside,
  description,
  actions,
  href,
  headingLevel = 3,
  className,
  ...rest
}: OfferCardProps) {
  const H = `h${headingLevel}` as "h3";
  return (
    <Card {...rest} as="article" surface="elevated" padding="lg" className={cx("z-offer-card", className)}>
      <div className="z-offer-card__head">
        {avatar ? <Avatar className="z-offer-card__avatar" size="xl" name={avatar.name} src={avatar.src} alt="" /> : null}
        <div className="z-offer-card__heading">
          <H className="z-offer-card__title">
            {href ? (
              <a className="z-card__link" href={href}>
                {title}
              </a>
            ) : (
              title
            )}
          </H>
          {meta?.length || tags ? (
            <div className="z-offer-card__meta">
              {meta?.map((m, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: los datos no tienen identidad propia.
                <span key={i} className="z-offer-card__fact">
                  {m.icon ? <Icon name={m.icon} size={14} /> : null}
                  {m.label}
                </span>
              ))}
              {tags}
            </div>
          ) : null}
        </div>
        {aside ? <p className="z-offer-card__aside">{aside}</p> : null}
      </div>
      {description ? <p className="z-offer-card__description">{description}</p> : null}
      {actions ? <div className="z-offer-card__actions">{actions}</div> : null}
    </Card>
  );
}
