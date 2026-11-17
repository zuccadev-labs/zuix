import type { CSSProperties, HTMLAttributes } from "react";
import { cx } from "../../cx";

export interface SkeletonProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  /** Ancho y alto: número en px o cualquier longitud CSS. */
  width?: number | string;
  height?: number | string;
  variant?: "text" | "circular" | "rectangular" | "rounded";
  animation?: "pulse" | "wave" | "none";
  /** Con `variant="text"`: número de líneas; la última queda más corta. */
  lines?: number;
}

/** Marcador de posición mientras llega el contenido. Decorativo: el estado de carga lo anuncia el contenedor. */
export function Skeleton({ width, height, variant = "text", animation = "pulse", lines = 1, className, style, ...rest }: SkeletonProps) {
  const size: CSSProperties = { width, height };
  if (variant === "text" && lines > 1) {
    return (
      <span {...rest} className={cx("z-skeleton-lines", className)} style={{ ...style, width }} aria-hidden="true">
        {Array.from({ length: lines }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: líneas idénticas generadas a partir de un número; no hay más identidad que la posición.
          <span
            key={index}
            className="z-skeleton"
            data-variant="text"
            data-animation={animation}
            style={{ height, width: index === lines - 1 ? "60%" : undefined }}
          />
        ))}
      </span>
    );
  }
  return (
    <span
      {...rest}
      className={cx("z-skeleton", className)}
      data-variant={variant}
      data-animation={animation}
      style={{ ...style, ...size }}
      aria-hidden="true"
    />
  );
}
