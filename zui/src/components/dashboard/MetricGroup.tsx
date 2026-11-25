import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../../cx";

export interface MetricGroupProps extends HTMLAttributes<HTMLElement> {
  /** Nombre del grupo (lo lee el lector como región). */
  label?: string;
  /** `glass` (por defecto): una sola tarjeta de cristal con separadores. `split`: tarjetas sueltas con hueco. */
  variant?: "glass" | "split";
  /** Columnas en pantallas anchas; en estrechas se reparten solas. */
  columns?: 2 | 3 | 4 | 5 | 6;
  children: ReactNode;
}

/** Fila de KPI: varias MetricCard en una banda que se reparte por el ancho del contenedor y se apila en estrecho. */
export function MetricGroup({ label, variant = "glass", columns, className, children, ...rest }: MetricGroupProps) {
  return (
    <section
      {...rest}
      aria-label={label}
      className={cx("z-metric-group", variant === "glass" && "z-liquid", className)}
      data-variant={variant}
      data-columns={columns}
    >
      {children}
    </section>
  );
}
