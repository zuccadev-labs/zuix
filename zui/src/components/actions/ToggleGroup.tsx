"use client";
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { logicalKey } from "../../core/dir";
import { move } from "../../core/roving";
import { cx } from "../../cx";
import { useControllable, useIsoLayoutEffect } from "../../primitives/hooks";
import { ICON_SIZE, type ControlSize } from "./types";

export interface ToggleGroupItem {
  value: string;
  label?: ReactNode;
  icon?: IconName;
  /** Nombre accesible cuando solo hay icono. */
  ariaLabel?: string;
  disabled?: boolean;
}

interface ToggleGroupBase {
  items: ReadonlyArray<ToggleGroupItem>;
  /** Nombre accesible del grupo. */
  label: string;
  size?: ControlSize;
  variant?: "outline" | "ghost";
  orientation?: "horizontal" | "vertical";
  /** Une las piezas en un solo bloque. Con `false`, separadas por 4 px. */
  attached?: boolean;
  disabled?: boolean;
  className?: string;
}

export interface ToggleGroupSingleProps extends ToggleGroupBase {
  /** Una opción activada como mucho (`""` si ninguna). */
  type?: "single";
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Impide desactivar la opción activa: siempre queda una (para eso también sirve SegmentedControl). */
  required?: boolean;
}

export interface ToggleGroupMultipleProps extends ToggleGroupBase {
  /** Varias opciones activadas a la vez. */
  type: "multiple";
  value?: ReadonlyArray<string>;
  defaultValue?: ReadonlyArray<string>;
  onValueChange?: (value: string[]) => void;
  required?: never;
}

export type ToggleGroupProps = ToggleGroupSingleProps | ToggleGroupMultipleProps;

const EMPTY: ReadonlyArray<string> = [];

/**
 * Conjunto de botones de dos estados (`aria-pressed`) con una sola parada de tabulación: las flechas mueven el foco
 * (con vuelta, en RTL la izquierda avanza), Inicio y Fin van a los extremos, y Espacio o Intro activan. `single`
 * deja como mucho una activada; `multiple`, varias.
 */
export function ToggleGroup(props: ToggleGroupProps) {
  const { items, label, size = "md", variant = "outline", orientation = "horizontal", attached = true, disabled, className } = props;
  const multiple = props.type === "multiple";
  const [single, setSingle] = useControllable<string>(
    multiple ? undefined : props.value,
    multiple ? "" : (props.defaultValue ?? ""),
    multiple ? undefined : props.onValueChange,
  );
  const [many, setMany] = useControllable<ReadonlyArray<string>>(
    multiple ? props.value : undefined,
    multiple ? (props.defaultValue ?? EMPTY) : EMPTY,
    multiple ? (props.onValueChange as (value: ReadonlyArray<string>) => void) : undefined,
  );
  const pressed = (value: string) => (multiple ? many.includes(value) : single === value);
  const off = (item: ToggleGroupItem) => Boolean(disabled || item.disabled);
  const [focused, setFocused] = useState<string | null>(null);
  // Parada de tabulación: la última enfocada, la primera activada o la primera habilitada.
  const usable = items.filter((item) => !off(item));
  const tabStop = (usable.find((item) => item.value === focused) ?? usable.find((item) => pressed(item.value)) ?? usable[0])?.value;
  useIsoLayoutEffect(() => {
    if (focused && !usable.some((item) => item.value === focused)) setFocused(null);
  });

  const toggle = (value: string) => {
    if (multiple) setMany(many.includes(value) ? many.filter((v) => v !== value) : [...many, value]);
    else if (single !== value) setSingle(value);
    else if (!props.required) setSingle("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const from = event.target instanceof Element ? event.target.closest<HTMLButtonElement>(".z-toggle") : null;
    if (!from) return;
    const list = [...event.currentTarget.querySelectorAll<HTMLButtonElement>(":scope > .z-toggle")].filter((item) => !item.disabled);
    const vertical = orientation === "vertical";
    const next = move(list, from, vertical ? event.key : logicalKey(event.key, from), vertical);
    if (!next) return;
    event.preventDefault();
    next.focus();
  };

  return (
    <div
      role="group"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={cx("z-toggle-group", className)}
      data-orientation={orientation}
      data-attached={attached || undefined}
      data-type={multiple ? "multiple" : "single"}
      data-required={(!multiple && props.required) || undefined}
      onKeyDown={onKeyDown}
    >
      {items.map((item) => {
        const on = pressed(item.value);
        return (
          <button
            key={item.value}
            type="button"
            className="z-toggle"
            data-size={size}
            data-variant={variant}
            data-icon-only={item.label == null ? true : undefined}
            aria-pressed={on}
            aria-label={item.ariaLabel}
            title={item.label == null ? item.ariaLabel : undefined}
            data-state={on ? "on" : "off"}
            data-disabled={off(item) ? "" : undefined}
            disabled={off(item)}
            value={item.value}
            tabIndex={item.value === tabStop ? 0 : -1}
            onFocus={() => setFocused(item.value)}
            onClick={() => toggle(item.value)}
          >
            {item.icon ? <Icon name={item.icon} size={ICON_SIZE[size]} /> : null}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
