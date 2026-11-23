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
  ref?: Ref<HTMLDivElement>;
}

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
  } as CSSProperties;
  const center = children ?? (showValue && determinate ? `${Math.round(percent)}%` : null);
  return (
    <div
      {...rest}
      className={cx("z-progress-ring", className)}
      data-size={size}
      data-tone={tone}
      data-state={determinate ? (percent >= 100 ? "complete" : "loading") : "indeterminate"}
      style={vars}
    >
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
