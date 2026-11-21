// Armazón de las páginas de documentación: barra lateral de cristal pegajosa + artículo sobre superficie de
// lectura + rail derecho. Lo usan los documentos (DocRoot/DocItem), las páginas de componente y los catálogos.
import Link from "@docusaurus/Link";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "@zuccadev-labs/zuix-zui";
import { type ReactNode, useEffect, useRef } from "react";
import { useChrome } from "./Chrome";
import { SiteNav } from "./SiteNav";

export interface PageLink {
  title: string;
  permalink: string;
}

/** Rejilla de barra lateral + contenido. */
export function DocsShell({ children }: { children: ReactNode }) {
  return (
    <div className="zd-container zd-shell">
      <aside className="zd-sidebar zd-glass" aria-label="Navegación de la documentación">
        <SiteNav />
      </aside>
      <div className="zd-shell__main">{children}</div>
    </div>
  );
}

/** Artículo y rail. El artículo es la región principal de la página. */
export function PageGrid({ children, rail }: { children: ReactNode; rail?: ReactNode }) {
  const main = useRef<HTMLElement>(null);
  // Los títulos son destino de los enlaces del índice: con tabindex=-1 reciben el foco al seguir uno, y el
  // teclado continúa desde la sección y no desde el principio de la página.
  useEffect(() => {
    for (const h of main.current?.querySelectorAll<HTMLElement>(":is(h2, h3)[id]") ?? []) if (!h.hasAttribute("tabindex")) h.tabIndex = -1;
  });
  return (
    <div className={cx("zd-page-grid", !rail && "zd-page-grid--norail")}>
      <main ref={main} className="zd-article zd-reading">
        {children}
      </main>
      {rail ? (
        <aside className="zd-rail" aria-label="En esta página">
          {rail}
        </aside>
      ) : null}
    </div>
  );
}

/** Barra superior del artículo: anterior/siguiente, migas para abrir el cajón (móvil) y acciones de página. */
export function ArticleBar({
  previous,
  next,
  here,
  section,
  actions,
}: {
  previous?: PageLink;
  next?: PageLink;
  here: string;
  section?: string;
  actions?: ReactNode;
}) {
  const { setNavOpen, navOpen } = useChrome();
  return (
    <div className="zd-article__bar">
      <button
        type="button"
        className="zd-mobile-crumb zd-glass"
        aria-haspopup="dialog"
        aria-expanded={navOpen}
        onClick={() => setNavOpen(true)}
      >
        <Icon name="bars-3-bottom-left" size={16} />
        {section ? <span className="zd-mobile-crumb__section">{section}</span> : null}
        <strong>{here}</strong>
        <span className="zd-sr-only">: abrir la navegación</span>
      </button>
      <div className="zd-article__bar-row">
        <nav className="zd-prevnext" aria-label="Página anterior y siguiente">
          {previous ? (
            <Link className="zd-prevnext__item" to={previous.permalink} title={previous.title} aria-label={`Anterior: ${previous.title}`}>
              <Icon name="arrow-left" size={16} />
            </Link>
          ) : (
            <span className="zd-prevnext__item" aria-hidden="true" data-disabled="">
              <Icon name="arrow-left" size={16} />
            </span>
          )}
          {next ? (
            <Link className="zd-prevnext__item" to={next.permalink} title={next.title} aria-label={`Siguiente: ${next.title}`}>
              <Icon name="arrow-right" size={16} />
            </Link>
          ) : (
            <span className="zd-prevnext__item" aria-hidden="true" data-disabled="">
              <Icon name="arrow-right" size={16} />
            </span>
          )}
        </nav>
        {actions}
      </div>
    </div>
  );
}

export function Crumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav className="zd-crumbs" aria-label="Migas de pan">
      <ol>
        {items.map((c, i) => (
          <li key={`${c.label}${c.to ?? ""}`}>
            {c.to && i < items.length - 1 ? (
              <Link to={c.to}>{c.label}</Link>
            ) : (
              <span aria-current={i === items.length - 1 ? "page" : undefined}>{c.label}</span>
            )}
            {i < items.length - 1 ? <Icon name="chevron-right" size={12} className="zd-crumbs__sep" /> : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Anterior y siguiente al pie del artículo, con el título de cada página. */
export function Pager({ previous, next }: { previous?: PageLink; next?: PageLink }) {
  if (!previous && !next) return null;
  return (
    <nav className="zd-pager" aria-label="Paginación de la documentación">
      {previous ? (
        <Link className="zd-pager__item" to={previous.permalink}>
          <span className="zd-pager__dir">
            <Icon name="arrow-left" size={14} /> Anterior
          </span>
          <span className="zd-pager__title">{previous.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link className="zd-pager__item zd-pager__item--next" to={next.permalink}>
          <span className="zd-pager__dir">
            Siguiente <Icon name="arrow-right" size={14} />
          </span>
          <span className="zd-pager__title">{next.title}</span>
        </Link>
      ) : null}
    </nav>
  );
}

export function RailCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="zd-rail-card zd-glass" aria-label={title}>
      <p className="zd-rail-card__title">{title}</p>
      {children}
    </section>
  );
}
