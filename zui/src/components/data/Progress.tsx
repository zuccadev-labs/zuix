import type { CSSProperties, HTMLAttributes } from "react";
import { cx } from "../../cx";
import type { Tone } from "../actions/types";

export interface ProgressProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Avance actual. Sin valor, la barra es indeterminada. */
  value?: number | null;
  max?: number;
  size?: "sm" | "md" | "lg";
  tone?: Exclude<Tone, "neutral">;
  /** Nombre accesible. */
  label: string;
  /** Muestra el porcentaje a la derecha. */
  showValue?: boolean;
}

/** Barra de avance de una tarea, determinada o indeterminada. */
export function Progress({ value, max = 100, size = "md", tone = "accent", label, showValue, className, ...rest }: ProgressProps) {
  const determinate = typeof value === "number";
  const percent = determinate ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div {...rest} className={cx("z-progress", className)} data-size={size} data-tone={tone} data-state={determinate ? (percent >= 100 ? "complete" : "loading") : "indeterminate"}>
      <div className="z-progress__track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={determinate ? value : undefined}>
        <div className="z-progress__fill" style={{ "--z-progress-value": `${percent}%` } as CSSProperties} />
      </div>
      {showValue && determinate ? <span className="z-progress__value">{Math.round(percent)}%</span> : null}
    </div>
  );
}
