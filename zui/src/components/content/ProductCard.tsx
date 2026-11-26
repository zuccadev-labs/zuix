import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cx } from "../../cx";
import { PriceTag, type PriceTagProps } from "../data/PriceTag";
import { Card, type CardTone } from "./Card";
import { CardMedia } from "./CardMedia";

export interface ProductCardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title: ReactNode;
  /** Texto bajo el título (variante, ubicación). */
  subtitle?: ReactNode;
  /** Foto del producto. `alt=""` si el título ya nombra lo que se ve. */
  image?: { src: string; alt?: string };
  /** Media propia (ilustración, degradado) si no hay foto. */
  media?: ReactNode;
  /** Precio: PriceTag grande sobre la imagen. */
  price?: Pick<PriceTagProps, "amount" | "currency" | "locale" | "previous" | "unit" | "trimZeros">;
  /** `bleed`: la foto cubre la tarjeta y se funde hacia el tono; `inset`: foto con sus propias esquinas y el texto debajo. */
  layout?: "bleed" | "inset";
  /** Color del fundido (`bleed`) y del brillo. */
  tone?: CardTone;
  /** Ficha arriba a la izquierda (valoración, «New»). */
  badge?: ReactNode;
  /** Acción arriba a la derecha (favorito). */
  corner?: ReactNode;
  /** Acción principal (Button `glass` sobre la foto, `primary` en `inset`). */
  action?: ReactNode;
  /** Contenido extra bajo el texto (StatGroup, descripción). */
  children?: ReactNode;
  /** Destino: el título es un enlace que cubre la tarjeta. */
  href?: string;
  /** Proporción de la foto (`inset`, 4 / 3) o de la zona de foto sobre el texto (`bleed`, 1). */
  ratio?: number | string;
  headingLevel?: 2 | 3 | 4;
}

/** Tarjeta de producto: foto a sangre teñida con el tono y el precio encima, o foto inset con su texto debajo. */
export function ProductCard({
  title,
  subtitle,
  image,
  media,
  price,
  layout = "bleed",
  tone,
  badge,
  corner,
  action,
  children,
  href,
  ratio,
  headingLevel = 3,
  className,
  style,
  ...rest
}: ProductCardProps) {
  const H = `h${headingLevel}` as "h3";
  const bleed = layout === "bleed";
  return (
    <Card
      {...rest}
      as="article"
      surface="elevated"
      tone={tone}
      padding={bleed ? "md" : "sm"}
      className={cx("z-product-card", className)}
      data-layout={layout}
      style={bleed && ratio !== undefined ? ({ ...style, "--z-card-aspect": String(ratio) } as CSSProperties) : style}
    >
      <CardMedia
        placement={bleed ? "bleed" : "inset"}
        tint={bleed}
        ratio={bleed ? undefined : (ratio ?? 4 / 3)}
        src={image?.src}
        alt={image?.alt ?? ""}
      >
        {media}
      </CardMedia>
      {badge || corner ? (
        <div className="z-card__corner">
          {badge ? <span className="z-product-card__badge">{badge}</span> : <span />}
          {corner}
        </div>
      ) : null}
      <div className="z-product-card__body">
        {price && bleed ? <PriceTag {...price} size="lg" className="z-product-card__price" /> : null}
        <div className="z-product-card__heading">
          <H className="z-product-card__title">
            {href ? (
              <a className="z-card__link" href={href}>
                {title}
              </a>
            ) : (
              title
            )}
          </H>
          {price && !bleed ? <PriceTag {...price} className="z-product-card__price" /> : null}
        </div>
        {subtitle ? <p className="z-product-card__subtitle">{subtitle}</p> : null}
        {children}
        {action ? <div className="z-product-card__action">{action}</div> : null}
      </div>
    </Card>
  );
}
