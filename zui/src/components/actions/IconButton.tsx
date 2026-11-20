import type { ButtonHTMLAttributes, Ref } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";
import { BUTTON_ICON_SIZE, type ButtonSize, type ButtonVariant } from "./types";

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: IconName;
  /** Nombre accesible; también se muestra como título nativo. */
  label: string;
  variant?: Exclude<ButtonVariant, "link">;
  size?: ButtonSize;
  iconVariant?: "outline" | "solid";
  /** Marca el botón como activo (por ejemplo, un panel abierto). */
  active?: boolean;
  loading?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function IconButton({
  icon,
  label,
  variant = "ghost",
  size = "md",
  iconVariant = "outline",
  active,
  loading,
  className,
  disabled,
  onClick,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      title={label}
      {...rest}
      aria-label={label}
      className={cx("z-btn", "z-btn--icon", `z-btn--${variant}`, className)}
      data-size={size}
      data-active={active || undefined}
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      // En carga el botón no se deshabilita (`disabled` le quitaría el foco del teclado): lleva `aria-disabled`, no
      // ejecuta `onClick` y deja de ser un botón de envío. Sin manejador propio: el componente sigue siendo estático.
      // Con `aria-disabled` (un botón apagado que conserva el foco, como en una Toolbar) tampoco ejecuta `onClick`.
      aria-disabled={loading || rest["aria-disabled"] || undefined}
      disabled={disabled}
      {...(loading ? { type: "button" as const, onClick: undefined } : { onClick: off(rest["aria-disabled"]) ? undefined : onClick })}
    >
      {loading ? (
        <span className="z-btn__spinner" aria-hidden="true" />
      ) : (
        <Icon name={icon} variant={iconVariant} size={BUTTON_ICON_SIZE[size]} />
      )}
    </button>
  );
}

const off = (value: unknown) => value === true || value === "true";
