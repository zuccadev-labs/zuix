"use client";
import { useContext, useEffect, useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../cx";
import { popoverTarget } from "../react-compat";
import { syncNavMenu, wireNavMenu } from "../site";
import { NavbarContext } from "./navbar-context";

/** Enlace de un panel: título, descripción opcional e icono en baldosa. */
export interface NavMenuLink {
  label: string;
  href: string;
  description?: string;
  icon?: IconName;
  /** Página actual (`aria-current="page"`). */
  current?: boolean;
}

/** Entrada de primer nivel: un enlace o un grupo con su panel. */
export type NavMenuItem =
  | { label: string; href: string; current?: boolean }
  | {
      label: string;
      /** Enlaces del panel. */
      links: NavMenuLink[];
      /** Columnas del panel (1–3). */
      columns?: 1 | 2 | 3;
      /** Pie del panel (un enlace «ver todo», un aviso). */
      footer?: ReactNode;
    };

export interface NavigationMenuProps {
  items: NavMenuItem[];
  /** Nombre del landmark de navegación. */
  label?: string;
  /** Horizontal: paneles flotantes. Vertical: grupos que se despliegan en su sitio (cajón, barra lateral). */
  orientation?: "horizontal" | "vertical";
  /** Prefijo de los id internos (paneles, cajón); por defecto, uno generado. */
  id?: string;
  className?: string;
}

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect;

/**
 * Menús de sitio con paneles (patrón disclosure de navegación, no menú de aplicación): enlaces y grupos cuyo botón
 * abre un panel de enlaces con descripción. Horizontal, el panel flota (popover nativo, se abre también sin
 * JavaScript); vertical, se despliega en su sitio.
 */
export function NavigationMenu({ items, label = "Main", orientation = "horizontal", className, id: idProp }: NavigationMenuProps) {
  const generated = useId();
  const id = idProp ?? generated;
  const ref = useRef<HTMLElement | null>(null);
  const embedded = useContext(NavbarContext)?.embedded ?? false;
  useEffect(() => (ref.current && !embedded ? wireNavMenu(ref.current) : undefined), [embedded]);
  // Tras cada render (grupos nuevos), el modo de cada panel vuelve a ser el de la orientación.
  useIsoLayoutEffect(() => {
    if (ref.current && !embedded) syncNavMenu(ref.current);
  });
  const Tag = embedded ? "div" : "nav";
  const horizontal = embedded ? false : orientation === "horizontal";
  return (
    <Tag
      ref={(node: HTMLElement | null) => {
        ref.current = node;
      }}
      className={cx("z-navmenu", className)}
      aria-label={embedded ? undefined : label}
      data-orientation={embedded ? "vertical" : orientation}
    >
      <ul className="z-navmenu__list">
        {items.map((item, i) => {
          if ("href" in item)
            return (
              <li key={item.label} className="z-navmenu__item">
                <a className="z-navmenu__link" href={item.href} aria-current={item.current ? "page" : undefined}>
                  {item.label}
                </a>
              </li>
            );
          const panelId = `${id}-p${i}`;
          const current = item.links.some((l) => l.current);
          return (
            <li key={item.label} className="z-navmenu__item">
              <button
                type="button"
                className="z-navmenu__trigger"
                aria-expanded="false"
                aria-controls={panelId}
                data-current={current ? "" : undefined}
                {...(horizontal ? popoverTarget(panelId) : {})}
              >
                {item.label}
                <Icon name="chevron-down-small" size={16} className="z-navmenu__chevron" />
              </button>
              <div id={panelId} className="z-navmenu__panel" popover={horizontal ? "auto" : undefined}>
                <ul className="z-navmenu__grid" data-columns={item.columns ?? (item.links.length > 3 ? 2 : 1)}>
                  {item.links.map((l) => (
                    <li key={l.href}>
                      <a className="z-navmenu__card" href={l.href} aria-current={l.current ? "page" : undefined}>
                        {l.icon ? (
                          <span className="z-navmenu__icon">
                            <Icon name={l.icon} size={16} />
                          </span>
                        ) : null}
                        <span className="z-navmenu__text">
                          <span className="z-navmenu__title">{l.label}</span>
                          {l.description ? <span className="z-navmenu__desc">{l.description}</span> : null}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
                {item.footer ? <div className="z-navmenu__footer">{item.footer}</div> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </Tag>
  );
}
