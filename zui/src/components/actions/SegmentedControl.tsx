"use client";
import { useState, type ReactNode } from "react";
import { ToggleGroup } from "radix-ui";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";
import { ICON_SIZE, type ControlSize } from "./types";

export interface SegmentedItem<T extends string = string> {
  value: T;
  label: ReactNode;
  icon?: IconName;
  /** Nombre accesible cuando la etiqueta no es texto o se oculta. */
  ariaLabel?: string;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string = string> {
  items: ReadonlyArray<SegmentedItem<T>>;
  value?: T;
  defaultValue?: T;
  onValueChange?: (value: T) => void;
  size?: ControlSize;
  /** Reparte el ancho disponible entre los segmentos. */
  fullWidth?: boolean;
  disabled?: boolean;
  /** Nombre accesible del grupo. */
  label: string;
  className?: string;
}

/** Selector de una opción entre pocas, siempre con una elegida. */
export function SegmentedControl<T extends string = string>({ items, value, defaultValue, onValueChange, size = "md", fullWidth, disabled, label, className }: SegmentedControlProps<T>) {
  // Radix permite deseleccionar (valor vacío); aquí siempre queda una opción, por eso el valor se controla.
  const [inner, setInner] = useState<T | undefined>(defaultValue);
  const current = value ?? inner;
  return (
    <ToggleGroup.Root
      type="single"
      value={current ?? ""}
      onValueChange={(next) => {
        if (!next) return;
        setInner(next as T);
        onValueChange?.(next as T);
      }}
      disabled={disabled}
      aria-label={label}
      className={cx("z-segmented", className)}
      data-size={size}
      data-block={fullWidth || undefined}
    >
      {items.map((item) => (
        <ToggleGroup.Item key={item.value} value={item.value} disabled={item.disabled} aria-label={item.ariaLabel} className="z-segmented__item">
          {item.icon ? <Icon name={item.icon} size={ICON_SIZE[size]} /> : null}
          {item.label != null ? <span className="z-segmented__label">{item.label}</span> : null}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
