import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from "react";
import { cx } from "../../cx";
import type { Tone } from "../actions/types";
import { withRef } from "../../react-compat";

export interface CircularProgressProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Avance actual. Sin valor, el anillo es indeterminado (gira). */
  value?: number | null;
  max?: number;
  /** Nombre accesible del `<progress>`. */
  label: string;
  size?: "sm" | "md" | "lg" | "xl";
  /** Grosor del anillo en px (por defecto, según el tamaño). */
  thickness?: number;
  tone?: Exclude<Tone, "neutral">;
  /** Porcentaje en el centro. */
  showValue?: boolean;
  /** Contenido propio en el centro (oculto a los lectores: el valor ya lo da el `<progress>`). */
  children?: ReactNode;
  /** Texto del valor para lectores cuando el centro lo muestra de otra forma («3 of 5 files»). */
  valueText?: string;
  /**
   * `wavy`: el arco hecho es una onda (Material 3 Expressive) y lo que falta, un anillo plano separado por un hueco.
   * Indeterminado, gira; con movimiento reducido, más despacio.
   */
  variant?: "flat" | "wavy";
  ref?: Ref<HTMLDivElement>;
}

/** Diámetro de cada talla, en px (el de `--z-ring-size` en la hoja). */
const RING_PX = { sm: 24, md: 40, lg: 64, xl: 96 } as const;

/** Contorno ondulado del anillo en un lienzo de 100 × 100: radio 40 ± 2,2, doce ondas, desde las 12 en punto. */
const WAVE_PATH = (() => {
  const points: string[] = [];
  for (let i = 0; i <= 192; i++) {
    const a = (i / 192) * Math.PI * 2;
    const r = 40 + 2.2 * Math.sin(a * 12);
    points.push(`${(50 + r * Math.sin(a)).toFixed(2)} ${(50 - r * Math.cos(a)).toFixed(2)}`);
  }
  return `M${points.join("L")}Z`;
})();

/**
 * Anillo de avance sobre un `<progress>` nativo: el anillo es un degradado cónico recortado con una máscara, el valor
 * va en `--z-ring-value` y el centro admite el porcentaje o contenido propio.
 */
export const CircularProgress = withRef(function CircularProgress({
  value,
  max = 100,
  label,
  size = "md",
  thickness,
  tone = "accent",
  showValue,
  children,
  valueText,
  variant = "flat",
  className,
  style,
  ...rest
}: CircularProgressProps) {
  const determinate = typeof value === "number";
  const percent = determinate ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const vars = {
    ...style,
    "--z-ring-value": Math.round(percent * 100) / 100,
    ...(thickness !== undefined ? { "--z-ring-thickness": `${thickness}px` } : {}),
    // El SVG ondulado mide 100 unidades: el grosor propio, a escala del tamaño del anillo.
    ...(thickness !== undefined && variant === "wavy"
      ? { "--z-ring-stroke": Math.round((thickness / RING_PX[size]) * 100 * 1000) / 1000 }
      : {}),
  } as CSSProperties;
  const center = children ?? (showValue && determinate ? `${Math.round(percent)}%` : null);
  return (
    <div
      {...rest}
      className={cx("z-progress-ring", className)}
      data-size={size}
      data-tone={tone}
      data-state={determinate ? (percent >= 100 ? "complete" : "loading") : "indeterminate"}
      data-variant={variant === "wavy" ? "wavy" : undefined}
      style={vars}
    >
      {variant === "wavy" ? (
        <svg className="z-progress-ring__wave" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
          <circle className="z-progress-ring__rest" cx="50" cy="50" r="40" pathLength={100} />
          <path className="z-progress-ring__arc" d={WAVE_PATH} pathLength={100} />
        </svg>
      ) : null}
      <progress
        className="z-progress-ring__bar"
        aria-label={label}
        max={max}
        value={determinate ? Math.max(0, Math.min(max, value)) : undefined}
        aria-valuetext={determinate ? valueText : undefined}
      />
      {center !== null && center !== undefined ? (
        <span className="z-progress-ring__content" aria-hidden="true">
          {center}
        </span>
      ) : null}
    </div>
  );
});
