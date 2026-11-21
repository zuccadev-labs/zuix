"use client";
import type { ComponentProps, ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";
import { useControllable } from "../../primitives/hooks";
import { ICON_SIZE, type ControlSize } from "./types";

export interface ToggleProps extends Omit<ComponentProps<"button">, "onChange"> {
  pressed?: boolean;
  defaultPressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
  size?: ControlSize;
  /** `outline` con canto (por defecto); `ghost` sin canto ni fondo hasta pasar el puntero o activarse. */
  variant?: "outline" | "ghost";
  icon?: IconName;
  /** Nombre accesible; obligatorio cuando solo hay icono. */
  label?: string;
  children?: ReactNode;
}

/** Botón de dos estados (aria-pressed). */
export function Toggle({
  pressed: pressedProp,
  defaultPressed = false,
  onPressedChange,
  size = "md",
  variant = "outline",
  icon,
  label,
  className,
  children,
  disabled,
  onClick,
  ...rest
}: ToggleProps) {
  const [pressed, setPressed] = useControllable(pressedProp, defaultPressed, onPressedChange);
  return (
    <button
      type="button"
      title={children ? undefined : label}
      {...rest}
      aria-pressed={pressed}
      aria-label={label ?? rest["aria-label"]}
      data-state={pressed ? "on" : "off"}
      data-disabled={disabled ? "" : undefined}
      disabled={disabled}
      className={cx("z-toggle", className)}
      data-size={size}
      data-variant={variant}
      data-icon-only={children ? undefined : true}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) setPressed(!pressed);
      }}
    >
      {icon ? <Icon name={icon} size={ICON_SIZE[size]} /> : null}
      {children}
    </button>
  );
}
