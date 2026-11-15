import type { ButtonHTMLAttributes, Ref } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";
import { ICON_SIZE, type ControlSize, type Intent } from "./types";

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: IconName;
  /** Nombre accesible; también se muestra como título nativo. */
  label: string;
  variant?: Intent;
  size?: ControlSize;
  iconVariant?: "outline" | "solid";
  /** Marca el botón como activo (por ejemplo, un panel abierto). */
  active?: boolean;
  loading?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function IconButton({ icon, label, variant = "ghost", size = "md", iconVariant = "outline", active, loading, className, disabled, ...rest }: IconButtonProps) {
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
      disabled={disabled || loading}
    >
      {loading ? <span className="z-btn__spinner" aria-hidden="true" /> : <Icon name={icon} variant={iconVariant} size={ICON_SIZE[size]} />}
    </button>
  );
}
