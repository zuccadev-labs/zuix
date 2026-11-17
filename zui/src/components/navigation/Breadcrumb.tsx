"use client";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";

export interface BreadcrumbItem {
  label: ReactNode;
  href?: string;
  icon?: IconName;
  onClick?: () => void;
}

export interface BreadcrumbProps {
  /** Del nivel más alto al actual; el último es la página actual. */
  items: BreadcrumbItem[];
  /** Nombre accesible de la navegación. */
  label?: string;
  className?: string;
}

export function Breadcrumb({ items, label = "Breadcrumb", className }: BreadcrumbProps) {
  const last = items.length - 1;
  return (
    <nav aria-label={label} className={cx("z-breadcrumb", className)}>
      <ol className="z-breadcrumb__list">
        {items.map((item, i) => {
          const body = (
            <>
              {item.icon ? <Icon name={item.icon} size={14} /> : null}
              <span className="z-breadcrumb__label">{item.label}</span>
            </>
          );
          const current = i === last;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: una miga es su nivel en la ruta; `label` puede ser un nodo y `href` puede faltar o repetirse.
            <li key={i} className="z-breadcrumb__item">
              {current ? (
                <span className="z-breadcrumb__current" aria-current="page">
                  {body}
                </span>
              ) : item.href ? (
                <a className="z-breadcrumb__link" href={item.href} onClick={item.onClick}>
                  {body}
                </a>
              ) : item.onClick ? (
                <button type="button" className="z-breadcrumb__link" onClick={item.onClick}>
                  {body}
                </button>
              ) : (
                <span className="z-breadcrumb__text">{body}</span>
              )}
              {current ? null : (
                <span className="z-breadcrumb__separator" aria-hidden="true">
                  <Icon name="chevron-right" size={12} />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
