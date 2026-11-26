import type { HTMLAttributes, ReactNode, Ref } from "react";
import { cx } from "../../cx";
import { AspectRatio } from "./AspectRatio";
import { withRef } from "../../react-compat";

export interface CardMediaProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Imagen de la cabecera. Sin `src`, la media son los hijos (vídeo, mapa, ilustración). */
  src?: string;
  /** Texto alternativo; `""` si la imagen es decorativa. */
  alt?: string;
  /** Proporción de la media (`16 / 9`). */
  ratio?: number | string;
  /** `top`: a sangre en lo alto de la tarjeta, con el radio de la tarjeta; `inset`: dentro del relleno, con radio
   *  concéntrico; `bleed`: cubre la tarjeta entera y el contenido va encima, abajo, sobre el fundido. */
  placement?: "top" | "inset" | "bleed";
  /**
   * Fundido de legibilidad: `bottom` oscurece la parte de abajo hasta la densidad que da 4.5:1 al texto claro sobre
   * cualquier imagen; `full` vela la imagen entera. Con `bleed`, `bottom` por defecto.
   */
  scrim?: "none" | "bottom" | "full";
  /** Tiñe el fundido con el tono de la tarjeta (la imagen se funde hacia su color dominante). */
  tint?: boolean;
  /** Carga diferida de la imagen. */
  loading?: "lazy" | "eager";
  children?: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

/** Media de cabecera de una `Card` (imagen de producto, portada) sobre AspectRatio. */
export const CardMedia = withRef(function CardMedia({
  src,
  alt = "",
  ratio = 16 / 9,
  placement = "top",
  scrim,
  tint,
  loading = "lazy",
  className,
  children,
  ...rest
}: CardMediaProps) {
  return (
    <AspectRatio {...rest} ratio={ratio} className={cx("z-card__media", className)}
      data-placement={placement}
      data-scrim={(scrim ?? (placement === "bleed" ? "bottom" : "none")) === "none" ? undefined : (scrim ?? "bottom")}
      data-tint={tint || undefined}
    >
      {src ? <img src={src} alt={alt} loading={loading} decoding="async" /> : children}
    </AspectRatio>
  );
});
