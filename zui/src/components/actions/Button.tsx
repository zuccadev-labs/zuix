import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";
import { BUTTON_ICON_SIZE, type ButtonSize, type ButtonVariant } from "./types";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Intención. `outline` es de contorno sin relleno; `link` tiene aspecto de enlace (sigue siendo un botón). */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icono a la izquierda del texto. */
  icon?: IconName;
  /** Icono a la derecha del texto. */
  iconRight?: IconName;
  loading?: boolean;
  fullWidth?: boolean;
  ref?: Ref<HTMLButtonElement>;
  children?: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  iconRight,
  loading,
  fullWidth,
  className,
  children,
  disabled,
  onClick,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      className={cx("z-btn", `z-btn--${variant}`, className)}
      data-size={size}
      data-block={fullWidth || undefined}
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      // En carga el botón no se deshabilita (`disabled` le quitaría el foco del teclado): lleva `aria-disabled`, no
      // ejecuta `onClick` y deja de ser un botón de envío. Sin manejador propio: el componente sigue siendo estático.
      // Con `aria-disabled` (un botón apagado que conserva el foco, como en una Toolbar) tampoco ejecuta `onClick`.
      aria-disabled={loading || rest["aria-disabled"] || undefined}
      disabled={disabled}
      {...(loading ? { type: "button" as const, onClick: undefined } : { onClick: off(rest["aria-disabled"]) ? undefined : onClick })}
    >
      {/* Con carga, el anillo sustituye al icono izquierdo. */}
      {loading ? <span className="z-btn__spinner" aria-hidden="true" /> : icon ? <Icon name={icon} size={BUTTON_ICON_SIZE[size]} /> : null}
      {children}
      {iconRight ? <Icon name={iconRight} size={BUTTON_ICON_SIZE[size]} /> : null}
    </button>
  );
}

const off = (value: unknown) => value === true || value === "true";
