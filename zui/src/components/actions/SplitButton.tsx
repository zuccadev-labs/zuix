"use client";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";
import type { MenuEntry } from "../overlay/internal";
import { Menu } from "../overlay/Menu";

export interface SplitButtonProps {
  /** Texto de la acción principal. */
  children: ReactNode;
  icon?: IconName;
  onClick?: () => void;
  /** Acciones alternativas del menú. */
  items: MenuEntry[];
  /** Nombre del botón del menú. */
  menuLabel?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
}

/** Botón dividido: la acción principal y, al lado, un botón con flecha que abre las alternativas (Menu). */
export function SplitButton({
  children,
  icon,
  onClick,
  items,
  menuLabel = "More options",
  variant = "primary",
  size = "md",
  disabled,
  className,
}: SplitButtonProps) {
  return (
    <div className={cx("z-split-button", className)} role="group" data-variant={variant} data-size={size}>
      <button
        type="button"
        className={`z-btn z-btn--${variant} z-split-button__main`}
        data-size={size}
        onClick={onClick}
        disabled={disabled}
      >
        {icon ? <Icon name={icon} size={size === "sm" ? 14 : 16} /> : null}
        {children}
      </button>
      <Menu
        trigger={
          <button
            type="button"
            className={`z-btn z-btn--icon z-btn--${variant} z-split-button__toggle`}
            data-size={size}
            aria-label={menuLabel}
            title={menuLabel}
            disabled={disabled}
          >
            <Icon name="chevron-down" size={size === "sm" ? 14 : 16} />
          </button>
        }
        items={items}
        label={menuLabel}
        align="end"
      />
    </div>
  );
}
