import type { HTMLAttributes, ReactNode, Ref } from "react";
import { cx } from "../../cx";
import { withRef } from "../../react-compat";

export interface DescriptionItem {
  /** Término (`<dt>`). */
  term: ReactNode;
  /** Descripción (`<dd>`). */
  description: ReactNode;
  /** Aclaración bajo el término. */
  info?: ReactNode;
  /** Clave estable (por defecto, la posición). */
  key?: string | number;
}

export interface DescriptionListProps extends HTMLAttributes<HTMLDListElement> {
  items?: ReadonlyArray<DescriptionItem>;
  /** `horizontal`: término y descripción en una fila (en estrecho, uno sobre otro). `vertical`: siempre apilados. */
  orientation?: "horizontal" | "vertical";
  /** Línea entre pares. */
  divided?: boolean;
  size?: "sm" | "md";
  /** Ancho de la columna de términos en horizontal (cualquier longitud CSS). */
  termWidth?: string;
  ref?: Ref<HTMLDListElement>;
  /** Pares propios: `<div className="z-dl__item"><dt>…</dt><dd>…</dd></div>`. */
  children?: ReactNode;
}

/** Lista de pares término–descripción (`<dl>`): propiedades, metadatos, resumen de una ficha. */
export const DescriptionList = withRef(function DescriptionList({
  items,
  orientation = "horizontal",
  divided,
  size = "md",
  termWidth,
  className,
  style,
  children,
  ...rest
}: DescriptionListProps) {
  return (
    <dl
      {...rest}
      className={cx("z-dl", className)}
      data-orientation={orientation}
      data-divided={divided || undefined}
      data-size={size}
      style={termWidth ? ({ ...style, "--z-dl-term": termWidth } as HTMLAttributes<HTMLDListElement>["style"]) : style}
    >
      {items?.map((item, index) => (
        <div key={item.key ?? index} className="z-dl__item">
          <dt className="z-dl__term">
            {item.term}
            {item.info ? <span className="z-dl__info">{item.info}</span> : null}
          </dt>
          <dd className="z-dl__description">{item.description}</dd>
        </div>
      ))}
      {children}
    </dl>
  );
});
