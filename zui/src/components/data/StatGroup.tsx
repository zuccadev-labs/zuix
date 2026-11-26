import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../../cx";

export interface StatGroupItem {
  label: ReactNode;
  value: ReactNode;
  /** Nota bajo el valor. */
  hint?: ReactNode;
}

export interface StatGroupProps extends HTMLAttributes<HTMLDListElement> {
  items: readonly StatGroupItem[];
  /** `tiles`: una ficha por dato, en fila; `divided`: en fila con separadores; `plain`: sin marco. */
  variant?: "tiles" | "divided" | "plain";
  /** Alineación del texto de cada dato. */
  align?: "center" | "start";
  /** Clase de cada dato (para quien lo compone). */
  itemClassName?: string;
}

/** Datos en fila dentro de una tarjeta: etiqueta y valor (lista de descripción). */
export function StatGroup({ items, variant = "tiles", align = "center", itemClassName, className, ...rest }: StatGroupProps) {
  return (
    <dl {...rest} className={cx("z-stat-group", className)} data-variant={variant} data-align={align}>
      {items.map((item, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: los datos no tienen identidad propia y no se reordenan.
        <div key={i} className={cx("z-stat-group__item", itemClassName)}>
          <dt className="z-stat-group__label">{item.label}</dt>
          <dd className="z-stat-group__value">{item.value}</dd>
          {item.hint ? <dd className="z-stat-group__hint">{item.hint}</dd> : null}
        </div>
      ))}
    </dl>
  );
}
