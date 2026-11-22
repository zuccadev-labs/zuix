"use client";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { cx } from "../cx";
import { wireAppBar } from "../pages";

export interface AppBarProps {
  title: ReactNode;
  /** Línea bajo el título (en medium y large). */
  subtitle?: ReactNode;
  /** Botón al inicio (menú, atrás). */
  leading?: ReactNode;
  /** Acciones al final (IconButton, AccountMenu). */
  actions?: ReactNode;
  /** `small` una fila; `medium` y `large` con el título grande en una segunda fila. */
  size?: "small" | "medium" | "large";
  /** El título grande se pliega a la fila superior al desplazar. */
  collapseOnScroll?: boolean;
  /** Distancia de desplazamiento en px hasta plegarse del todo (96 por defecto). */
  collapseDistance?: number;
  /** Fija arriba al desplazar (por defecto). */
  sticky?: boolean;
  /** `glass` cristal (por defecto) o `plain` sin fondo hasta desplazar. */
  surface?: "glass" | "plain";
  /** Nivel del encabezado del título (1 por defecto). */
  headingLevel?: 1 | 2;
  className?: string;
  children?: ReactNode;
}

/**
 * Barra de aplicación superior (top app bar de Material 3): pequeña, mediana o grande; la grande pliega su título a la
 * fila superior al desplazar con una animación ligada al desplazamiento (y un respaldo que la reproduce donde no la
 * hay). Gana sombra y borde en cuanto hay algo desplazado.
 */
export function AppBar({
  title,
  subtitle,
  leading,
  actions,
  size = "small",
  collapseOnScroll,
  collapseDistance = 96,
  sticky = true,
  surface = "glass",
  headingLevel = 1,
  className,
  children,
}: AppBarProps) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => (ref.current ? wireAppBar(ref.current) : undefined), []);
  const H = `h${headingLevel}` as "h1";
  const big = size !== "small";
  return (
    <header
      ref={ref}
      className={cx("z-appbar", surface === "glass" && "z-liquid", className)}
      data-size={size}
      data-surface={surface}
      data-sticky={sticky ? "" : undefined}
      data-collapse={big && collapseOnScroll ? "" : undefined}
      data-collapse-distance={big && collapseOnScroll ? collapseDistance : undefined}
      style={big && collapseOnScroll ? ({ "--z-appbar-distance": `${collapseDistance}px` } as CSSProperties) : undefined}
    >
      <div className="z-appbar__row">
        {leading ? <div className="z-appbar__leading">{leading}</div> : null}
        {big ? (
          <span className="z-appbar__compact-title" aria-hidden="true">
            {title}
          </span>
        ) : (
          <H className="z-appbar__title">{title}</H>
        )}
        {actions ? <div className="z-appbar__actions">{actions}</div> : null}
      </div>
      {big ? (
        <div className="z-appbar__headline">
          <H className="z-appbar__title">{title}</H>
          {subtitle ? <p className="z-appbar__subtitle">{subtitle}</p> : null}
        </div>
      ) : null}
      {children ? <div className="z-appbar__extra">{children}</div> : null}
    </header>
  );
}
