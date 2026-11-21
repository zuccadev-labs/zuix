"use client";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../cx";

export interface BottomNavItem {
  /** Identificador; sin `href`, la entrada es un botón y lo recibe `onValueChange`. */
  value: string;
  label: string;
  icon: IconName;
  /** Enlace de destino. */
  href?: string;
  /** Contador o marca sobre el icono. */
  badge?: ReactNode;
  /** Texto para lectores de la insignia (p. ej. «3 unread»). */
  badgeLabel?: string;
}

export interface BottomNavigationProps {
  items: BottomNavItem[];
  /** Entrada actual (`aria-current="page"`). */
  value?: string;
  onValueChange?: (value: string) => void;
  /** Etiquetas siempre visibles, solo la actual o ninguna (quedan para los lectores de pantalla). */
  labels?: "always" | "active" | "none";
  /** `floating`: barra de cristal separada de los bordes; `bar`: de borde a borde. */
  variant?: "floating" | "bar";
  /** `fixed` (por defecto) pegada abajo, respetando la zona segura; `static`, en su sitio. */
  position?: "fixed" | "static";
  label?: string;
  className?: string;
}

/** Navegación principal de móvil: de tres a cinco destinos con icono y etiqueta, abajo y al alcance del pulgar. */
export function BottomNavigation({
  items,
  value,
  onValueChange,
  labels = "always",
  variant = "floating",
  position = "fixed",
  label = "Primary",
  className,
}: BottomNavigationProps) {
  return (
    <nav className={cx("z-bottomnav", className)} aria-label={label} data-labels={labels} data-variant={variant} data-position={position}>
      <ul className="z-bottomnav__list">
        {items.map((item) => {
          const current = item.value === value;
          const body = (
            <>
              <span className="z-bottomnav__icon">
                <Icon name={item.icon} size={22} />
                {item.badge !== undefined ? (
                  <span className="z-bottomnav__badge" aria-hidden={item.badgeLabel ? true : undefined}>
                    {item.badge}
                  </span>
                ) : null}
              </span>
              <span className="z-bottomnav__label">{item.label}</span>
              {item.badgeLabel ? <span className="z-sr-only">{`, ${item.badgeLabel}`}</span> : null}
            </>
          );
          return (
            <li key={item.value}>
              {item.href ? (
                <a className="z-bottomnav__item" href={item.href} data-value={item.value} aria-current={current ? "page" : undefined}>
                  {body}
                </a>
              ) : (
                <button
                  type="button"
                  className="z-bottomnav__item"
                  data-value={item.value}
                  aria-current={current ? "page" : undefined}
                  onClick={() => onValueChange?.(item.value)}
                >
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
