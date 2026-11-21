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
  /** Muestra el porcentaje a la derecha (debajo, en vertical). */
  showValue?: boolean;
  /** `vertical`: la barra crece de abajo arriba y ocupa el alto del contenedor (mínimo 96 px). */
  orientation?: "horizontal" | "vertical";
  /** Divide la barra en tramos iguales separados (pasos, cuotas). Solo con valor. */
  segments?: number;
  /** Texto del valor para lectores de pantalla («3 of 5 steps»). */
  valueText?: string;
}

/** Claves estables de los tramos (el tramo n es siempre el mismo elemento). */
const SEGMENT_IDS = Array.from({ length: 100 }, (_, i) => `segment-${i + 1}`);
const pct = (n: number) => `${Math.round(n * 1000) / 1000}%`;

/** Barra de avance de una tarea, determinada o indeterminada, horizontal o vertical, continua o por tramos. */
export function Progress({
  value,
  max = 100,
  size = "md",
  tone = "accent",
  label,
  showValue,
  orientation = "horizontal",
  segments,
  valueText,
  className,
  ...rest
}: ProgressProps) {
  const determinate = typeof value === "number";
  const percent = determinate ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const count = determinate && segments !== undefined && segments > 1 ? Math.min(100, Math.floor(segments)) : 0;
  return (
    <div
      {...rest}
      className={cx("z-progress", className)}
      data-size={size}
      data-tone={tone}
      data-state={determinate ? (percent >= 100 ? "complete" : "loading") : "indeterminate"}
      data-orientation={orientation === "vertical" ? "vertical" : undefined}
      data-segments={count || undefined}
    >
      <div
        className="z-progress__track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={determinate ? value : undefined}
        aria-valuetext={determinate ? valueText : undefined}
      >
        {count ? (
          SEGMENT_IDS.slice(0, count).map((id, i) => {
            // Lo que llena cada tramo: entero, parcial (el que está en curso) o vacío.
            const share = Math.max(0, Math.min(1, (percent / 100) * count - i));
            return (
              <span key={id} className="z-progress__segment" data-filled={share >= 1 || undefined}>
                <span className="z-progress__fill" style={{ "--z-progress-value": pct(share * 100) } as CSSProperties} />
              </span>
            );
          })
        ) : (
          <div className="z-progress__fill" style={{ "--z-progress-value": `${percent}%` } as CSSProperties} />
        )}
      </div>
      {showValue && determinate ? <span className="z-progress__value">{Math.round(percent)}%</span> : null}
    </div>
  );
}
