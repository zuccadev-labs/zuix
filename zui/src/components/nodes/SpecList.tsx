import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { colorVar } from "../../core/diagram";
import { cx } from "../../cx";
import { withRef } from "../../react-compat";

export interface SpecItem {
  /** Tipo («CPU», «Memory», «SSD»). Va en versalitas, encima. */
  label?: ReactNode;
  /** La pieza («Ryzen 9», «64 GB DDR5»). */
  value: ReactNode;
  /** Detalle («12 cores · 24 threads», «passthrough → NAS»). */
  note?: ReactNode;
  icon?: IconName;
  /** Marca de color al inicio: tono de la suite. */
  tone?: "accent" | "success" | "warning" | "danger" | "info";
  /** Marca de color libre: token (`chart-3`) o color de la aplicación (el de una VLAN). Gana a `tone`. */
  color?: string;
}

export interface SpecListProps extends Omit<HTMLAttributes<HTMLUListElement>, "children" | "title"> {
  items: SpecItem[];
  /** Columnas mínimas por ancho: `1` apila, `auto` reparte (por defecto). */
  columns?: 1 | 2 | 3 | "auto";
  /** Título de la lista (encabezado en versalitas). */
  title?: ReactNode;
  ref?: Ref<HTMLUListElement>;
}

/**
 * Lista de especificaciones en losetas: tipo, pieza y detalle, con icono opcional. Sirve para el hardware de un
 * servidor, los servicios de un router o cualquier ficha técnica corta.
 */
export const SpecList = withRef(function SpecList({ items, columns = "auto", title, className, ref, ...rest }: SpecListProps) {
  const list = (
    <ul {...rest} ref={ref} className={cx("z-spec-list", className)} data-columns={columns !== "auto" ? String(columns) : undefined}>
      {items.map((it, i) => (
        <li
          // biome-ignore lint/suspicious/noArrayIndexKey: losetas fijas sin estado, en el orden en que llegan.
          key={i}
          className="z-spec"
          data-tone={it.tone}
          style={colorVar(it.color) ? ({ "--z-spec-color": colorVar(it.color) } as CSSProperties) : undefined}
        >
          {it.icon ? (
            <span className="z-spec__icon" aria-hidden="true">
              <Icon name={it.icon} size={18} />
            </span>
          ) : null}
          <span className="z-spec__text">
            {it.label ? <span className="z-spec__label">{it.label}</span> : null}
            <span className="z-spec__value">{it.value}</span>
            {it.note ? <span className="z-spec__note">{it.note}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
  if (!title) return list;
  return (
    <div className="z-spec-group">
      <span className="z-spec-group__title">{title}</span>
      {list}
    </div>
  );
});
