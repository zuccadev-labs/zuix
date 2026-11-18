import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cx } from "../../cx";
import type { Tone } from "../actions/types";

export interface MeterProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  value: number;
  min?: number;
  max?: number;
  /** Nombre accesible; también se muestra sobre la barra si `showLabel`. */
  label: string;
  showLabel?: boolean;
  /** Texto del valor (por ejemplo "32 GB of 64 GB"). */
  valueLabel?: ReactNode;
  /** Rótulos de los extremos de la escala. */
  startLabel?: ReactNode;
  endLabel?: ReactNode;
  /** Tono fijo. Sin él se deduce de `warningAt` y `dangerAt`. */
  tone?: Exclude<Tone, "neutral">;
  /** Umbrales (en unidades de `value`) a partir de los cuales cambia el tono. */
  warningAt?: number;
  dangerAt?: number;
  size?: "sm" | "md";
}

/** Medidor de una magnitud dentro de un rango conocido (uso de disco, cuota, nivel). */
export function Meter({
  value,
  min = 0,
  max = 100,
  label,
  showLabel,
  valueLabel,
  startLabel,
  endLabel,
  tone,
  warningAt,
  dangerAt,
  size = "md",
  className,
  ...rest
}: MeterProps) {
  const span = max - min || 1;
  const percent = Math.max(0, Math.min(100, ((value - min) / span) * 100));
  const resolved =
    tone ?? (dangerAt !== undefined && value >= dangerAt ? "danger" : warningAt !== undefined && value >= warningAt ? "warning" : "accent");
  return (
    <div {...rest} className={cx("z-meter", className)} data-size={size} data-tone={resolved}>
      {showLabel || valueLabel ? (
        <div className="z-meter__head">
          {showLabel ? <span className="z-meter__label">{label}</span> : <span />}
          {valueLabel ? <span className="z-meter__value">{valueLabel}</span> : null}
        </div>
      ) : null}
      <div
        className="z-meter__track"
        role="meter"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={typeof valueLabel === "string" ? valueLabel : undefined}
      >
        <div className="z-meter__fill" style={{ "--z-meter-value": `${percent}%` } as CSSProperties} />
      </div>
      {startLabel || endLabel ? (
        <div className="z-meter__scale" aria-hidden="true">
          <span>{startLabel}</span>
          <span>{endLabel}</span>
        </div>
      ) : null}
    </div>
  );
}
