"use client";
import type { ComponentProps, ReactNode } from "react";
import { Toggle as RadixToggle } from "radix-ui";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";
import { ICON_SIZE, type ControlSize } from "./types";

export interface ToggleProps extends ComponentProps<typeof RadixToggle.Root> {
  size?: ControlSize;
  icon?: IconName;
  /** Nombre accesible; obligatorio cuando solo hay icono. */
  label?: string;
  children?: ReactNode;
}

/** Botón de dos estados (aria-pressed). */
export function Toggle({ size = "md", icon, label, className, children, ...rest }: ToggleProps) {
  return (
    <RadixToggle.Root
      title={children ? undefined : label}
      {...rest}
      aria-label={label ?? rest["aria-label"]}
      className={cx("z-toggle", className)}
      data-size={size}
      data-icon-only={children ? undefined : true}
    >
      {icon ? <Icon name={icon} size={ICON_SIZE[size]} /> : null}
      {children}
    </RadixToggle.Root>
  );
}
