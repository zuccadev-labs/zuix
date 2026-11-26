import type { HTMLAttributes, ReactNode } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { formatMoney } from "../../core/money";
import { cx } from "../../cx";
import { Backdrop } from "../effects/Backdrop";
import { Card, type CardTone } from "./Card";

export interface PricingFeature {
  label: ReactNode;
  /** Incluida (check) o no (cruz, con el texto atenuado y tachado para lectores). Por defecto, incluida. */
  included?: boolean;
}

export interface PricingCardLabels {
  /** Prefijo para lectores de una característica incluida. */
  included: string;
  /** Prefijo para lectores de una característica no incluida. */
  excluded: string;
}

export interface PricingCardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  /** Nombre del plan. */
  name: ReactNode;
  description?: ReactNode;
  /** Precio por periodo. */
  price: { amount: number; currency: string; locale?: string; period?: ReactNode };
  features?: readonly PricingFeature[];
  /** Llamada a la acción (Button). */
  action?: ReactNode;
  /** Plan destacado: más alto, con borde del tono y la insignia. */
  featured?: boolean;
  /** Insignia del destacado («Most popular»). */
  badge?: ReactNode;
  /** Color de la mancha detrás del cristal. */
  tone?: CardTone;
  headingLevel?: 2 | 3 | 4;
  labels?: Partial<PricingCardLabels>;
}

const LABELS: PricingCardLabels = { included: "Included:", excluded: "Not included:" };

/** Plan de precio de cristal sobre una mancha de color: precio grande, lista de características con check o cruz y CTA. */
export function PricingCard({
  name,
  description,
  price,
  features,
  action,
  featured,
  badge,
  tone,
  headingLevel = 3,
  labels: labelsProp,
  className,
  ...rest
}: PricingCardProps) {
  const labels = { ...LABELS, ...labelsProp };
  const H = `h${headingLevel}` as "h3";
  const text = formatMoney(price.amount, { currency: price.currency, locale: price.locale, trimZeros: true });
  return (
    <Card
      {...rest}
      as="article"
      surface="glass"
      tone={tone}
      padding="lg"
      glow={featured}
      className={cx("z-pricing-card", className)}
      data-featured={featured || undefined}
    >
      <span className="z-pricing-card__blob" aria-hidden="true" />
      <div className="z-pricing-card__head">
        <H className="z-pricing-card__name">{name}</H>
        {featured && badge ? <span className="z-pricing-card__badge">{badge}</span> : null}
      </div>
      <p className="z-pricing-card__price">
        <span className="z-pricing-card__amount">{text}</span>
        {price.period ? <span className="z-pricing-card__period">{price.period}</span> : null}
      </p>
      {description ? <p className="z-pricing-card__description">{description}</p> : null}
      {features?.length ? (
        <ul className="z-pricing-card__features">
          {features.map((f, i) => {
            const on = f.included !== false;
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: la lista es estática y no se reordena.
              <li key={i} className="z-pricing-card__feature" data-included={on ? "" : undefined}>
                <Icon name={on ? "check-circle" : "x-circle"} size={18} />
                <span>
                  <span className="z-sr-only">{on ? labels.included : labels.excluded} </span>
                  {f.label}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {action ? <div className="z-pricing-card__action">{action}</div> : null}
    </Card>
  );
}

export interface PricingTableProps extends HTMLAttributes<HTMLElement> {
  /** Nombre de la región para lectores. */
  label?: string;
  /** Semilla de la mancha de color del fondo. */
  seed?: number | string;
  /** Planes (PricingCard). */
  children: ReactNode;
}

/** Fila de planes sobre una mancha de color desenfocada: el cristal de cada plan la deja ver. */
export function PricingTable({ label, seed, className, children, ...rest }: PricingTableProps) {
  return (
    <section {...rest} aria-label={label} className={cx("z-pricing-table", className)}>
      <Backdrop className="z-pricing-table__backdrop" pattern="mesh" seed={seed} intensity="strong" fade="none">
        <div className="z-pricing-table__plans">{children}</div>
      </Backdrop>
    </section>
  );
}
