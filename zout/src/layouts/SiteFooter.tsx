import type { ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../cx";

export interface SiteFooterLink {
  label: string;
  href: string;
  /** Sale del sitio: icono de enlace externo. */
  external?: boolean;
}
export interface SiteFooterColumn {
  title: string;
  links: SiteFooterLink[];
}
export interface SiteFooterSocial {
  /** Nombre accesible (el icono no lleva texto). */
  label: string;
  href: string;
  icon: IconName;
}

export interface SiteFooterProps {
  /** Logo y nombre. */
  brand?: ReactNode;
  /** Frase bajo la marca. */
  tagline?: ReactNode;
  /** Grupos de enlaces con título. */
  columns?: SiteFooterColumn[];
  /** Enlaces con icono (redes, repositorio, contacto). */
  social?: SiteFooterSocial[];
  /** Texto legal (copyright). */
  legal?: ReactNode;
  /** Enlaces de la franja inferior (privacidad, términos). */
  bottomLinks?: SiteFooterLink[];
  /** Hueco libre junto a la marca (un formulario de boletín, un selector de idioma). */
  children?: ReactNode;
  /** `columns`: marca y columnas en rejilla; `centered`: todo centrado; `minimal`: una sola franja. */
  variant?: "columns" | "centered" | "minimal";
  /** `glass` (cristal de cromo), `solid` (superficie opaca) o `plain` (sin fondo). */
  surface?: "glass" | "solid" | "plain";
  /** Nombre del landmark de navegación de los enlaces. */
  label?: string;
  className?: string;
}

function FooterLink({ link }: { link: SiteFooterLink }) {
  return (
    <a className="z-sitefooter__link" href={link.href} {...(link.external ? { rel: "noopener" } : {})}>
      {link.label}
      {link.external ? <Icon name="arrow-up-right" size={12} /> : null}
    </a>
  );
}

/** Pie de un sitio: marca, columnas de enlaces, redes y franja legal. Solo marcado y CSS. */
export function SiteFooter({
  brand,
  tagline,
  columns = [],
  social = [],
  legal,
  bottomLinks = [],
  children,
  variant = "columns",
  surface = "glass",
  label = "Footer",
  className,
}: SiteFooterProps) {
  return (
    <footer
      className={cx("z-sitefooter", surface === "glass" ? "z-liquid" : null, className)}
      data-variant={variant}
      data-surface={surface}
    >
      <div className="z-sitefooter__top">
        {brand || tagline || children || social.length ? (
          <div className="z-sitefooter__brand">
            {brand ? <div className="z-sitefooter__logo">{brand}</div> : null}
            {tagline ? <p className="z-sitefooter__tagline">{tagline}</p> : null}
            {children}
            {social.length ? (
              <ul className="z-sitefooter__social">
                {social.map((s) => (
                  <li key={s.href}>
                    <a className="z-sitefooter__social-link" href={s.href} aria-label={s.label} title={s.label}>
                      <Icon name={s.icon} size={18} />
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        {columns.length ? (
          <nav className="z-sitefooter__nav" aria-label={label}>
            {columns.map((col, i) => (
              <div key={col.title} className="z-sitefooter__column">
                <p className="z-sitefooter__title" id={`z-sitefooter-${i}-${col.title.replace(/\W+/g, "-").toLowerCase()}`}>
                  {col.title}
                </p>
                <ul aria-labelledby={`z-sitefooter-${i}-${col.title.replace(/\W+/g, "-").toLowerCase()}`}>
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <FooterLink link={l} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        ) : null}
      </div>
      {legal || bottomLinks.length ? (
        <div className="z-sitefooter__bottom">
          {legal ? <p className="z-sitefooter__legal">{legal}</p> : null}
          {bottomLinks.length ? (
            <ul className="z-sitefooter__bottom-links">
              {bottomLinks.map((l) => (
                <li key={l.href}>
                  <FooterLink link={l} />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </footer>
  );
}
