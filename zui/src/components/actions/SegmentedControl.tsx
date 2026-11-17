"use client";
import type { KeyboardEvent, ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { logicalKey } from "../../core/dir";
import { moveBoth } from "../../core/roving";
import { cx } from "../../cx";
import { useControllable } from "../../primitives/hooks";
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

/**
 * Selector de una opción entre pocas, siempre con una elegida. Es un `radiogroup` (patrón APG): una sola parada de
 * tabulación y las flechas mueven el foco y la selección.
 */
export function SegmentedControl<T extends string = string>({
  items,
  value,
  defaultValue,
  onValueChange,
  size = "md",
  fullWidth,
  disabled,
  label,
  className,
}: SegmentedControlProps<T>) {
  const [current, setCurrent] = useControllable<T | undefined>(value, defaultValue, onValueChange as (value: T | undefined) => void);
  const off = (item: SegmentedItem<T>) => Boolean(disabled || item.disabled);
  // Parada de tabulación: la opción elegida o, si no hay ninguna, la primera habilitada.
  const tabStop = (items.find((item) => item.value === current && !off(item)) ?? items.find((item) => !off(item)))?.value;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const from = event.target instanceof Element ? event.target.closest<HTMLButtonElement>(".z-segmented__item") : null;
    if (!from) return;
    const list = [...event.currentTarget.querySelectorAll<HTMLButtonElement>(":scope > .z-segmented__item")].filter(
      (item) => !item.disabled,
    );
    // En RTL la flecha izquierda avanza: la dirección se lee del DOM.
    const next = moveBoth(list, from, logicalKey(event.key, from));
    if (!next) return;
    event.preventDefault();
    next.focus();
    setCurrent(next.value as T);
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={cx("z-segmented", className)}
      data-size={size}
      data-block={fullWidth || undefined}
      onKeyDown={onKeyDown}
    >
      {items.map((item) => {
        const checked = item.value === current;
        return (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={item.ariaLabel}
            data-state={checked ? "on" : "off"}
            data-disabled={off(item) ? "" : undefined}
            disabled={off(item)}
            value={item.value}
            tabIndex={item.value === tabStop ? 0 : -1}
            className="z-segmented__item"
            onClick={() => setCurrent(item.value)}
          >
            {item.icon ? <Icon name={item.icon} size={ICON_SIZE[size]} /> : null}
            {item.label != null ? <span className="z-segmented__label">{item.label}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
