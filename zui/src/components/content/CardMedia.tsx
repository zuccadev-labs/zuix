import type { HTMLAttributes, ReactNode, Ref } from "react";
import { cx } from "../../cx";
import { AspectRatio } from "./AspectRatio";

export interface CardMediaProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Imagen de la cabecera. Sin `src`, la media son los hijos (vídeo, mapa, ilustración). */
  src?: string;
  /** Texto alternativo; `""` si la imagen es decorativa. */
  alt?: string;
  /** Proporción de la media (`16 / 9`). */
  ratio?: number | string;
  /** `top`: a sangre en lo alto de la tarjeta, con el radio de la tarjeta; `inset`: dentro del relleno, con radio
   *  concéntrico. */
  placement?: "top" | "inset";
  /** Carga diferida de la imagen. */
  loading?: "lazy" | "eager";
  children?: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

/** Media de cabecera de una `Card` (imagen de producto, portada) sobre AspectRatio. */
export function CardMedia({
  src,
  alt = "",
  ratio = 16 / 9,
  placement = "top",
  loading = "lazy",
  className,
  children,
  ...rest
}: CardMediaProps) {
  return (
    <AspectRatio {...rest} ratio={ratio} className={cx("z-card__media", className)} data-placement={placement}>
      {src ? <img src={src} alt={alt} loading={loading} decoding="async" /> : children}
    </AspectRatio>
  );
}
