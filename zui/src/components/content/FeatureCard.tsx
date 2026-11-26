import type { HTMLAttributes, ReactNode } from "react";
import type { PatternName } from "../../core/pattern";
import { cx } from "../../cx";
import { Backdrop } from "../effects/Backdrop";
import { Card, type CardTone } from "./Card";

export interface FeatureCardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title: ReactNode;
  description?: ReactNode;
  /** Línea corta encima del título. */
  eyebrow?: ReactNode;
  /** Dibujo de la portada (core/pattern). `mesh` es una malla de color. */
  pattern?: PatternName;
  /** Semilla del dibujo: la misma da siempre la misma portada. */
  seed?: number | string;
  /** Tono de la portada y del dibujo. */
  tone?: CardTone;
  /** Portada propia (imagen, vídeo) en lugar del dibujo; decorativa. */
  cover?: ReactNode;
  /** Deriva lenta del dibujo (nunca con movimiento reducido). */
  animated?: boolean;
  /** Destino: el título es un enlace que cubre la tarjeta. */
  href?: string;
  /** Acciones bajo el texto; quedan por encima del enlace. */
  actions?: ReactNode;
  align?: "center" | "start";
  headingLevel?: 2 | 3 | 4;
}

/** Tarjeta de característica: portada con un patrón generado (o una imagen) y el texto abajo, sobre un fundido. */
export function FeatureCard({
  title,
  description,
  eyebrow,
  pattern = "stars",
  seed,
  tone,
  cover,
  animated,
  href,
  actions,
  align = "center",
  headingLevel = 3,
  className,
  ...rest
}: FeatureCardProps) {
  const H = `h${headingLevel}` as "h3";
  return (
    <Card
      {...rest}
      as="article"
      surface="elevated"
      padding="none"
      tone={tone}
      className={cx("z-feature-card", className)}
      data-pattern={pattern}
      data-align={align}
    >
      {cover ? (
        <div className="z-feature-card__cover" aria-hidden="true">
          {cover}
        </div>
      ) : (
        <Backdrop
          className="z-feature-card__cover"
          pattern={pattern}
          seed={seed}
          tone="media"
          fade="none"
          intensity={pattern === "mesh" ? "strong" : "medium"}
          animated={animated}
        />
      )}
      <div className="z-feature-card__body">
        {eyebrow ? <p className="z-feature-card__eyebrow">{eyebrow}</p> : null}
        <H className="z-feature-card__title">
          {href ? (
            <a className="z-card__link" href={href}>
              {title}
            </a>
          ) : (
            title
          )}
        </H>
        {description ? <p className="z-feature-card__description">{description}</p> : null}
        {actions ? <div className="z-feature-card__actions">{actions}</div> : null}
      </div>
    </Card>
  );
}
