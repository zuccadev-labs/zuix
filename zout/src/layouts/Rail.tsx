import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../cx";

export interface RailProps {
  /** Logo o marca, arriba. */
  brand?: ReactNode;
  /** Elementos principales (RailItem). */
  children: ReactNode;
  /** Elementos al pie (ajustes, cuenta). */
  footer?: ReactNode;
  label?: string;
  className?: string;
}

/** Barra estrecha de navegación principal. Origen: rail de zutool. */
export function Rail({ brand, children, footer, label = "Primary", className }: RailProps) {
  return (
    <nav className={cx("z-rail z-liquid", className)} aria-label={label}>
      {brand ? <div className="z-rail__brand">{brand}</div> : null}
      <div className="z-rail__items">{children}</div>
      {footer ? <div className="z-rail__footer">{footer}</div> : null}
    </nav>
  );
}

export interface RailItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  /** Nombre accesible; el elemento solo muestra el icono. */
  label: string;
  active?: boolean;
  /** Contador sobre el icono. */
  badge?: number | string;
}

export function RailItem({ icon, label, active, badge, className, ...rest }: RailItemProps) {
  return (
    // El contador se ve: tiene que formar parte del nombre accesible, no quedarse fuera de él.
    <button
      type="button"
      {...rest}
      className={cx("z-rail__item", className)}
      aria-label={badge !== undefined ? `${label}, ${badge}` : label}
      title={label}
      aria-current={active ? "page" : undefined}
    >
      <Icon name={icon} variant={active ? "solid" : "outline"} size={20} />
      {badge !== undefined ? (
        <span className="z-rail__badge" aria-hidden="true">
          {badge}
        </span>
      ) : null}
    </button>
  );
}
