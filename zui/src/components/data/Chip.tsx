"use client";
import type { HTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";
import type { Tone } from "../actions/types";

export interface ChipProps extends Omit<HTMLAttributes<HTMLSpanElement>, "onClick"> {
  /** Estado seleccionado (filtros). Solo tiene sentido con `onClick`. */
  selected?: boolean;
  /** Convierte la ficha en un botón conmutable. */
  onClick?: () => void;
  /** Añade un botón para quitar la ficha. */
  onRemove?: () => void;
  removeLabel?: string;
  icon?: IconName;
  /** Contador a la derecha del texto. */
  count?: number;
  size?: "sm" | "md";
  disabled?: boolean;
  /** Tono de estado (chips de estado: en línea, en pausa, con error). Sin tono, la ficha neutra de siempre. */
  tone?: Tone;
  /** Punto de estado delante del texto, del color del tono. */
  dot?: boolean;
  children?: ReactNode;
}

/** Ficha compacta: filtro conmutable, etiqueta eliminable o ambas. */
export function Chip({
  selected,
  onClick,
  onRemove,
  removeLabel = "Remove",
  icon,
  count,
  size = "md",
  disabled,
  tone,
  dot,
  className,
  children,
  ...rest
}: ChipProps) {
  const content = (
    <>
      {dot ? <span className="z-chip__dot" aria-hidden="true" /> : null}
      {icon ? <Icon name={icon} size={size === "sm" ? 12 : 14} /> : null}
      <span className="z-chip__label">{children}</span>
      {count !== undefined ? <span className="z-chip__count">{count}</span> : null}
    </>
  );
  return (
    <span
      {...rest}
      className={cx("z-chip", className)}
      data-size={size}
      data-tone={tone}
      data-selected={selected || undefined}
      data-interactive={onClick ? true : undefined}
      data-disabled={disabled || undefined}
    >
      {onClick ? (
        <button type="button" className="z-chip__main" aria-pressed={selected ?? false} disabled={disabled} onClick={onClick}>
          {content}
        </button>
      ) : (
        <span className="z-chip__main">{content}</span>
      )}
      {onRemove ? (
        <button
          type="button"
          className="z-chip__remove"
          aria-label={removeLabel}
          title={removeLabel}
          disabled={disabled}
          onClick={onRemove}
        >
          <Icon name="x-mark" size={12} />
        </button>
      ) : null}
    </span>
  );
}
