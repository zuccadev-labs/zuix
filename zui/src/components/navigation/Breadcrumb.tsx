"use client";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";
import { Menu } from "../overlay/Menu";

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
  /** Con más migas que esto, las del medio pasan a un menú «…». */
  maxItems?: number;
  /** Migas visibles antes del menú al colapsar. */
  itemsBeforeCollapse?: number;
  /** Migas visibles después del menú al colapsar (la actual incluida). */
  itemsAfterCollapse?: number;
  /** Nombre accesible del botón «…». */
  collapsedLabel?: string;
  /** Separador propio (texto o nodo); por defecto, un chevrón. */
  separator?: ReactNode;
  className?: string;
}

export function Breadcrumb({
  items,
  label = "Breadcrumb",
  maxItems,
  itemsBeforeCollapse = 1,
  itemsAfterCollapse = 1,
  collapsedLabel = "Show more breadcrumbs",
  separator,
  className,
}: BreadcrumbProps) {
  const last = items.length - 1;
  const before = Math.max(0, itemsBeforeCollapse);
  const after = Math.max(1, itemsAfterCollapse);
  const collapse = maxItems !== undefined && items.length > maxItems && before + after < items.length;
  const hidden = collapse ? items.slice(before, items.length - after) : [];
  const sep = (
    <span className="z-breadcrumb__separator" aria-hidden="true" data-custom={separator !== undefined || undefined}>
      {separator ?? <Icon name="chevron-right" size={12} />}
    </span>
  );
  const more = collapse ? (
    <li key="collapsed" className="z-breadcrumb__item" data-collapsed="">
      <Menu
        label={collapsedLabel}
        align="start"
        trigger={
          <button type="button" className="z-breadcrumb__more" aria-label={collapsedLabel}>
            <Icon name="ellipsis-horizontal" size={14} />
          </button>
        }
        items={hidden.map((item, i) => ({
          id: `crumb-${before + i}`,
          label: item.label,
          icon: item.icon,
          onSelect: () => {
            if (item.onClick) item.onClick();
            else if (item.href) window.location.assign(item.href);
          },
        }))}
      />
      {sep}
    </li>
  ) : null;
  return (
    <nav aria-label={label} className={cx("z-breadcrumb", className)}>
      <ol className="z-breadcrumb__list">
        {items.map((item, i) => {
          if (collapse && i >= before && i < items.length - after) return i === before ? more : null;
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
              {current ? null : sep}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
