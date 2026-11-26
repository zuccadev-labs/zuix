import type { AnchorHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";

export interface CategoryTileProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "title"> {
  title: ReactNode;
  /** Cifra bajo el título (resultados, elementos). */
  count?: ReactNode;
  icon: IconName;
  /** Relleno de color pleno del tono, con texto claro. */
  tone?: "accent" | "info" | "success" | "warning" | "danger";
  href: string;
}

/** Mosaico de categoría: un enlace con relleno de color, icono en ficha, flecha y cifra. */
export function CategoryTile({ title, count, icon, tone = "accent", className, ...rest }: CategoryTileProps) {
  return (
    <a {...rest} className={cx("z-category-tile", className)} data-tone={tone}>
      <span className="z-category-tile__icon" aria-hidden="true">
        <Icon name={icon} size={18} />
      </span>
      <span className="z-category-tile__arrow" aria-hidden="true">
        <Icon name="arrow-up-right" size={14} />
      </span>
      <span className="z-category-tile__title">{title}</span>
      {count !== undefined ? <span className="z-category-tile__count">{count}</span> : null}
    </a>
  );
}
