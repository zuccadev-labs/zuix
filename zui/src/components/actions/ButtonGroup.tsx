import type { HTMLAttributes, ReactNode, Ref } from "react";
import { cx } from "../../cx";

export interface ButtonGroupProps extends HTMLAttributes<HTMLDivElement> {
  /** Nombre accesible del grupo (por ejemplo, «Text alignment»). */
  label?: string;
  orientation?: "horizontal" | "vertical";
  /** Une las piezas en un solo bloque (bordes compartidos y radios solo en los extremos). Con `false`, separadas. */
  attached?: boolean;
  ref?: Ref<HTMLDivElement>;
  children?: ReactNode;
}

/**
 * Grupo de botones relacionados (`role="group"`). Cada botón conserva su parada de tabulación; para una barra con
 * foco itinerante y estado, `ToggleGroup`.
 */
export function ButtonGroup({ label, orientation = "horizontal", attached = true, className, children, ...rest }: ButtonGroupProps) {
  return (
    <div
      role="group"
      aria-label={label}
      {...rest}
      className={cx("z-btn-group", className)}
      data-orientation={orientation}
      data-attached={attached || undefined}
    >
      {children}
    </div>
  );
}

/** Separador visual entre piezas de un `ButtonGroup` unido (útil entre botones sin canto, como los primarios). */
export function ButtonGroupSeparator({ className }: { className?: string }) {
  return <span className={cx("z-btn-group__separator", className)} aria-hidden="true" />;
}
