"use client";
import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../cx";
import { popoverTarget } from "../react-compat";
import { wireNavbar } from "../site";
import { NavbarContext } from "./navbar-context";
import { NavigationMenu, type NavMenuItem } from "./NavigationMenu";

export interface NavbarProps {
  /** Logo y nombre; suele ser un enlace a la portada. */
  brand?: ReactNode;
  /** Enlaces y grupos con panel (los de NavigationMenu). */
  items?: NavMenuItem[];
  /** Acciones al final: búsqueda, tema, llamada a la acción. Quedan fuera del cajón. */
  actions?: ReactNode;
  /** `floating`: dos barras de cristal separadas; `dock`: una sola barra compacta centrada; `bar`: de borde a borde. */
  variant?: "floating" | "dock" | "bar";
  /** `sticky` (por defecto) se queda arriba al desplazar; `fixed` flota sobre la página; `static`, en su sitio. */
  position?: "sticky" | "fixed" | "static";
  /** Nombre del landmark de navegación. */
  label?: string;
  /** Texto del botón de menú (estrecho). */
  menuLabel?: string;
  /** Nombre del botón que cierra el cajón. */
  closeLabel?: string;
  /** Prefijo de los id internos (paneles, cajón); por defecto, uno generado. */
  id?: string;
  className?: string;
}

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect;

/**
 * Barra de navegación de un sitio, de cristal. Sin punto de corte fijo: si la fila entera no cabe, los enlaces
 * pasan a un cajón (popover nativo) que abre el botón de menú. Sin JavaScript, el cajón es el modo por defecto.
 */
export function Navbar({
  brand,
  items = [],
  actions,
  variant = "floating",
  position = "sticky",
  label = "Primary",
  menuLabel = "Menu",
  closeLabel = "Close menu",
  className,
  id: idProp,
}: NavbarProps) {
  const generated = useId();
  const id = idProp ?? generated;
  const menuId = `${id}-menu`;
  const ref = useRef<HTMLElement>(null);
  useIsoLayoutEffect(() => (ref.current ? wireNavbar(ref.current) : undefined), []);
  return (
    <header ref={ref} className={cx("z-navbar", className)} data-variant={variant} data-position={position} data-collapsed="">
      <div className="z-navbar__inner">
        <div className="z-navbar__bar z-navbar__main">
          {brand ? <div className="z-navbar__brand">{brand}</div> : null}
          <nav className="z-navbar__nav" aria-label={label}>
            <button type="button" className="z-navbar__toggle" aria-expanded="false" aria-controls={menuId} {...popoverTarget(menuId)}>
              <Icon name="bars-3" size={18} />
              <span className="z-navbar__toggle-label">{menuLabel}</span>
            </button>
            <div id={menuId} className="z-navbar__menu" popover="auto">
              <div className="z-navbar__drawer-head">
                <span className="z-navbar__drawer-title">{menuLabel}</span>
                <button type="button" className="z-navbar__close" {...popoverTarget(menuId, "hide")} aria-label={closeLabel}>
                  <Icon name="x-mark" size={18} />
                </button>
              </div>
              <NavbarContext.Provider value={{ embedded: true }}>
                <NavigationMenu items={items} id={`${id}-nav`} />
              </NavbarContext.Provider>
            </div>
          </nav>
        </div>
        {actions ? <div className="z-navbar__bar z-navbar__actions">{actions}</div> : null}
      </div>
    </header>
  );
}
