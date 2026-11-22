"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../cx";
import { wireScrollspy } from "../pages";

export interface DocsTocItem {
  id: string;
  label: string;
  /** Nivel del encabezado (2 o 3): los de nivel 3 van sangrados. */
  level?: 2 | 3;
}

export interface DocsPagerLink {
  href: string;
  label: string;
}

export interface DocsLayoutLabels {
  nav: string;
  toc: string;
  /** Título del índice en estrecho (desplegable). */
  onThisPage: string;
  previous: string;
  next: string;
  pager: string;
}

const DOCS_LABELS: DocsLayoutLabels = {
  nav: "Documentation",
  toc: "On this page",
  onThisPage: "On this page",
  previous: "Previous",
  next: "Next",
  pager: "Pages",
};

export interface DocsLayoutProps {
  /** Barra superior (Navbar). */
  header?: ReactNode;
  /** Navegación de páginas (NavList, Tree o enlaces). */
  sidebar?: ReactNode;
  /** Índice de la página: se marca la sección que se lee. */
  toc?: readonly DocsTocItem[];
  previous?: DocsPagerLink;
  next?: DocsPagerLink;
  labels?: Partial<DocsLayoutLabels>;
  /** El artículo (Prose). */
  children: ReactNode;
  className?: string;
}

/**
 * Página de documentación: barra superior, navegación de páginas, artículo, índice con la sección actual marcada y
 * paginación anterior/siguiente. En estrecho el índice pasa a un desplegable sobre el artículo y la navegación baja.
 */
export function DocsLayout({ header, sidebar, toc, previous, next, labels: labelsProp, children, className }: DocsLayoutProps) {
  const labels = { ...DOCS_LABELS, ...labelsProp };
  const tocRef = useRef<HTMLElement | null>(null);
  useEffect(() => (tocRef.current ? wireScrollspy(tocRef.current) : undefined), []);
  const tocList = toc?.length ? (
    <ul className="z-docs-layout__toc-list">
      {toc.map((t) => (
        <li key={t.id} data-level={t.level ?? 2}>
          <a className="z-docs-layout__toc-link" href={`#${t.id}`}>
            {t.label}
          </a>
        </li>
      ))}
    </ul>
  ) : null;
  return (
    <div className={cx("z-docs-layout", className)} data-toc={toc?.length ? "" : undefined} data-sidebar={sidebar ? "" : undefined}>
      <div className="z-docs-layout__grid">
        {header ? <div className="z-docs-layout__header">{header}</div> : null}
        {sidebar ? (
          <nav className="z-docs-layout__sidebar" aria-label={labels.nav}>
            {sidebar}
          </nav>
        ) : null}
        <div className="z-docs-layout__main">
          {tocList ? (
            <details className="z-docs-layout__toc-compact">
              <summary className="z-docs-layout__toc-summary">
                {labels.onThisPage}
                <Icon name="chevron-down" size={14} />
              </summary>
              {tocList}
            </details>
          ) : null}
          <article className="z-docs-layout__article">{children}</article>
          {previous || next ? (
            <nav className="z-docs-layout__pager" aria-label={labels.pager}>
              {previous ? (
                <a className="z-docs-layout__page" href={previous.href} rel="prev" data-dir="prev">
                  <span className="z-docs-layout__page-hint">
                    <Icon name="chevron-left" size={14} />
                    {labels.previous}
                  </span>
                  <span className="z-docs-layout__page-title">{previous.label}</span>
                </a>
              ) : (
                <span />
              )}
              {next ? (
                <a className="z-docs-layout__page" href={next.href} rel="next" data-dir="next">
                  <span className="z-docs-layout__page-hint">
                    {labels.next}
                    <Icon name="chevron-right" size={14} />
                  </span>
                  <span className="z-docs-layout__page-title">{next.label}</span>
                </a>
              ) : null}
            </nav>
          ) : null}
        </div>
        {tocList ? (
          <nav ref={tocRef} className="z-docs-layout__toc" aria-label={labels.toc}>
            <p className="z-docs-layout__toc-title" aria-hidden="true">
              {labels.toc}
            </p>
            {tocList}
          </nav>
        ) : null}
      </div>
    </div>
  );
}
