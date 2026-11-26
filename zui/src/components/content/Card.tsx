import type { HTMLAttributes, Ref } from "react";
import { cx } from "../../cx";
import { withRef } from "../../react-compat";

/** Tono de una tarjeta: el de la marca, uno de estado o un color de la paleta de gráficos (1–8). */
export type CardTone = "accent" | "info" | "success" | "warning" | "danger" | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** `elevated` con sombra, `outlined` solo borde, `filled` fondo hundido. Solo con `surface="plain"`. */
  variant?: "elevated" | "outlined" | "filled";
  /**
   * Material: `plain` (la tarjeta sobria de siempre), `elevated` (opaca, con elevación por capas y canto luminoso),
   * `glass` (cristal líquido), `tinted` (teñida con el tono), `neon` (borde y halo del tono) o `metal` (relleno
   * pleno del tono con brillo cepillado; texto claro).
   */
  surface?: "plain" | "elevated" | "glass" | "tinted" | "neon" | "metal";
  /** Tono de `tinted`, `neon`, `metal` y del brillo. Por defecto, el acento de la marca. */
  tone?: CardTone;
  /** Halo suave del tono alrededor de la tarjeta. */
  glow?: boolean;
  /** Grano fino sobre la superficie (ruido SVG). */
  grain?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  /**
   * Respuesta visual al puntero y al foco. Con un enlace `.z-card__link` dentro (`CardHeader href`) toda la tarjeta
   * es su objetivo y el resto de controles sigue por encima; sin él, añade `onClick`, `role` y `tabIndex`.
   */
  interactive?: boolean;
  /** Elemento raíz. `article` cuando la tarjeta es una pieza de contenido independiente. */
  as?: "div" | "article" | "section" | "li";
  ref?: Ref<HTMLDivElement>;
}

/** Superficie que agrupa contenido relacionado. */
export const Card = withRef(function Card({
  variant = "elevated",
  surface = "plain",
  tone,
  glow,
  grain,
  padding = "md",
  interactive,
  as = "div",
  className,
  children,
  ref,
  ...rest
}: CardProps) {
  const Tag = as as "div";
  return (
    <Tag
      {...rest}
      ref={ref as never}
      className={cx("z-card", surface === "glass" && "z-liquid", className)}
      data-variant={variant}
      data-surface={surface === "plain" ? undefined : surface}
      data-tone={tone === undefined ? undefined : String(tone)}
      data-glow={glow || undefined}
      data-grain={grain || undefined}
      data-padding={padding}
      data-interactive={interactive || undefined}
    >
      {children}
    </Tag>
  );
});
