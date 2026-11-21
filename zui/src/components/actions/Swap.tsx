import type { ReactNode } from "react";
import { cx } from "../../cx";

export interface SwapProps {
  /** Contenido en reposo (por ejemplo, un icono de menú). */
  off: ReactNode;
  /** Contenido activado (por ejemplo, una cruz). */
  on: ReactNode;
  /**
   * Estado. Sin él, el Swap sigue al control que lo contiene: se activa dentro de un elemento con
   * `aria-pressed="true"`, `aria-expanded="true"` o `data-state="on"` (Toggle, IconButton que abre un panel).
   */
  active?: boolean;
  /** Transición entre los dos contenidos. Con movimiento reducido, solo fundido. */
  effect?: "fade" | "rotate" | "flip" | "scale";
  className?: string;
}

/**
 * Intercambio animado entre dos contenidos que ocupan el mismo sitio. Es decorativo: el nombre y el estado los
 * expone el control que lo contiene (un botón con aria-pressed o aria-expanded).
 */
export function Swap({ off, on, active, effect = "fade", className }: SwapProps) {
  return (
    <span
      className={cx("z-swap", className)}
      aria-hidden="true"
      data-effect={effect}
      data-state={active === undefined ? undefined : active ? "on" : "off"}
    >
      <span className="z-swap__item" data-for="off">
        {off}
      </span>
      <span className="z-swap__item" data-for="on">
        {on}
      </span>
    </span>
  );
}
