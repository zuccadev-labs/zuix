import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cx } from "../../cx";

export interface ImageListItem {
  src: string;
  alt: string;
  /** Título en la barra sobre la imagen. */
  title?: string;
  subtitle?: string;
  /** Columnas y filas que ocupa (variante `quilted`). */
  cols?: number;
  rows?: number;
  /** Ancho y alto intrínsecos (evitan el salto al cargar). */
  width?: number;
  height?: number;
  href?: string;
}

export interface ImageListProps extends Omit<HTMLAttributes<HTMLUListElement>, "children"> {
  items: readonly ImageListItem[];
  /** `standard` rejilla regular, `quilted` piezas de distinto tamaño, `woven` alturas alternas, `masonry` columnas sin huecos. */
  variant?: "standard" | "quilted" | "woven" | "masonry";
  /** Columnas en anchos medios y grandes (en estrecho, la mitad). */
  columns?: number;
  /** Alto de fila en px (standard, quilted y woven). */
  rowHeight?: number;
  /** Barra del título bajo la imagen en vez de encima. */
  captionBelow?: boolean;
  /** Nombre de la lista. */
  label?: string;
  /** Acción de cada imagen (un botón de favorito). */
  renderAction?: (item: ImageListItem, index: number) => ReactNode;
}

/**
 * Lista de imágenes (Image list de Material y MUI): rejilla regular, acolchada, tejida o en mampostería, con título
 * opcional. Es una lista; cada imagen lleva su texto alternativo y las de carga diferida su tamaño.
 */
export function ImageList({
  items,
  variant = "standard",
  columns = 3,
  rowHeight = 164,
  captionBelow,
  label,
  renderAction,
  className,
  style,
  ...rest
}: ImageListProps) {
  return (
    <ul
      {...rest}
      aria-label={label}
      className={cx("z-image-list", className)}
      data-variant={variant}
      data-caption={captionBelow ? "below" : undefined}
      style={{ ...style, "--z-image-cols": columns, "--z-image-row": `${rowHeight}px` } as CSSProperties}
    >
      {items.map((item, i) => {
        const img = (
          <img
            className="z-image-list__image"
            src={item.src}
            alt={item.alt}
            width={item.width}
            height={item.height}
            loading="lazy"
            decoding="async"
          />
        );
        return (
          <li
            key={item.src}
            className="z-image-list__item"
            style={
              variant === "quilted"
                ? ({ "--z-image-span-c": item.cols ?? 1, "--z-image-span-r": item.rows ?? 1 } as CSSProperties)
                : undefined
            }
          >
            {item.href ? (
              <a className="z-image-list__link" href={item.href}>
                {img}
              </a>
            ) : (
              img
            )}
            {item.title || renderAction ? (
              <div className="z-image-list__bar">
                <span className="z-image-list__text">
                  {item.title ? <span className="z-image-list__title">{item.title}</span> : null}
                  {item.subtitle ? <span className="z-image-list__subtitle">{item.subtitle}</span> : null}
                </span>
                {renderAction ? <span className="z-image-list__action">{renderAction(item, i)}</span> : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
