import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../../cx";
import { Spinner } from "./Spinner";

export interface LoadingOverlayProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Muestra u oculta la capa. */
  visible?: boolean;
  /** Texto visible bajo el anillo. */
  message?: ReactNode;
  /** Nombre accesible cuando no hay `message`. */
  label?: string;
  /** Cubre la ventana entera en lugar del contenedor posicionado más cercano. */
  fullscreen?: boolean;
  /** Difumina el contenido cubierto. */
  blur?: boolean;
}

/** Capa de espera sobre un contenedor (que debe tener `position: relative`) o sobre toda la ventana. */
export function LoadingOverlay({ visible = true, message, label = "Loading", fullscreen, blur = true, className, ...rest }: LoadingOverlayProps) {
  if (!visible) return null;
  return (
    <div {...rest} className={cx("z-loading-overlay", className)} data-fullscreen={fullscreen || undefined} data-blur={blur || undefined} role="status" aria-live="polite" aria-label={message ? undefined : label}>
      <Spinner size="lg" label="" />
      {message ? <span className="z-loading-overlay__message">{message}</span> : null}
    </div>
  );
}
