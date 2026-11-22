import type { ButtonHTMLAttributes, Ref } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";

export interface FabProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: IconName;
  /** Nombre accesible; con `extended` es también el texto visible. */
  label: string;
  /** FAB extendido: icono y texto. */
  extended?: boolean;
  /** Con `extended`: el texto se pliega y queda el icono (al desplazar hacia abajo, por ejemplo). */
  collapsed?: boolean;
  size?: "sm" | "md" | "lg";
  /** `primary` acento pleno (por defecto), `secondary` tono suave, `surface` cristal. */
  variant?: "primary" | "secondary" | "surface";
  /** Fijo en una esquina del viewport (respeta las zonas seguras). */
  position?: "bottom-end" | "bottom-start" | "top-end" | "top-start" | "bottom-center";
  ref?: Ref<HTMLButtonElement>;
}

/**
 * Botón de acción flotante (FAB de Material 3): un cuadrado de esquinas redondeadas con la acción principal de la
 * pantalla; extendido con texto, que se pliega con `collapsed`. Fijo en una esquina con `position`.
 */
export function Fab({ icon, label, extended, collapsed, size = "md", variant = "primary", position, className, ...rest }: FabProps) {
  return (
    <button
      type="button"
      title={extended && !collapsed ? undefined : label}
      {...rest}
      aria-label={extended && !collapsed ? undefined : label}
      className={cx("z-fab", className)}
      data-size={size}
      data-variant={variant}
      data-extended={extended ? "" : undefined}
      data-collapsed={extended && collapsed ? "" : undefined}
      data-position={position}
    >
      <Icon name={icon} size={size === "lg" ? 28 : size === "sm" ? 18 : 22} />
      {extended ? <span className="z-fab__label">{label}</span> : null}
    </button>
  );
}
