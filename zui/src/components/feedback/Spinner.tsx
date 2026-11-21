import type { HTMLAttributes } from "react";
import { cx } from "../../cx";

export interface SpinnerProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  size?: "sm" | "md" | "lg";
  /** `current` hereda el color del texto que lo rodea. */
  tone?: "accent" | "muted" | "current";
  /** Forma: anillo giratorio, tres puntos que laten o cuatro barras que suben y bajan. */
  shape?: "ring" | "dots" | "bars";
  /** Nombre accesible. Vacío ("") lo vuelve decorativo. */
  label?: string;
}

const PARTS = { ring: 0, dots: 3, bars: 4 } as const;

/** Indicador de espera de duración desconocida: anillo, puntos o barras. */
export function Spinner({ size = "md", tone = "accent", shape = "ring", label = "Loading", className, ...rest }: SpinnerProps) {
  const parts = PARTS[shape] ?? 0;
  return (
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-label solo se emite junto a role="status"; sin etiqueta el indicador es decorativo y va con aria-hidden.
    <span
      {...rest}
      className={cx("z-spinner", className)}
      data-size={size}
      data-tone={tone}
      data-shape={parts ? shape : undefined}
      role={label ? "status" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
    >
      {parts
        ? Array.from({ length: parts }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: partes fijas del dibujo, sin identidad propia.
            <span key={i} className="z-spinner__part" />
          ))
        : null}
    </span>
  );
}
