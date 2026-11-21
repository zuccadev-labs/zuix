"use client";
import { useState, type CSSProperties, type HTMLAttributes, type ReactNode, type Ref } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";

export interface MarqueeProps extends HTMLAttributes<HTMLDivElement> {
  /** Nombre de la región (lo que desfila). */
  label: string;
  /** Segundos por vuelta. */
  duration?: number;
  orientation?: "horizontal" | "vertical";
  reverse?: boolean;
  /** Se detiene al pasar el puntero o enfocar dentro (por defecto, sí). */
  pauseOnHover?: boolean;
  /** Difumina los bordes. */
  fade?: boolean;
  /** Separación entre elementos y entre copias (cualquier longitud CSS). */
  gap?: string;
  /** Copias del contenido para llenar el ancho (2 bastan si el contenido ocupa al menos el ancho visible). */
  repeat?: number;
  /** Botón visible de pausa (WCAG 2.2.2). */
  showControl?: boolean;
  pauseLabel?: string;
  playLabel?: string;
  defaultPaused?: boolean;
  children?: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Cinta que desfila sin fin: copias del contenido (solo la primera para los lectores de pantalla; las demás `inert`
 * y `aria-hidden`), pausa al pasar o enfocar y botón de pausa visible. Con `prefers-reduced-motion` no se mueve.
 */
export function Marquee({
  label,
  duration = 30,
  orientation = "horizontal",
  reverse,
  pauseOnHover = true,
  fade = true,
  gap,
  repeat = 2,
  showControl = true,
  pauseLabel = "Pause",
  playLabel = "Play",
  defaultPaused = false,
  className,
  style,
  children,
  ref,
  ...rest
}: MarqueeProps) {
  const [paused, setPaused] = useState(defaultPaused);
  const vars = { ...style, "--z-marquee-duration": `${duration}s`, ...(gap ? { "--z-marquee-gap": gap } : {}) } as CSSProperties;
  return (
    <div
      role="region"
      aria-label={label}
      {...rest}
      ref={ref}
      className={cx("z-marquee", className)}
      data-orientation={orientation}
      data-reverse={reverse ? "" : undefined}
      data-pause-on-hover={pauseOnHover ? "" : undefined}
      data-fade={fade ? "" : undefined}
      data-paused={paused ? "" : undefined}
      style={vars}
    >
      <div className="z-marquee__viewport">
        <div className="z-marquee__track">
          {Array.from({ length: Math.max(2, repeat) }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: copias fijas del mismo contenido.
            <div key={i} className="z-marquee__group" aria-hidden={i > 0 ? true : undefined} inert={i > 0 ? true : undefined}>
              {children}
            </div>
          ))}
        </div>
      </div>
      {showControl ? (
        <button
          type="button"
          className="z-marquee__control"
          data-pause-label={pauseLabel}
          data-play-label={playLabel}
          onClick={() => setPaused((p) => !p)}
        >
          <Icon name={paused ? "play" : "pause"} size={14} />
          <span className="z-sr-only">{paused ? playLabel : pauseLabel}</span>
        </button>
      ) : null}
    </div>
  );
}
