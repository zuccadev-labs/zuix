import type { ReactNode } from "react";
import { cx } from "../cx";

export interface LandingLayoutProps {
  /** Barra del sitio (Navbar). */
  header?: ReactNode;
  /** Pie (SiteFooter). */
  footer?: ReactNode;
  /** LandingHero y LandingSection. */
  children: ReactNode;
  className?: string;
}

/** Página de presentación: barra del sitio, secciones (héroe, logos, funciones, precios, preguntas, llamada) y pie. */
export function LandingLayout({ header, footer, children, className }: LandingLayoutProps) {
  return (
    <div className={cx("z-landing", className)}>
      {header ? <div className="z-landing__header">{header}</div> : null}
      <main className="z-landing__main">{children}</main>
      {footer ? <div className="z-landing__footer">{footer}</div> : null}
    </div>
  );
}

export interface LandingHeroProps {
  title: ReactNode;
  /** Texto sobre el título (novedad, categoría). */
  eyebrow?: ReactNode;
  lead?: ReactNode;
  /** Botones (empezar, ver demo). */
  actions?: ReactNode;
  /** Imagen, captura o efecto al lado o debajo. */
  media?: ReactNode;
  /** `center` todo centrado con la imagen debajo; `split` texto a un lado, imagen al otro. */
  align?: "center" | "split";
  className?: string;
}

/** Héroe de la página: el único h1, con antetítulo, entradilla, acciones e imagen. */
export function LandingHero({ title, eyebrow, lead, actions, media, align = "center", className }: LandingHeroProps) {
  return (
    <section className={cx("z-landing-hero", className)} data-align={align}>
      <div className="z-landing-hero__text">
        {eyebrow ? <p className="z-landing-hero__eyebrow">{eyebrow}</p> : null}
        <h1 className="z-landing-hero__title">{title}</h1>
        {lead ? <p className="z-landing-hero__lead">{lead}</p> : null}
        {actions ? <div className="z-landing-hero__actions">{actions}</div> : null}
      </div>
      {media ? <div className="z-landing-hero__media">{media}</div> : null}
    </section>
  );
}

export interface LandingSectionProps {
  title?: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  id?: string;
  /** `default`; `features` rejilla de tarjetas; `cta` banda de llamada a la acción en cristal; `muted` fondo tenue. */
  variant?: "default" | "features" | "cta" | "muted";
  /** Columnas de la rejilla con `features`. */
  columns?: 2 | 3 | 4;
  /** Acciones bajo el título (con `cta`). */
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/** Sección de la página de presentación: encabezado h2 opcional y contenido en rejilla, banda o bloque. */
export function LandingSection({
  title,
  eyebrow,
  description,
  id,
  variant = "default",
  columns = 3,
  actions,
  children,
  className,
}: LandingSectionProps) {
  const headingId = id && title ? `${id}-title` : undefined;
  return (
    <section
      id={id}
      className={cx("z-landing-section", variant === "cta" && "z-liquid", className)}
      data-variant={variant}
      data-columns={variant === "features" ? columns : undefined}
      aria-labelledby={headingId}
    >
      {title || eyebrow || description ? (
        <div className="z-landing-section__head">
          {eyebrow ? <p className="z-landing-section__eyebrow">{eyebrow}</p> : null}
          {title ? (
            <h2 className="z-landing-section__title" id={headingId}>
              {title}
            </h2>
          ) : null}
          {description ? <p className="z-landing-section__description">{description}</p> : null}
          {actions ? <div className="z-landing-section__actions">{actions}</div> : null}
        </div>
      ) : null}
      {children ? <div className="z-landing-section__body">{children}</div> : null}
    </section>
  );
}
